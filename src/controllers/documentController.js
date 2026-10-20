const Document = require("../models/Document");
const sha256File = require("../utils/hashFile");
const fs = require("fs");
const path = require("path");

async function uploadDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    const sha256 = await sha256File(req.file.path);

    const document = await Document.create({
      originalName: req.file.originalname,
      storedName: req.file.filename,
      path: req.file.path,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      sha256
    });

    res.status(201).json({
      message: "Document uploaded and hashed with SHA-256",
      document
    });
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    next(error);
  }
}

async function verifyDocument(req, res, next) {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) return res.status(404).json({ message: "Document not found" });

    if (req.user.role !== "ADMIN" && document.uploadedBy.toString() !== req.user._id.toString()) {
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
    if (req.user.role !== "ADMIN" && document.uploadedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }
    if (!fs.existsSync(document.path)) return res.status(404).json({ message: "Document file not found" });
    return res.sendFile(path.resolve(document.path), { headers: { "Content-Type": document.mimeType } });
  } catch (error) {
    next(error);
  }
}

module.exports = { uploadDocument, verifyDocument, downloadDocument };
