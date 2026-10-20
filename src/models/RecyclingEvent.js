const mongoose = require("mongoose");

const recyclingSchema = new mongoose.Schema(
  {
    recyclingId: { type: String, required: true, unique: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    center: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    condition: { type: String, trim: true },
    recoveredComponents: [{ type: String, trim: true }],
    proof: { type: String, default: null },
    lifecycleEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null },
    hederaStatus: { type: String, enum: ["PENDING", "CONFIRMED", "FAILED"], default: "PENDING" },
    hederaTopicId: { type: String, default: null },
    hederaSequenceNumber: { type: Number, default: null },
    hederaTransactionId: { type: String, default: null },
    hederaConsensusTimestamp: { type: String, default: null },
    hederaError: { type: String, default: null, select: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("RecyclingEvent", recyclingSchema);
