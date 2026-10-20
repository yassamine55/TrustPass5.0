const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    originalName: { type: String, required: true },
    storedName: { type: String, required: true },
    path: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    sha256: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Document", documentSchema);
