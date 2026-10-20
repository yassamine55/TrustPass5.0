const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    passportId: { type: String, required: true, unique: true, index: true },

    brand: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    serialNumberHash: { type: String, required: true, trim: true },
    manufacturer: { type: String, trim: true },
    manufactureDate: { type: Date },
    category: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    photo: { type: String, default: null },

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
    hederaError: { type: String, default: null, select: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
