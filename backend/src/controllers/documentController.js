const Document = require("../models/Document");
const sha256File = require("../utils/hashFile");
const fs = require("fs");
const path = require("path");
const Product = require("../models/Product");
const LifecycleEvent = require("../models/LifecycleEvent");
const { DOCUMENT_CATEGORY_VALUES } = require("../domain/evidence");
const { analyzeDocument } = require("../services/documentAnalysis");

async function canUseProduct(req, productId) {
  if (!productId) return true;
  const product = await Product.findById(productId).select("owner");
  if (!product) return false;
  return req.user.role === "ADMIN" ||
    product.owner.toString() === req.user._id.toString() ||
    (req.user.role === "REPAIRER" && req.user.isVerified);
}

async function canAccessDocument(req, document) {
  if (req.user.role === "ADMIN" || document.uploadedBy.toString() === req.user._id.toString()) return true;
  if (document.product) {
    const product = await Product.findById(document.product).select("owner");
    if (product?.owner?.toString() === req.user._id.toString()) return true;
  }
  return false;
}

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const { category, product, event, claimType } = req.body;
    if (!DOCUMENT_CATEGORY_VALUES.includes(category)) {
      return res.status(400).json({ message: `category must be one of: ${DOCUMENT_CATEGORY_VALUES.join(", ")}` });
    }
    if (!(await canUseProduct(req, product))) {
      return res.status(403).json({ message: "You cannot attach evidence to this device" });
    }
    if (event) {
      const lifecycleEvent = await LifecycleEvent.findById(event).select("product");
      if (!lifecycleEvent || (product && lifecycleEvent.product.toString() !== product.toString())) {
        return res.status(400).json({ message: "Evidence event does not match the device" });
      }
    }

    const sha256 = await sha256File(req.file.path);

    const document = await Document.create({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      path: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      sha256,
      category,
      product: product || null,
      event: event || null,
      claimType: claimType || null,
      verificationStatus: "EVIDENCE_SUBMITTED",
      adminReview: claimType === "DEVICE_CERTIFICATE" ? { status: "PENDING" } : { status: "NONE" }
    });
    const analyzedDocument = await analyzeDocument(document._id);

    res.status(201).json({
      message: "Document uploaded and hashed with SHA-256",
      document: analyzedDocument
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
}

async function analyzeDocumentById(req, res, next) {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (!(await canAccessDocument(req, document))) return res.status(403).json({ message: "Access denied" });
    const analyzed = await analyzeDocument(document._id);
    res.json({ message: "Advisory document analysis completed", document: analyzed });
  } catch (error) {
    next(error);
  }
}

async function verifyDocument(req, res, next) {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ message: "Document not found" });

    if (!(await canAccessDocument(req, document))) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({
        message: "Original stored file is missing; integrity cannot be checked"
      });
    }

    const currentHash = await sha256File(document.path);
    const verified = currentHash === document.sha256;

    res.json({
      documentId: document._id,
      storedHash: document.sha256,
      currentHash,
      verified
    });
  } catch (error) {
    next(error);
  }
}

async function downloadDocument(req, res, next) {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (!(await canAccessDocument(req, document))) {
      return res.status(403).json({ message: "Access denied" });
    }
    if (!fs.existsSync(document.path)) return res.status(404).json({ message: "Document file not found" });
    return res.sendFile(path.resolve(document.path), { headers: { "Content-Type": document.mimeType } });
  } catch (error) {
    next(error);
  }
}

module.exports = { uploadDocument, analyzeDocumentById, verifyDocument, downloadDocument };
