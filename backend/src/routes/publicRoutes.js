const router = require("express").Router();
const Product = require("../models/Product");
const Company = require("../models/Company");
const LifecycleEvent = require("../models/LifecycleEvent");
const Repair = require("../models/Repair");
const { blockchainSummary } = require("../services/blockchainView");
const { normalizeDevicePhotoRef, resolvePublicDevicePhotoPath, getDevicePhotoMimeType } = require("../utils/devicePhoto");

const PUBLIC_DOCUMENT_FIELDS = "originalName mimeType size category claimType sha256 analysisStatus analysisNote advisoryAnalysis.outcome advisoryAnalysis.comparisons advisoryAnalysis.findings advisoryAnalysis.confidence advisoryAnalysis.analyzedAt verificationStatus verificationNote review createdAt uploadedBy reviewer professionallyVerifiedBy professionallyVerifiedAt adminReview.status";
const PUBLIC_DOCUMENT_POPULATE = [
  { path: "uploadedBy", select: "_id role isVerified" },
  { path: "reviewer", select: "_id role isVerified" },
  { path: "professionallyVerifiedBy", select: "_id role isVerified" }
];

router.get("/companies/verified", async (req, res, next) => {
  try {
    const companies = await Company.find({ isVerified: true, isActive: true, status: "VERIFIED" })
      .select("name type")
      .sort({ name: 1 });
    res.json(companies);
  } catch (error) {
    next(error);
  }
});

function sanitizePublicUser(user) {
  if (!user) return null;
  const value = user.toObject ? user.toObject() : user;
  return {
    _id: value._id,
    role: value.role,
    isVerified: Boolean(value.isVerified)
  };
}

function sanitizePublicDocument(document) {
  if (!document) return null;
  const value = document.toObject ? document.toObject() : document;
  const publicDocument = { ...value };
  delete publicDocument.uploadedBy;
  delete publicDocument.reviewer;
  delete publicDocument.professionallyVerifiedBy;
  delete publicDocument.originalName;
  delete publicDocument.sha256;
  delete publicDocument.path;
  if (value.uploadedBy) publicDocument.uploadedBy = sanitizePublicUser(value.uploadedBy);
  if (value.reviewer) publicDocument.reviewer = sanitizePublicUser(value.reviewer);
  if (value.professionallyVerifiedBy) publicDocument.professionallyVerifiedBy = sanitizePublicUser(value.professionallyVerifiedBy);
  return publicDocument;
}

function sanitizePublicProduct(product) {
  if (!product) return null;
  const value = product.toObject ? product.toObject() : product;
  const publicProduct = { ...value };
  delete publicProduct.owner;
  delete publicProduct.serialNumberHash;
  delete publicProduct.imeiHash;
  delete publicProduct.hederaProof;
  delete publicProduct.provenance?.source?.actorId;
  if (value.owner) publicProduct.owner = sanitizePublicUser(value.owner);
  if (value.documentId) publicProduct.documentId = sanitizePublicDocument(value.documentId);
  return publicProduct;
}

function sanitizePublicEvent(event) {
  if (!event) return null;
  const value = event.toObject ? event.toObject() : event;
  const publicEvent = { ...value };
  delete publicEvent.actor;
  delete publicEvent.document;
  if (value.actor) publicEvent.actor = sanitizePublicUser(value.actor);
  if (value.document) publicEvent.document = sanitizePublicDocument(value.document);
  return publicEvent;
}

function sanitizePublicRepair(repair) {
  if (!repair) return null;
  const value = repair.toObject ? repair.toObject() : repair;
  const publicRepair = { ...value };
  delete publicRepair.claimant;
  delete publicRepair.repairer;
  delete publicRepair.evidenceDocument;
  if (value.claimant) publicRepair.claimant = sanitizePublicUser(value.claimant);
  if (value.repairer) publicRepair.repairer = sanitizePublicUser(value.repairer);
  if (value.evidenceDocument) publicRepair.evidenceDocument = sanitizePublicDocument(value.evidenceDocument);
  return publicRepair;
}

router.get("/passport/:passportId", async (req, res, next) => {
  try {
    const product = await Product.findOne({ passportId: req.params.passportId })
      .populate("owner", "_id role isVerified")
      .populate("company", "name type status isVerified")
      .populate({ path: "documentId", select: PUBLIC_DOCUMENT_FIELDS, populate: PUBLIC_DOCUMENT_POPULATE });

    if (!product) return res.status(404).json({ message: "Passport not found" });

    const [events, repairs] = await Promise.all([
      LifecycleEvent.find({ product: product._id })
        .populate("actor", "_id role isVerified")
        .populate("relatedEvent", "eventId type createdAt")
        .populate({ path: "document", select: PUBLIC_DOCUMENT_FIELDS, populate: PUBLIC_DOCUMENT_POPULATE })
        .sort({ createdAt: 1 }),
      Repair.find({ product: product._id })
        .populate("claimant", "_id role isVerified")
        .populate("repairer", "_id role isVerified company")
        .populate({ path: "evidenceDocument", select: PUBLIC_DOCUMENT_FIELDS, populate: PUBLIC_DOCUMENT_POPULATE })
        .sort({ date: -1 })
    ]);

    res.json({
      passport: sanitizePublicProduct(product),
      blockchain: blockchainSummary(product),
      events: events.map(sanitizePublicEvent),
      repairs: repairs.map(sanitizePublicRepair)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/devices/:productId/photo", async (req, res, next) => {
  try {
    const product = await Product.findOne({
      $or: [
        { _id: req.params.productId },
        { passportId: req.params.productId }
      ]
    });

    if (!product || !product.photo) {
      return res.status(404).json({ message: "Device photo not found" });
    }

    const photoRef = normalizeDevicePhotoRef(product.photo);
    if (!photoRef) {
      return res.status(404).json({ message: "Device photo not found" });
    }

    let filePath;
    try {
      filePath = resolvePublicDevicePhotoPath(photoRef);
    } catch (error) {
      return res.status(404).json({ message: "Device photo not found" });
    }

    return res.sendFile(filePath, {
      headers: {
        "Content-Type": getDevicePhotoMimeType(filePath),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.sanitizePublicUser = sanitizePublicUser;
module.exports.sanitizePublicDocument = sanitizePublicDocument;
module.exports.sanitizePublicProduct = sanitizePublicProduct;
module.exports.sanitizePublicEvent = sanitizePublicEvent;
module.exports.sanitizePublicRepair = sanitizePublicRepair;
