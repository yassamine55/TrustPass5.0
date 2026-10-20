const Product = require("../models/Product");
const LifecycleEvent = require("../models/LifecycleEvent");
const { generatePassportId, generateId } = require("../utils/generateId");
const { normalizeDevicePhotoRef } = require("../utils/devicePhoto");
const { mintProductDevice, publishPassportHash, publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { blockchainSummary } = require("../services/blockchainView");
const { createProvenance } = require("../domain/provenance");
const { buildPassportHashPayload, computePassportHash, PASSPORT_HASH_SCHEMA_VERSION } = require("../utils/passportHash");
const { loadCurrentPayload, anchorPassportRevision } = require("../services/passportProofService");
const Document = require("../models/Document");
const Company = require("../models/Company");
const Repair = require("../models/Repair");
const { analyzeDocument } = require("../services/documentAnalysis");

async function createProduct(req, res, next) {
  try {
    const {
      brand,
      model,
      serialNumberHash,
      imeiHash,
      manufacturer,
      manufactureDate,
      purchaseDate,
      category,
      description,
      currentCondition,
      photo,
      documentId,
      companyId
    } = req.body;

    const normalizedCategory = category && ["Laptop", "Smartphone", "Tablet", "Television", "Game console", "Appliance", "Printer", "Other"].includes(category) ? category : "Other";

    if (!brand || !model || !serialNumberHash || !category) {
      return res.status(400).json({
        message: "brand, model, serialNumberHash and category are required"
      });
    }

    let attachedDocument = null;
    if (documentId) {
      attachedDocument = await Document.findOne({ _id: documentId, uploadedBy: req.user._id });
      if (!attachedDocument) return res.status(403).json({ message: "Evidence document access denied" });
    }
    let verifiedCompany = null;
    if (companyId) {
      verifiedCompany = await Company.findOne({ _id: companyId, isVerified: true, isActive: true, status: "VERIFIED" });
      if (!verifiedCompany) return res.status(400).json({ message: "Choose an active company verified by the administrator" });
    }

    const passportId = generatePassportId();
    const resolvedPhoto = normalizeDevicePhotoRef(req.file ? `device-photos/${req.file.filename}` : photo);
    const product = await Product.create({
      passportId,
      brand,
      model,
      serialNumberHash,
      imeiHash: normalizedCategory === "Smartphone" && imeiHash ? imeiHash : null,
      manufacturer,
      manufactureDate,
      purchaseDate: purchaseDate || null,
      category: normalizedCategory,
      description,
      currentCondition: currentCondition || null,
      photo: resolvedPhoto,
      documentId,
      company: verifiedCompany?._id || null,
      owner: req.user._id,
      provenance: createProvenance({
        actor: req.user,
        claimType: "DEVICE_IDENTITY",
        documentId: documentId || null,
        evidenceReferences: documentId ? [String(documentId)] : []
      })
    });

    const payload = buildPassportHashPayload(product);
    const passportHash = computePassportHash(payload);
    product.hederaProof = {
      status: "PENDING",
      transactionId: null,
      topicId: null,
      sequenceNumber: null,
      consensusTimestamp: null,
      hash: passportHash,
      schemaVersion: PASSPORT_HASH_SCHEMA_VERSION,
      payload,
      reason: "Initial passport proof",
      error: null
    };
    await product.save();

    if (attachedDocument) {
      attachedDocument.product = product._id;
      if (attachedDocument.claimType !== "DEVICE_CERTIFICATE") {
        attachedDocument.claimType = "DEVICE_IDENTITY";
      }
      await attachedDocument.save();
    }
    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: product._id,
      type: "PRODUCT_CREATED",
      actor: req.user._id,
      description: "Product passport created",
      sourceRef: `PRODUCT_CREATED:${product.passportId}`,
      provenance: createProvenance({
        actor: req.user,
        claimType: "DEVICE_IDENTITY",
        documentId: documentId || null,
        evidenceReferences: documentId ? [String(documentId)] : []
      })
    });

    const populated = await Product.findById(product._id).populate(
      "owner",
      "firstName lastName email role isVerified"
    ).populate("company", "name type status isVerified");

    setImmediate(() => {
      completePassportCreation({ product, lifecycleEvent, actor: req.user, attachedDocument })
        .catch((error) => console.error(`[passport] background completion failed for ${product.passportId}:`, error));
    });

    res.status(201).json({
      message: "Product passport created",
      product: populated
    });
  } catch (error) {
    next(error);
  }
}

async function completePassportCreation({ product, lifecycleEvent, actor, attachedDocument }) {
  if (attachedDocument) {
    try {
      await analyzeDocument(attachedDocument._id);
    } catch (error) {
      console.error(`[passport] document analysis failed for ${product.passportId}:`, error);
    }
  }

  const passportHash = product.hederaProof?.hash || computePassportHash(product);
  const proof = await publishPassportHash(product, passportHash);
  product.hederaProof = {
    ...proof,
    hash: passportHash,
    schemaVersion: product.hederaProof?.schemaVersion || PASSPORT_HASH_SCHEMA_VERSION,
    payload: product.hederaProof?.payload,
    reason: product.hederaProof?.reason || "Initial passport proof"
  };
  await product.save();

  const mint = await mintProductDevice(product);
  product.hederaStatus = mint.status;
  product.hederaTokenId = mint.tokenId;
  product.hederaSerialNumber = mint.serialNumber;
  product.hederaMintTransactionId = mint.transactionId;
  product.hederaError = mint.error;
  if (mint.status === "CONFIRMED") {
    product.provenance.recordingStatus = "BLOCKCHAIN_RECORDED";
    product.provenance.blockchain = { transactionId: mint.transactionId };
  }
  await product.save();

  if (mint.status === "CONFIRMED") {
    await publishAndPersistLifecycleEvent({ product, lifecycleEvent, actor });
  } else {
    lifecycleEvent.hederaStatus = "FAILED";
    lifecycleEvent.hederaError = mint.error;
    await lifecycleEvent.save();
  }
}

async function requestTechnicalInspection(req, res, next) {
  try {
    if (req.user.role !== "OWNER") {
      return res.status(403).json({ message: "Only the current owner can request an inspection" });
    }
    const requestedAt = new Date();
    const product = await Product.findOneAndUpdate({
      _id: req.params.id,
      owner: req.user._id,
      status: { $in: ["ACTIVE", "MAINTENANCE"] },
      $or: [
        { "technicalInspection.status": "NOT_REQUESTED" },
        {
          "technicalInspection.status": "REJECTED",
          "technicalInspection.requestDecision.action": "REJECT"
        }
      ]
    }, {
      $set: {
        "technicalInspection.status": "REQUESTED",
        "technicalInspection.reviewStatus": "NOT_SUBMITTED",
        "technicalInspection.requestedBy": req.user._id,
        "technicalInspection.requestedAt": requestedAt,
        "technicalInspection.requestEvent": null,
        "technicalInspection.assignedRepairer": null,
        "technicalInspection.requestDecision": { action: null, reviewer: null, reviewedAt: null, note: null },
        "technicalInspection.reviewDecision": { action: null, reviewer: null, reviewedAt: null, note: null },
        "technicalInspection.reviewedBy": null,
        "technicalInspection.reviewedAt": null,
        "technicalInspection.reviewNote": null
      }
    }, { new: true });
    if (!product) {
      const exists = await Product.exists({ _id: req.params.id });
      if (!exists) return res.status(404).json({ message: "Product not found" });
      const owned = await Product.exists({ _id: req.params.id, owner: req.user._id });
      if (!owned) return res.status(403).json({ message: "Only the current owner can request an inspection" });
      return res.status(409).json({ message: "This device already has an active or completed inspection request" });
    }

    let event;
    try {
      const eventId = generateId("EVT");
      event = await LifecycleEvent.create({
        eventId,
        product: product._id,
        type: "INSPECTION_REQUESTED",
        actor: req.user._id,
        description: "Owner requested an independent technical inspection",
        sourceRef: `INSPECTION_REQUESTED:${product.passportId}:${eventId}`,
        provenance: createProvenance({ actor: req.user, claimType: "TECHNICAL_INSPECTION_REQUEST" })
      });
    } catch (error) {
      await Product.updateOne(
        { _id: product._id, "technicalInspection.requestedAt": requestedAt },
        {
          $set: {
            "technicalInspection.status": "NOT_REQUESTED",
            "technicalInspection.reviewStatus": "NOT_SUBMITTED",
            "technicalInspection.requestedBy": null,
            "technicalInspection.requestedAt": null
          }
        }
      );
      throw error;
    }
    product.technicalInspection.requestEvent = event._id;
    await product.save();
    await anchorPassportRevisionSafely(product, "Technical inspection requested");
    await publishAndPersistLifecycleEvent({ product, lifecycleEvent: event, actor: req.user });
    res.status(201).json({ message: "Technical inspection requested", product, event });
  } catch (error) {
    next(error);
  }
}

async function reportStolen(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (req.user.role !== "OWNER" || product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the current owner can report this device as stolen" });
    }
    if (product.stolenReport?.status && product.stolenReport.status !== "NONE") {
      return res.status(409).json({ message: "This device already has a stolen report" });
    }

    const note = typeof req.body.note === "string" ? req.body.note.trim() : null;
    const event = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: product._id,
      type: "STOLEN_REPORTED",
      actor: req.user._id,
      description: note ? `Owner reported device as stolen: ${note}` : "Owner reported device as stolen",
      sourceRef: `STOLEN_REPORTED:${product.passportId}`,
      provenance: createProvenance({ actor: req.user, claimType: "STOLEN_DEVICE", verificationStatus: "OWNER_DECLARED" })
    });
    await publishAndPersistLifecycleEvent({ product, lifecycleEvent: event, actor: req.user });
    product.stolenReport = {
      status: "OWNER_REPORTED",
      reportedBy: req.user._id,
      reportedAt: new Date(),
      note,
      lifecycleEvent: event._id,
      authorityName: null,
      authorityReference: null
    };
    await product.save();
    res.status(201).json({ message: "Device reported as stolen", product, event });
  } catch (error) {
    next(error);
  }
}

async function getProducts(req, res, next) {
  try {
    const filter = {};

    if (req.user.role === "OWNER") {
      filter.owner = req.user._id;
    }

    const products = await Product.find(filter)
      .populate("owner", "firstName lastName email role isVerified")
      .populate("company", "name type status isVerified")
      .populate("documentId", "originalName category adminReview.status")
      .sort({ createdAt: -1 });

    const productIds = products.map((product) => product._id);
    const certifiedRepairs = await Repair.aggregate([
      { $match: { product: { $in: productIds }, $or: [{ verificationDecision: "PROFESSIONALLY_ATTESTED" }, { "provenance.verificationStatus": "PROFESSIONALLY_ATTESTED" }] } },
      { $group: { _id: "$product", count: { $sum: 1 } } }
    ]);
    const repairCounts = new Map(certifiedRepairs.map((item) => [String(item._id), item.count]));
    products.forEach((product) => { product.set("certifiedRepairCount", repairCounts.get(String(product._id)) || 0, { strict: false }); });

    res.json(products);
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id)
      .populate("owner", "firstName lastName email role isVerified")
      .populate("company", "name type status isVerified");

    if (!product) return res.status(404).json({ message: "Product not found" });

    if (
      req.user.role === "OWNER" &&
      product.owner._id.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ message: "You do not own this product" });
    }

    res.json({ product, blockchain: blockchainSummary(product) });
  } catch (error) {
    next(error);
  }
}

async function getPassportProof(req, res, next) {
  try {
    const product = await Product.findById(req.params.id)
      .select("+hederaProof.payload +hederaProofHistory");
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (req.user.role !== "OWNER" || product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You do not own this product" });
    }
    const currentPayload = await loadCurrentPayload(product);
    const localHash = computePassportHash(currentPayload);
    res.json({
      proof: product.hederaProof,
      history: product.hederaProofHistory || [],
      localHash,
      needsReanchor: product.hederaProof?.schemaVersion !== PASSPORT_HASH_SCHEMA_VERSION ||
        product.hederaProof?.hash !== localHash,
      network: process.env.HEDERA_NETWORK || "testnet"
    });
  } catch (error) {
    next(error);
  }
}

async function retryPassportProof(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (req.user.role !== "OWNER" || product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You do not own this product" });
    }
    const payload = await loadCurrentPayload(product);
    const hash = computePassportHash(payload);
    if (product.hederaProof?.status === "CONFIRMED" &&
      product.hederaProof.schemaVersion === PASSPORT_HASH_SCHEMA_VERSION &&
      product.hederaProof.hash === hash) {
      return res.status(409).json({ message: "The current passport version already has a confirmed Hedera proof" });
    }
    await anchorPassportRevision(product, "Owner requested a new passport proof");
    const updated = await Product.findById(product._id)
      .select("+hederaProof.payload +hederaProofHistory");
    res.json({
      proof: updated.hederaProof,
      history: updated.hederaProofHistory || [],
      localHash: hash,
      needsReanchor: updated.hederaProof?.schemaVersion !== PASSPORT_HASH_SCHEMA_VERSION ||
        updated.hederaProof?.hash !== hash,
      network: process.env.HEDERA_NETWORK || "testnet"
    });
  } catch (error) {
    next(error);
  }
}

async function verifyPassportProof(req, res, next) {
  try {
    const product = await Product.findById(req.params.id)
      .select("+hederaProof.payload +hederaProofHistory");
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (req.user.role !== "OWNER" || product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You do not own this product" });
    }
    const proof = product.hederaProof;
    if (proof?.status !== "CONFIRMED" || !proof.topicId || !proof.sequenceNumber) {
      return res.status(409).json({ message: "No confirmed Hedera proof is available for this passport" });
    }

    if (proof.schemaVersion !== PASSPORT_HASH_SCHEMA_VERSION || !proof.payload) {
      return res.status(409).json({
        requiresReanchor: true,
        message: "This legacy proof has no saved versioned payload. Anchor the current passport version before comparing it."
      });
    }

    const localHash = computePassportHash(await loadCurrentPayload(product));
    let hedera;
    try {
      hedera = require("../services/hederaModule").getHederaModule();
    } catch (error) {
      console.error(`[hedera] proof verification setup failed for ${product.passportId}:`, error);
      return res.status(503).json({ message: "Hedera verification is unavailable. Please retry later." });
    }
    if (!hedera) return res.status(503).json({ message: "Hedera verification is unavailable" });

    let messages;
    try {
      messages = await hedera.mirrorNode.getTopicMessages(proof.topicId, {
        sequenceNumber: proof.sequenceNumber,
        limit: 1
      });
    } catch (error) {
      console.error(`[hedera] Mirror Node proof read failed for ${product.passportId}:`, error);
      return res.status(503).json({ message: "Hedera's Mirror Node could not be reached. Please retry." });
    }
    const message = messages.find((entry) => entry.sequenceNumber === proof.sequenceNumber);
    if (!message) return res.status(503).json({ message: "The Hedera message is not available from Mirror Node yet. Please retry." });
    const onChainHash = message.messageText.trim();
    if (!/^[a-f0-9]{64}$/.test(onChainHash)) {
      return res.status(502).json({ message: "The message stored at this Hedera reference is not a valid passport hash" });
    }
    if (!proof.consensusTimestamp && message.consensusTimestamp) {
      product.hederaProof.consensusTimestamp = message.consensusTimestamp;
      await product.save();
    }
    const savedPayloadHash = computePassportHash(proof.payload);
    res.json({
      matches: localHash === onChainHash && proof.hash === onChainHash && savedPayloadHash === onChainHash,
      localHash,
      onChainHash,
      savedPayloadHash,
      consensusTimestamp: message.consensusTimestamp || proof.consensusTimestamp,
      transactionId: proof.transactionId,
      topicId: proof.topicId,
      sequenceNumber: proof.sequenceNumber,
      network: process.env.HEDERA_NETWORK || "testnet"
    });
  } catch (error) {
    next(error);
  }
}

async function updateListing(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (req.user.role !== "OWNER" || product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the current owner can manage this device's listing" });
    }
    if (!["ACTIVE", "MAINTENANCE"].includes(product.status)) {
      return res.status(409).json({ message: "Only devices in service can be listed for sale" });
    }
    if (product.stolenReport?.status && product.stolenReport.status !== "NONE") {
      return res.status(409).json({ message: "This device has been reported stolen and cannot be listed" });
    }

    const { action } = req.body;
    if (action === "LIST") {
      const price = Number(req.body.price);
      if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Listing price must be a non-negative number" });
      product.listingPrice = price;
    } else if (action === "UNLIST") {
      product.listingPrice = null;
    } else {
      return res.status(400).json({ message: "action must be LIST or UNLIST" });
    }
    await product.save();
    res.json({ message: action === "LIST" ? "Device listed on the marketplace" : "Device removed from the marketplace", product });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  getPassportProof,
  retryPassportProof,
  verifyPassportProof,
  requestTechnicalInspection,
  reportStolen,
  updateListing
};
