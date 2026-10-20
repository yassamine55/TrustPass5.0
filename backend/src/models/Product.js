const mongoose = require("mongoose");
const { DEVICE_CATEGORIES } = require("../domain/technicalInspection");
const { VERIFICATION_STATUS_VALUES, RECORDING_STATUS_VALUES } = require("../domain/provenance");

const productSchema = new mongoose.Schema(
  {
    passportId: { type: String, required: true, unique: true, index: true },

    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    serialNumberHash: { type: String, required: true, trim: true },
    imeiHash: { type: String, trim: true, default: null },
    manufacturer: { type: String, trim: true },
    manufactureDate: { type: Date },
    purchaseDate: { type: Date, default: null },
    category: { type: String, enum: DEVICE_CATEGORIES, required: true, trim: true },
    description: { type: String, trim: true },
    currentCondition: { type: String, trim: true, default: null },
    listingPrice: { type: Number, min: 0, default: null },
    photo: { type: String, default: null },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    stolenReport: {
      status: { type: String, enum: ["NONE", "OWNER_REPORTED", "AUTHORITY_VERIFIED"], default: "NONE" },
      reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reportedAt: { type: Date, default: null },
      note: { type: String, trim: true, default: null },
      lifecycleEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
      authorityName: { type: String, trim: true, default: null },
      authorityReference: { type: String, trim: true, default: null }
    },
    provenance: {
      claimType: { type: String, trim: true, default: "DEVICE_IDENTITY" },
      source: {
        type: { type: String, enum: ["OWNER", "REPAIRER", "INSTITUTION"], default: "OWNER" },
        role: { type: String, trim: true, default: "OWNER" },
        actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
      },
      verificationStatus: { type: String, enum: VERIFICATION_STATUS_VALUES, default: "OWNER_DECLARED" },
      evidence: {
        available: { type: Boolean, default: false },
        documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
        reference: { type: String, trim: true, default: null },
        references: [{ type: String, trim: true }],
        hash: { type: String, trim: true, default: null },
        integrityStatus: { type: String, enum: ["UNKNOWN", "UNVERIFIED", "VERIFIED", "FAILED"], default: "UNKNOWN" }
      },
      recordingStatus: { type: String, enum: RECORDING_STATUS_VALUES, default: "NOT_RECORDED" },
      blockchain: {
        topicId: { type: String, trim: true, default: null },
        sequenceNumber: { type: Number, default: null },
        transactionId: { type: String, trim: true, default: null },
        consensusTimestamp: { type: String, trim: true, default: null }
      }
    },
    technicalInspection: {
      status: { type: String, enum: ["NOT_REQUESTED", "REQUESTED", "IN_PROGRESS", "COMPLETED", "TECHNICALLY_VERIFIED", "REJECTED"], default: "NOT_REQUESTED" },
      reviewStatus: { type: String, enum: ["NOT_SUBMITTED", "PENDING_REVIEW", "ADDITIONAL_EVIDENCE_REQUIRED", "APPROVED", "REJECTED"], default: "NOT_SUBMITTED" },
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      requestedAt: { type: Date, default: null },
      requestEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
      assignedRepairer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      requestDecision: {
        action: { type: String, enum: ["ASSIGN", "REJECT"], default: null },
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
        note: { type: String, trim: true, default: null }
      },
      performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      performedAt: { type: Date, default: null },
      inspectedAt: { type: Date, default: null },
      inspectedState: { type: String, trim: true, default: null },
      inspector: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      validity: {
        status: { type: String, enum: ["CURRENT", "AFFECTED", "HISTORICAL"], default: null },
        reason: { type: String, trim: true, default: null },
        affectedBy: [{ type: String, trim: true }],
        lastRelevantEventAt: { type: Date, default: null }
      },
      checklist: [{
        itemId: { type: String, required: true },
        category: { type: String, required: true },
        label: { type: String, required: true },
        status: { type: String, enum: ["PASS", "WARNING", "FAIL", "NOT_TESTED"], required: true },
        notes: { type: String, trim: true, default: null },
        evidenceReferences: [{ type: String, trim: true }]
      }],
      report: {
        summary: { type: String, trim: true, default: null },
        evidenceDocuments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
        evidenceHash: { type: String, trim: true, default: null }
      },
      signature: {
        value: { type: String, default: null, select: false },
        valid: { type: Boolean, default: null },
        algorithm: { type: String, trim: true, default: null },
        signer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        signedAt: { type: Date, default: null }
      },
      attestation: {
        verified: { type: Boolean, default: false },
        method: { type: String, enum: ["TRUSTPASS_AUTHENTICATED_SESSION"], default: null },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        attestedAt: { type: Date, default: null }
      },
      diagnosis: {
        decision: { type: String, enum: ["REPAIRABLE", "NOT_REPAIRABLE"], default: null },
        reason: { type: String, trim: true, default: null },
        repairer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        diagnosedAt: { type: Date, default: null },
        requestEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
        lifecycleEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
        evidenceDocuments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Document" }],
        evidenceHash: { type: String, trim: true, default: null },
        signatureValid: { type: Boolean, default: null },
        attestationVerified: { type: Boolean, default: false },
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
        }]
      },
      pendingLifecycleState: {
        type: { type: String, enum: ["END_OF_LIFE"], default: null },
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        requestedAt: { type: Date, default: null },
        reason: { type: String, trim: true, default: null },
        reviewRequired: { type: Boolean, default: false }
      },
      reviewDecision: {
        action: { type: String, enum: ["APPROVE", "REJECT", "REQUEST_EVIDENCE"], default: null },
        reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
        note: { type: String, trim: true, default: null }
      },
      previousLifecycleStatus: { type: String, enum: ["ACTIVE", "MAINTENANCE", "END_OF_LIFE", "LISTED_FOR_PARTS", "SOLD_FOR_PARTS", "RECYCLED", "DECOMMISSIONED"], default: null },
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      reviewedAt: { type: Date, default: null },
      reviewNote: { type: String, trim: true, default: null },
      approvalEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null }
    },

    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    status: {
      type: String,
      enum: ["ACTIVE", "MAINTENANCE", "END_OF_LIFE", "LISTED_FOR_PARTS", "SOLD_FOR_PARTS", "RECYCLED", "DECOMMISSIONED"],
      default: "ACTIVE"
    },

    hederaTokenId: { type: String, default: null, index: true },
    hederaSerialNumber: { type: Number, default: null },
    hederaMintTransactionId: { type: String, default: null },
    hederaStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "FAILED"],
      default: "PENDING"
    },
    hederaError: { type: String, default: null, select: false },
    hederaProof: {
      status: { type: String, enum: ["PENDING", "CONFIRMED", "FAILED"], default: "PENDING" },
      transactionId: { type: String, trim: true, default: null },
      topicId: { type: String, trim: true, default: null },
      sequenceNumber: { type: Number, default: null },
      consensusTimestamp: { type: String, trim: true, default: null },
      hash: { type: String, trim: true, default: null },
      schemaVersion: { type: Number, default: null },
      payload: { type: mongoose.Schema.Types.Mixed, default: null, select: false },
      reason: { type: String, trim: true, default: null },
      error: { type: String, default: null, select: false }
    },
    hederaProofHistory: { type: [mongoose.Schema.Types.Mixed], default: [], select: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
