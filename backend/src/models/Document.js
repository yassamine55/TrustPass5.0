const mongoose = require("mongoose");
const { VERIFICATION_STATUS_VALUES } = require("../domain/provenance");
const {
  DOCUMENT_CATEGORY_VALUES,
  DOCUMENT_ANALYSIS_STATUS_VALUES,
  DOCUMENT_REVIEW_STATUS_VALUES,
  DOCUMENT_ANALYSIS_OUTCOME_VALUES
} = require("../domain/evidence");

const documentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sha256: { type: String, required: true },
    category: { type: String, enum: DOCUMENT_CATEGORY_VALUES, required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null, index: true },
    repair: { type: mongoose.Schema.Types.ObjectId, ref: "Repair", default: null },
    event: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
    claimType: { type: String, trim: true, default: null },
    analysisStatus: { type: String, enum: DOCUMENT_ANALYSIS_STATUS_VALUES, default: "NOT_ANALYZED" },
    analysisNote: { type: String, trim: true, default: null },
    advisoryAnalysis: {
      outcome: { type: String, enum: DOCUMENT_ANALYSIS_OUTCOME_VALUES, default: null },
      extracted: { type: mongoose.Schema.Types.Mixed, default: null },
      comparisons: [{
        field: { type: String, trim: true },
        result: { type: String, enum: ["MATCH", "MISMATCH", "MISSING", "UNAVAILABLE"] },
        note: { type: String, trim: true }
      }],
      findings: [{ type: String, trim: true }],
      confidence: { type: Number, min: 0, max: 1, default: null },
      provider: { type: String, trim: true, default: "local-advisory" },
      modelVersion: { type: String, trim: true, default: "1" },
      sourceHash: { type: String, trim: true, default: null },
      analyzedAt: { type: Date, default: null }
    },
    verificationStatus: { type: String, enum: VERIFICATION_STATUS_VALUES, default: "EVIDENCE_SUBMITTED" },
    verificationNote: { type: String, trim: true, default: null },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    professionallyVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    professionallyVerifiedAt: { type: Date, default: null },
    adminReview: {
      status: { type: String, enum: ["NONE", "PENDING", "APPROVED", "REJECTED"], default: "NONE" },
      reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: { type: Date, default: null },
      note: { type: String, trim: true, default: null }
    },
    review: {
      status: { type: String, enum: DOCUMENT_REVIEW_STATUS_VALUES, default: "NONE" },
      reason: { type: String, trim: true, default: null },
      relatedEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
      recordedAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
