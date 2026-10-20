const mongoose = require("mongoose");

const repairVerificationRequestSchema = new mongoose.Schema({
  repair: { type: mongoose.Schema.Types.ObjectId, ref: "Repair", required: true, unique: true, index: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetRepairerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  status: { type: String, enum: ["PENDING", "ACCEPTED", "REJECTED"], default: "PENDING", index: true },
  responseNote: { type: String, trim: true, default: null },
  respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  respondedAt: { type: Date, default: null },
  responseEvent: { type: mongoose.Schema.Types.ObjectId, ref: "LifecycleEvent", default: null }
}, { timestamps: true });

module.exports = mongoose.model("RepairVerificationRequest", repairVerificationRequestSchema);