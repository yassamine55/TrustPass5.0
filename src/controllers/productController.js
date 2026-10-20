const Product = require("../models/Product");
const LifecycleEvent = require("../models/LifecycleEvent");
const { generatePassportId, generateId } = require("../utils/generateId");
const { normalizeDevicePhotoRef } = require("../utils/devicePhoto");
const { mintProductDevice, publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { blockchainSummary } = require("../services/blockchainView");

async function createProduct(req, res, next) {
  try {
    const uploadedPhoto = req.files?.photo?.[0] || req.files?.devicePhoto?.[0] || req.file;
    const {
      brand,
      model,
      serialNumberHash,
      manufacturer,
      manufactureDate,
      category,
      description,
      photo,
      devicePhoto
    } = req.body;

    if (!brand || !model || !serialNumberHash || !category) {
      return res.status(400).json({
        message: "brand, model, serialNumberHash and category are required"
      });
    }

    const passportId = generatePassportId();
    const rawPhoto = uploadedPhoto ? `device-photos/${uploadedPhoto.filename}` : (photo || devicePhoto || null);
    const resolvedPhoto = normalizeDevicePhotoRef(rawPhoto);
    const product = await Product.create({
      passportId,
      brand,
      model,
      serialNumberHash,
      manufacturer,
      manufactureDate,
      category,
      description,
      photo: resolvedPhoto,
      owner: req.user._id
    });

    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: product._id,
      type: "PRODUCT_CREATED",
      actor: req.user._id,
      description: "Product passport created",
      sourceRef: `PRODUCT_CREATED:${product.passportId}`
    });

    const mint = await mintProductDevice(product);
    product.hederaStatus = mint.status;
    product.hederaTokenId = mint.tokenId;
    product.hederaSerialNumber = mint.serialNumber;
    product.hederaMintTransactionId = mint.transactionId;
    product.hederaError = mint.error;
    await product.save();

    if (mint.status === "CONFIRMED") {
      await publishAndPersistLifecycleEvent({
        product,
        lifecycleEvent,
        actor: req.user
      });
    } else {
      lifecycleEvent.hederaStatus = "FAILED";
      lifecycleEvent.hederaError = mint.error;
      await lifecycleEvent.save();
    }

    const populated = await Product.findById(product._id).populate(
      "owner",
      "firstName lastName email role isVerified"
    );

    res.status(201).json({
      message: "Product passport created",
      product: populated
    });
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
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    next(error);
  }
}

async function getProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id)
      .populate("owner", "firstName lastName email role isVerified");

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

async function requestTechnicalInspection(req, res, next) {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (req.user.role !== "OWNER" || product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the current owner can request an inspection" });
    }
    if (product.technicalInspection?.status !== "NOT_REQUESTED") {
      return res.status(409).json({ message: "Technical inspection has already been requested" });
    }

    product.technicalInspection = {
      status: "REQUESTED",
      reviewStatus: "NOT_SUBMITTED",
      requestedBy: req.user._id,
      requestedAt: new Date(),
      requestEvent: `evt-${Date.now()}`
    };
    await product.save();

    res.status(201).json({ message: "Technical inspection requested", product });
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
    product.stolenReport = {
      status: "OWNER_REPORTED",
      reportedBy: req.user._id,
      reportedAt: new Date(),
      note,
      authorityName: null,
      authorityReference: null
    };
    await product.save();

    res.status(201).json({ message: "Device reported as stolen", product });
  } catch (error) {
    next(error);
  }
}

module.exports = { createProduct, getProducts, getProduct, requestTechnicalInspection, reportStolen };
