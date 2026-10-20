const mongoose = require("mongoose");

const provenanceSchema = new mongoose.Schema({
  sourceType: { type: String, enum: ["OWNER", "REPAIRER", "MANUFACTURER", "DISTRIBUTOR"], default: "OWNER" },
  verificationLevel: { type: String, enum: ["OWNER_DECLARED", "REPAIRER_VERIFIED", "MANUFACTURER_VERIFIED", "DISTRIBUTOR_VERIFIED"], default: "OWNER_DECLARED" },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
  organizationName: { type: String, trim: true, default: null },
  evidenceAvailable: { type: Boolean, default: false },
  evidenceReference: { type: String, trim: true, default: null }
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
        "PURCHASED",
        "TRANSFERRED",
        "REPAIR",
        "MAINTENANCE",
        "MANUFACTURER_VERIFIED",
        "DISTRIBUTOR_VERIFIED",
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

module.exports = mongoose.model("LifecycleEvent", lifecycleEventSchema);
