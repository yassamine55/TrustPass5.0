const mongoose = require("mongoose");

const transferSchema = new mongoose.Schema(
  {
    transferId: { type: String, required: true, unique: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    fromOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    toOwner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED"],
      default: "PENDING"
    },
    requestedAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date, default: null },
    hederaStatus: {
      type: String,
      enum: ["PENDING", "CONFIRMED", "FAILED"],
      default: "PENDING"
    },
    hederaTransactionId: { type: String, default: null },
    hederaError: { type: String, default: null, select: false },
    viaMarketplace: { type: Boolean, default: false },
    price: { type: Number, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Transfer", transferSchema);
