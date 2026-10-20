const mongoose = require("mongoose");
const {
  VERIFICATION_REQUEST_STATUS_VALUES,
  VERIFICATION_REQUEST_STATUSES
} = require("../domain/verificationRequest");
const { VERIFICATION_STATUS_VALUES } = require("../domain/provenance");

const evidenceReferenceSchema = new mongoose.Schema({
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
  reference: { type: String, trim: true, default: null }
}, { _id: false });

const inspectionSchema = new mongoose.Schema({
  status: { type: String, enum: ["NOT_STARTED", "COMPLETED", "APPROVED", "REJECTED"], default: "NOT_STARTED" },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  performedAt: { type: Date, default: null },
  result: { type: String, enum: ["PASS", "CONDITIONAL", "FAIL"], default: null },
  findings: { type: String, trim: true, default: null },
  measurements: { type: mongoose.Schema.Types.Mixed, default: null },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, trim: true, default: null }
}, { _id: false });

const verificationRequestSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    lifecycleEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", required: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetInstitution: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    reason: { type: String, required: true, trim: true, minlength: 3 },
    evidence: { type: [evidenceReferenceSchema], default: [] },
    claimType: { type: String, trim: true, default: "TECHNICAL_INSPECTION" },
    verificationStatus: { type: String, enum: VERIFICATION_STATUS_VALUES, default: "EVIDENCE_SUBMITTED" },
    inspection: { type: inspectionSchema, default: () => ({}) },
    verificationMode: { type: String, enum: ["DEMO_TEST", "EXTERNAL_VERIFICATION"], default: "DEMO_TEST" },
    status: {
      type: String,
      enum: VERIFICATION_REQUEST_STATUS_VALUES,
      default: VERIFICATION_REQUEST_STATUSES.PENDING,
      index: true
    },
    createdAt: { type: Date, default: Date.now },
    respondedAt: { type: Date, default: null },
    response: { type: String, trim: true, default: null },
    responseReason: { type: String, trim: true, default: null },
    responseEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null }
  },
  { timestamps: true }
);

verificationRequestSchema.index(
  { lifecycleEvent: 1, targetInstitution: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);

module.exports = mongoose.model("VerificationRequest", verificationRequestSchema);
