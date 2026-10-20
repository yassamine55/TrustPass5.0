const mongoose = require("mongoose");
const { INSTITUTION_TYPE_VALUES } = require("../domain/provenance");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    type: {
      type: String,
      enum: INSTITUTION_TYPE_VALUES,
      default: "AUTHORIZED_SERVICE_CENTER"
    },
    status: {
      type: String,
      enum: ["PENDING", "VERIFIED", "SUSPENDED"],
      default: "PENDING"
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Company", companySchema);
