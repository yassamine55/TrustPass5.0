const Product = require("../models/Product");
const User = require("../models/User");
const Repair = require("../models/Repair");
const LifecycleEvent = require("../models/LifecycleEvent");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { assertLifecycleTransition } = require("../services/lifecycleState");
const Document = require("../models/Document");
const { getHederaModule } = require("../services/hederaModule");
const { createProvenance, EVIDENCE_INTEGRITY_STATUSES } = require("../domain/provenance");
const { repairProvenanceLevel, ownerConfirmationEventType, assertRepairOwner } = require("../domain/repairTrust");
const { deriveRepairClaims } = require("../domain/structuredClaims");
const { analyzeDocument } = require("../services/documentAnalysis");
const RepairVerificationRequest = require("../models/RepairVerificationRequest");
const { anchorPassportRevisionSafely } = require("../services/passportProofService");

function repairResponse(repair) {
  const value = repair.toObject ? repair.toObject() : { ...repair };
  delete value.signature;
  delete value.signatureError;
  return value;
}

async function createRepair(req, res, next) {
  try {
    if (req.user.role !== "REPAIRER" || !req.user.isVerified) {
      return res.status(403).json({
        message: "Only a verified repairer can register a repair"
      });
    }

    const { product, description, changedParts, price, invoice, invoiceHash, date, documentId, signature } = req.body;

    const target = await Product.findById(product);
    if (!target) return res.status(404).json({ message: "Product not found" });

    assertLifecycleTransition(target.status, "REPAIR");
    const repairId = generateId("REP");

    let evidenceDocument = null;
    if (documentId) {
      evidenceDocument = await Document.findById(documentId);
      if (!evidenceDocument) return res.status(404).json({ message: "Evidence document not found" });
      if (evidenceDocument.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Evidence document access denied" });
      }
      if (evidenceDocument.product && evidenceDocument.product.toString() !== target._id.toString()) {
        return res.status(400).json({ message: "Evidence document is attached to another device" });
      }
    }

    let signatureValid = null;
    let signatureError = null;
    if (signature) {
      const hedera = getHederaModule();
      if (hedera && req.user.hederaAccountId) {
        const attestationPayload = hedera.repairerSignatures.buildRepairAttestationPayload({
          claimId: repairId,
          repairId,
          productId: target._id.toString(),
          passportId: target.passportId,
          repairerId: req.user._id.toString(),
          repairerAccountId: req.user.hederaAccountId,
          description,
          changedParts: changedParts || [],
          price: price ?? null,
          invoiceHash: invoiceHash || null,
          evidenceHash: evidenceDocument?.sha256 || invoiceHash || null,
          evidenceDocumentId: evidenceDocument?._id?.toString() || null,
          claims,
          date,
          provenance: {
            claimType: "REPAIR",
            verificationStatus: "PROFESSIONALLY_ATTESTED",
            verificationLevel: "REPAIRER_VERIFIED",
            evidenceHash: evidenceDocument?.sha256 || invoiceHash || null,
            evidenceDocumentId: evidenceDocument?._id?.toString() || null,
          }
        });
        const result = await hedera.repairerSignatures.verifySignature({
          accountId: req.user.hederaAccountId,
          payload: attestationPayload,
          signature: Buffer.from(signature, "base64")
        });
        signatureValid = result.valid;
        signatureError = result.reason || null;
        if (!result.valid) return res.status(400).json({ message: "Repairer signature is invalid" });
      }
    }

    const claims = deriveRepairClaims({
      description,
      changedParts: changedParts || [],
      evidenceDocumentId: evidenceDocument?._id ? String(evidenceDocument._id) : null,
      actorId: req.user._id ? String(req.user._id) : null,
      actorRole: req.user.role,
      timestamp: new Date().toISOString()
    });

    const repair = await Repair.create({
      repairId,
      product,
      claimant: req.user._id,
      repairer: req.user._id,
      description,
      changedParts: changedParts || [],
      claims,
      price,
      invoice: invoice || null,
      invoiceHash: invoiceHash || null,
      evidenceDocument: evidenceDocument?._id || null,
      evidenceHash: evidenceDocument?.sha256 || invoiceHash || null,
      signature: signature || null,
      signatureValid,
      signatureError,
      provenance: createProvenance({
        actor: req.user,
        claimType: "REPAIR",
        verificationLevel: repairProvenanceLevel({ signatureValid, evidenceAvailable: Boolean(evidenceDocument) }),
        verificationStatus: signatureValid === true ? "PROFESSIONALLY_ATTESTED" : evidenceDocument ? "EVIDENCE_SUBMITTED" : "OWNER_DECLARED",
        documentId: evidenceDocument?._id || null,
        evidenceReferences: evidenceDocument ? [String(evidenceDocument._id)] : [],
        evidenceHash: evidenceDocument?.sha256 || invoiceHash || null,
        verifier: signatureValid === true ? req.user : null,
        signature: { valid: signatureValid === true ? true : signatureValid === false ? false : null, signerId: req.user.hederaAccountId || null },
        integrityStatus: evidenceDocument ? EVIDENCE_INTEGRITY_STATUSES.UNVERIFIED : EVIDENCE_INTEGRITY_STATUSES.UNKNOWN
      }),
      date
    });

    target.status = "ACTIVE";
    await target.save();

    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product,
      type: "REPAIR",
      actor: req.user._id,
      description,
      document: evidenceDocument?._id || null,
      hash: evidenceDocument?.sha256 || invoiceHash || null,
      sourceRef: repair.repairId,
      provenance: repair.provenance
    });
    const blockchain = await publishAndPersistLifecycleEvent({ product: target, lifecycleEvent, actor: req.user });
    repair.lifecycleEvent = lifecycleEvent._id;
    if (evidenceDocument) {
      evidenceDocument.product = target._id;
      evidenceDocument.repair = repair._id;
      evidenceDocument.event = lifecycleEvent._id;
      evidenceDocument.claimType = "REPAIR";
      await evidenceDocument.save();
      await analyzeDocument(evidenceDocument._id);
    }
    repair.hederaStatus = blockchain.status;
    repair.hederaTopicId = blockchain.topicId;
    repair.hederaSequenceNumber = blockchain.sequenceNumber;
    repair.hederaTransactionId = blockchain.transactionId;
    repair.hederaConsensusTimestamp = blockchain.consensusTimestamp;
    repair.hederaError = blockchain.error;
    if (blockchain.status === "CONFIRMED") {
      repair.provenance.recordingStatus = "BLOCKCHAIN_RECORDED";
      repair.provenance.blockchain = {
        topicId: blockchain.topicId,
        sequenceNumber: blockchain.sequenceNumber,
        transactionId: blockchain.transactionId,
        consensusTimestamp: blockchain.consensusTimestamp
      };
    }
    await repair.save();
    await anchorPassportRevisionSafely(target, "Repair record added");
    const populated = await Repair.findById(repair._id)
      .populate("product")
      .populate("repairer", "firstName lastName email role isVerified company");

    res.status(201).json({
      message: "Repair saved",
      repair: repairResponse(populated)
    });
  } catch (error) {
    next(error);
  }
}

async function confirmRepair(req, res, next) {
  try {
    const { confirmed, note } = req.body;
    if (typeof confirmed !== "boolean") {
      return res.status(400).json({ message: "confirmed must be boolean" });
    }

    const repair = await Repair.findById(req.params.id).populate("product");
    if (!repair) return res.status(404).json({ message: "Repair not found" });
    assertRepairOwner({ user: req.user, product: repair.product });

    if (repair.ownerConfirmation?.status !== "PENDING") {
      return res.status(409).json({ message: "Repair owner confirmation is already recorded" });
    }

    const confirmationEventType = ownerConfirmationEventType(confirmed);
    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: repair.product._id,
      type: confirmationEventType,
      actor: req.user._id,
      description: note || (confirmed ? "Owner confirmed that the repair occurred" : "Owner rejected the repair claim"),
      document: repair.evidenceDocument || null,
      hash: repair.evidenceHash || null,
      sourceRef: `${repair.repairId}:${confirmationEventType}`,
      provenance: createProvenance({
        actor: req.user,
        claimType: "REPAIR_OWNER_CONFIRMATION",
        documentId: repair.evidenceDocument || null,
        evidenceReferences: repair.evidenceDocument ? [String(repair.evidenceDocument)] : [],
        integrityStatus: repair.evidenceDocument ? EVIDENCE_INTEGRITY_STATUSES.UNVERIFIED : EVIDENCE_INTEGRITY_STATUSES.UNKNOWN
      })
    });
    const blockchain = await publishAndPersistLifecycleEvent({ product: repair.product, lifecycleEvent, actor: req.user });

    repair.ownerConfirmation = {
      status: confirmed ? "CONFIRMED" : "DISPUTED",
      actor: req.user._id,
      confirmedAt: new Date(),
      note: note || null,
      lifecycleEvent: lifecycleEvent._id
    };
    await repair.save();
    await anchorPassportRevisionSafely(repair.product, confirmed
      ? "Repair confirmed by device owner"
      : "Repair disputed by device owner");

    res.status(201).json({
      message: confirmed ? "Repair confirmed by owner" : "Repair disputed by owner",
      confirmation: lifecycleEvent,
      repair: repairResponse(repair),
      hederaStatus: blockchain.status
    });
  } catch (error) {
    next(error);
  }
}

async function getRepairers(req, res, next) {
  try {
    const repairers = await User.find({ role: "REPAIRER", isVerified: true, isActive: true })
      .populate("company", "name")
      .sort({ firstName: 1, lastName: 1 });
    res.json(repairers.map((user) => ({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      address: user.address,
      hederaAccountId: user.hederaAccountId,
      company: user.company,
      role: user.role,
      isVerified: user.isVerified,
      isActive: user.isActive
    })));
  } catch (error) { next(error); }
}

async function createOwnerRepairClaim(req, res, next) {
  try {
    if (req.user.role !== "OWNER") return res.status(403).json({ message: "Only an owner can submit a repair claim" });
    const { product, description, changedParts, price, date, documentId, targetRepairerId } = req.body;
    const target = await Product.findById(product);
    if (!target) return res.status(404).json({ message: "Product not found" });
    if (target.owner.toString() !== req.user._id.toString()) return res.status(403).json({ message: "You do not own this product" });
    if (!targetRepairerId) return res.status(400).json({ message: "A target repairer is required for verification" });
    const targetRepairer = await User.findById(targetRepairerId);
    if (!targetRepairer || targetRepairer.role !== "REPAIRER" || !targetRepairer.isVerified || !targetRepairer.isActive) {
      return res.status(400).json({ message: "Target repairer must be an active verified repairer" });
    }
    if (!description || description.trim().length < 3) return res.status(400).json({ message: "Repair description is required" });
    let evidenceDocument = null;
    if (documentId) {
      evidenceDocument = await Document.findOne({ _id: documentId, uploadedBy: req.user._id });
      if (!evidenceDocument) return res.status(403).json({ message: "Evidence document access denied" });
      if (evidenceDocument.product && evidenceDocument.product.toString() !== target._id.toString()) return res.status(400).json({ message: "Evidence document is attached to another device" });
    }
    const repair = await Repair.create({
      repairId: generateId("REP"), product: target._id, claimant: req.user._id, description, changedParts: changedParts || [], price, date,
      evidenceDocument: evidenceDocument?._id || null, evidenceHash: evidenceDocument?.sha256 || null,
      verificationDecision: "UNREVIEWED",
      provenance: createProvenance({ actor: req.user, claimType: "REPAIR", documentId: evidenceDocument?._id || null, evidenceReferences: evidenceDocument ? [String(evidenceDocument._id)] : [], evidenceHash: evidenceDocument?.sha256 || null, integrityStatus: evidenceDocument ? EVIDENCE_INTEGRITY_STATUSES.UNVERIFIED : EVIDENCE_INTEGRITY_STATUSES.UNKNOWN })
    });
    const event = await LifecycleEvent.create({
      eventId: generateId("EVT"), product: target._id, type: "REPAIR_CLAIM_SUBMITTED", actor: req.user._id,
      description, document: evidenceDocument?._id || null, hash: evidenceDocument?.sha256 || null, sourceRef: repair.repairId, provenance: repair.provenance
    });
    const blockchain = await publishAndPersistLifecycleEvent({ product: target, lifecycleEvent: event, actor: req.user });
    repair.lifecycleEvent = event._id;
    repair.hederaStatus = blockchain.status;
    repair.hederaTopicId = blockchain.topicId;
    repair.hederaSequenceNumber = blockchain.sequenceNumber;
    repair.hederaTransactionId = blockchain.transactionId;
    repair.hederaConsensusTimestamp = blockchain.consensusTimestamp;
    if (evidenceDocument) {
      evidenceDocument.product = target._id; evidenceDocument.repair = repair._id; evidenceDocument.event = event._id; evidenceDocument.claimType = "REPAIR";
      await evidenceDocument.save(); await analyzeDocument(evidenceDocument._id);
    }
    await repair.save();
    await anchorPassportRevisionSafely(target, "Repair claim submitted");
    const request = await RepairVerificationRequest.create({ repair: repair._id, product: target._id, requester: req.user._id, targetRepairerId: targetRepairer._id });
    res.status(201).json({ message: "Repair claim submitted for certified repairer review", repair: repairResponse(repair), request, hederaStatus: blockchain.status });
  } catch (error) { next(error); }
}

async function professionallyConfirmRepair(req, res, next) {
  try {
    const { confirmed, note } = req.body;
    if (confirmed !== true) return res.status(400).json({ message: "Professional confirmation must be explicitly true" });
    if (req.user.role !== "REPAIRER" || !req.user.isVerified) {
      return res.status(403).json({ message: "Only a verified repairer can professionally attest a repair" });
    }

    const repair = await Repair.findById(req.params.id).populate("product");
    if (!repair) return res.status(404).json({ message: "Repair not found" });
    if (repair.repairer.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the repairer who recorded this repair can attest it" });
    }
    if (repair.provenance?.verificationStatus === "PROFESSIONALLY_ATTESTED") {
      return res.status(409).json({ message: "Repair is already professionally attested" });
    }

    const verifiedAt = new Date();
    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: repair.product._id,
      type: "REPAIR_PROFESSIONALLY_ATTESTED",
      actor: req.user._id,
      description: note || "Certified repairer professionally attested the repair",
      document: repair.evidenceDocument || null,
      hash: repair.evidenceHash || null,
      relatedEvent: repair.lifecycleEvent,
      sourceRef: `${repair.repairId}:REPAIR_PROFESSIONALLY_ATTESTED`,
      provenance: createProvenance({
        actor: req.user,
        claimType: "REPAIR",
        verificationLevel: "REPAIRER_VERIFIED",
        verificationStatus: "PROFESSIONALLY_ATTESTED",
        documentId: repair.evidenceDocument || null,
        evidenceReferences: repair.evidenceDocument ? [String(repair.evidenceDocument)] : [],
        evidenceHash: repair.evidenceHash || null,
        verifier: req.user,
        signature: { valid: repair.signatureValid === true, signerId: req.user.hederaAccountId || null },
        verifiedAt
      })
    });
    const blockchain = await publishAndPersistLifecycleEvent({ product: repair.product, lifecycleEvent, actor: req.user });

    repair.provenance.verificationStatus = "PROFESSIONALLY_ATTESTED";
    repair.provenance.verificationLevel = "REPAIRER_VERIFIED";
    repair.provenance.verifier = { actorId: req.user._id, role: req.user.role, verifiedAt };
    repair.provenance.verifiedAt = verifiedAt;
    if (blockchain.status === "CONFIRMED") {
      repair.provenance.recordingStatus = "BLOCKCHAIN_RECORDED";
      repair.provenance.blockchain = {
        topicId: blockchain.topicId,
        sequenceNumber: blockchain.sequenceNumber,
        transactionId: blockchain.transactionId,
        consensusTimestamp: blockchain.consensusTimestamp
      };
    }
    await repair.save();
    if (repair.evidenceDocument) {
      await Document.findByIdAndUpdate(repair.evidenceDocument, {
        verificationStatus: "PROFESSIONALLY_ATTESTED",
        professionallyVerifiedBy: req.user._id,
        professionallyVerifiedAt: verifiedAt,
        reviewer: req.user._id,
        event: lifecycleEvent._id
      });
    }

    await anchorPassportRevisionSafely(repair.product, "Repair professionally attested");
    res.status(201).json({ message: "Repair professionally attested", event: lifecycleEvent, repair: repairResponse(repair) });
  } catch (error) {
    next(error);
  }
}

async function getRepair(req, res, next) {
  try {
    const repair = await Repair.findById(req.params.id)
      .populate("product")
      .populate("repairer", "firstName lastName email role isVerified company")
      .populate("evidenceDocument", "originalName mimeType size category sha256 analysisStatus analysisNote advisoryAnalysis verificationStatus review");

    if (!repair) return res.status(404).json({ message: "Repair not found" });

    if (req.user.role !== "ADMIN" && repair.repairer?._id?.toString() !== req.user._id.toString()) {
      const product = repair.product;
      if (!product || product.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    res.json(repairResponse(repair));
  } catch (error) {
    next(error);
  }
}

async function getRepairs(req, res, next) {
  try {
    let filter = {};
    if (req.user.role === "REPAIRER") filter = { $or: [{ repairer: req.user._id }, { verificationDecision: "UNREVIEWED" }] };
    if (req.user.role === "OWNER" || req.user.role === "BUYER") {
      const products = await Product.find({ owner: req.user._id }).select("_id");
      filter = { product: { $in: products.map((product) => product._id) } };
    }

    const repairs = await Repair.find(filter)
      .populate("product")
      .populate("repairer", "firstName lastName email role isVerified")
      .populate("claimant", "firstName lastName email role")
      .populate("evidenceDocument", "originalName mimeType size category sha256 analysisStatus analysisNote advisoryAnalysis verificationStatus review")
      .sort({ date: -1 });

    res.json(repairs.map(repairResponse));
  } catch (error) {
    next(error);
  }
}

module.exports = { createRepair, createOwnerRepairClaim, getRepairers, confirmRepair, professionallyConfirmRepair, getRepair, getRepairs };
