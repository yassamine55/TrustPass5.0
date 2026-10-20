const mongoose = require("mongoose");

const repairSchema = new mongoose.Schema(
  {
    repairId: { type: String, required: true, unique: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    repairer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    date: { type: Date, default: Date.now },
    description: { type: String, required: true, trim: true },
    changedParts: [{ type: String, trim: true }],
    price: { type: Number, min: 0 },
    invoice: { type: String, default: null },
    invoiceHash: { type: String, default: null },
    evidenceDocument: { type: mongoose.Schema.Types.ObjectId, ref: "Document", default: null },
    evidenceHash: { type: String, default: null },
    signature: { type: String, default: null },
    signatureValid: { type: Boolean, default: null },
    signatureError: { type: String, default: null, select: false },
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
