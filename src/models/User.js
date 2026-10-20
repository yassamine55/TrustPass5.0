const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },

    role: {
      type: String,
      enum: ["OWNER", "REPAIRER", "BUYER", "ADMIN"],
      default: "OWNER"
    },

    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
    hederaAccountId: { type: String, default: null, trim: true }
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
