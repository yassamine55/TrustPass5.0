const mongoose = require("mongoose");
const { PROVENANCE_LEVEL_VALUES, PROVENANCE_SOURCE_VALUES, INSTITUTION_TYPE_VALUES, EVIDENCE_INTEGRITY_STATUS_VALUES, VERIFICATION_STATUS_VALUES, RECORDING_STATUS_VALUES } = require("../domain/provenance");

const provenanceSchema = new mongoose.Schema({
  claimType: { type: String, trim: true, default: null },
  source: {
    type: { type: String, enum: PROVENANCE_SOURCE_VALUES, default: "OWNER" },
    role: { type: String, trim: true, default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  verificationStatus: { type: String, enum: VERIFICATION_STATUS_VALUES, default: "OWNER_DECLARED" },
  verificationLevel: { type: String, enum: PROVENANCE_LEVEL_VALUES, default: "OWNER_REPORTED" },
  institutionType: { type: String, enum: INSTITUTION_TYPE_VALUES, default: null },
  evidence: {
    available: { type: Boolean, default: false },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    reference: { type: String, trim: true, default: null },
    references: [{ type: String, trim: true }],
    hash: { type: String, trim: true, default: null },
    integrityStatus: { type: String, enum: EVIDENCE_INTEGRITY_STATUS_VALUES, default: "UNKNOWN" }
  },
  verifier: {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    role: { type: String, trim: true, default: null },
    verifiedAt: { type: Date, default: null }
  },
  signature: {
    status: { type: String, enum: ["NOT_PROVIDED", "VALID", "INVALID"], default: "NOT_PROVIDED" },
    algorithm: { type: String, trim: true, default: null },
    signerId: { type: String, trim: true, default: null }
  },
  recordingStatus: { type: String, enum: RECORDING_STATUS_VALUES, default: "NOT_RECORDED" },
  blockchain: {
    topicId: { type: String, trim: true, default: null },
    sequenceNumber: { type: Number, default: null },
    transactionId: { type: String, trim: true, default: null },
    consensusTimestamp: { type: String, trim: true, default: null }
  },
  dispute: {
    status: { type: String, enum: ["NONE", "DISPUTED", "REVOKED", "CORRECTED"], default: "NONE" },
    relatedEventId: { type: String, trim: true, default: null },
    reason: { type: String, trim: true, default: null },
    recordedAt: { type: Date, default: null }
  },
  verifiedAt: { type: Date, default: null }
}, { _id: false });

const repairSchema = new mongoose.Schema(
  {
    repairId: { type: String, required: true, unique: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    repairer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    verificationDecision: { type: String, enum: ["UNREVIEWED", "PROFESSIONALLY_ATTESTED", "REJECTED"], default: "UNREVIEWED" },

    date: { type: Date, default: Date.now },
    description: { type: String, required: true, trim: true },
    changedParts: [{ type: String, trim: true }],
    claims: [{
      id: { type: String, required: true },
      type: { type: String, required: true },
      subject: { type: String, required: true },
      value: { type: String, required: true },
      assertion: { type: String, required: true },
      actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      actorRole: { type: String, default: null },
      timestamp: { type: Date, default: Date.now },
      evidenceReferences: [{ type: String, trim: true }],
      hash: { type: String, required: true }
    }],
    price: { type: Number, min: 0 },
    invoice: { type: String, default: null },
    invoiceHash: { type: String, default: null },
    evidenceDocument: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    evidenceHash: { type: String, default: null },
    signature: { type: String, default: null },
    signatureSignedAt: { type: Date, default: null },
    signatureSigner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    signatureValid: { type: Boolean, default: null },
    signatureError: { type: String, default: null, select: false },
    provenance: { type: provenanceSchema, default: () => ({}) },
    ownerConfirmation: {
      status: { type: String, enum: ["PENDING", "CONFIRMED", "DISPUTED", "REJECTED"], default: "PENDING" },
      actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      confirmedAt: { type: Date, default: null },
      note: { type: String, trim: true, default: null },
      lifecycleEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null }
    },
    lifecycleEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
    hederaStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "FAILED"],
      default: "PENDING"
    },
    hederaTopicId: { type: String, default: null },
    hederaSequenceNumber: { type: Number, default: null },
    hederaTransactionId: { type: String, default: null },
    hederaConsensusTimestamp: { type: String, default: null },
    hederaError: { type: String, default: null, select: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Repair", repairSchema);
