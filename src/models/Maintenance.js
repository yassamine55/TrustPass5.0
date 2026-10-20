const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema(
  {
    maintenanceId: { type: String, required: true, unique: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, default: Date.now },
    description: { type: String, required: true, trim: true },
    document: { type: String, default: null },
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

module.exports = mongoose.model("Maintenance", maintenanceSchema);
