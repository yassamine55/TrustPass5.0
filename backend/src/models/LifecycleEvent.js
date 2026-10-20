const mongoose = require("mongoose");
const {
  PROVENANCE_LEVEL_VALUES,
  PROVENANCE_SOURCE_VALUES,
  INSTITUTION_TYPE_VALUES,
  EVIDENCE_INTEGRITY_STATUS_VALUES,
  VERIFICATION_STATUS_VALUES,
  RECORDING_STATUS_VALUES,
  PROVENANCE_LEVELS,
  PROVENANCE_SOURCES,
  EVIDENCE_INTEGRITY_STATUSES
} = require("../domain/provenance");
const {
  assertLifecycleUpdateIsTechnical,
  assertLifecycleEventCanBeDeleted,
  assertLifecycleDocumentSaveIsAllowed
} = require("../domain/lifecycleImmutability");

const provenanceSchema = new mongoose.Schema({
  claimType: { type: String, trim: true, default: null },
  source: {
    type: {
      type: String,
      enum: PROVENANCE_SOURCE_VALUES,
      default: PROVENANCE_SOURCES.OWNER
    },
    role: { type: String, trim: true, default: null },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  verificationStatus: { type: String, enum: VERIFICATION_STATUS_VALUES, default: "OWNER_DECLARED" },
  verificationLevel: {
    type: String,
    enum: PROVENANCE_LEVEL_VALUES,
    default: PROVENANCE_LEVELS.OWNER_REPORTED
  },
  verificationSource: { type: String, enum: ["DEMO_TEST", "EXTERNAL_VERIFICATION"], default: "DEMO_TEST" },
  externalSystemConnected: { type: Boolean, default: false },
  institutionType: { type: String, enum: INSTITUTION_TYPE_VALUES, default: null },
  evidence: {
    available: { type: Boolean, default: false },
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    reference: { type: String, trim: true, default: null },
    references: [{ type: String, trim: true }],
    hash: { type: String, trim: true, default: null },
    integrityStatus: {
      type: String,
      enum: EVIDENCE_INTEGRITY_STATUS_VALUES,
      default: EVIDENCE_INTEGRITY_STATUSES.UNKNOWN
    }
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

const lifecycleEventSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    sourceRef: { type: String, unique: true, sparse: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    type: {
      type: String,
      enum: [
        "PRODUCT_CREATED",
        "STOLEN_REPORTED",
        "INSPECTION_REQUESTED",
        "TECHNICAL_INSPECTION_APPROVED",
        "TECHNICAL_INSPECTION_REJECTED",
        "TECHNICAL_INSPECTION_EVIDENCE_REQUESTED",
        "PURCHASED",
        "TRANSFERRED",
        "REPAIR",
        "REPAIR_CLAIM_SUBMITTED",
        "REPAIR_CLAIM_REJECTED",
        "REPAIR_PROFESSIONALLY_ATTESTED",
        "REPAIR_OWNER_CONFIRMED",
        "REPAIR_OWNER_DISPUTED",
        "REPAIR_OWNER_REJECTED",
        "INSTITUTION_VERIFIED",
        "INSTITUTION_REJECTED",
        "EVENT_DISPUTED",
        "EVENT_CORRECTED",
        "EVENT_REVOKED",
        "MAINTENANCE",
        "RESALE",
        "END_OF_LIFE",
        "LISTED_FOR_PARTS",
        "SOLD_FOR_PARTS",
        "RECYCLED",
        "DECOMMISSIONED"
      ],
      required: true
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    description: { type: String, trim: true },
    document: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    hash: { type: String, default: null },
    recordHash: { type: String, default: null, index: true },
    relatedEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
    verificationRequest: { type: mongoose.Schema.Types.ObjectId, ref: "VerificationRequest", default: null },
    provenance: { type: provenanceSchema, default: () => ({}) },
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

lifecycleEventSchema.pre("save", function (next) {
  try {
    assertLifecycleDocumentSaveIsAllowed(this);
    next();
  } catch (error) {
    next(error);
  }
});

lifecycleEventSchema.pre(["findOneAndUpdate", "updateOne", "replaceOne"], function (next) {
  try {
    assertLifecycleUpdateIsTechnical(this.getUpdate());
    next();
  } catch (error) {
    next(error);
  }
});

lifecycleEventSchema.pre(["deleteOne", "deleteMany", "findOneAndDelete"], function (next) {
  try {
    assertLifecycleEventCanBeDeleted();
  } catch (error) {
    next(error);
  }
});

lifecycleEventSchema.pre("deleteOne", { document: true, query: false }, function (next) {
  try {
    assertLifecycleEventCanBeDeleted();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model("LifecycleEvent", lifecycleEventSchema);
