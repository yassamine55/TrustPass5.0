const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { uploadDir } = require("../config/env");

const createStorage = (subdir = "") => {
  const destination = subdir ? path.resolve(uploadDir, subdir) : path.resolve(uploadDir);
  fs.mkdirSync(destination, { recursive: true });

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, destination),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}-${safeName}`);
    }
  });
};

const allowedMimeTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
];

const upload = multer({
  storage: createStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Only PDF, JPG, PNG and WEBP files are allowed"));
    }
    cb(null, true);
  }
});

const devicePhotoUpload = multer({
  storage: createStorage("device-photos"),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      return cb(new Error("Only JPG, PNG and WEBP images are allowed for device photos"));
    }
    cb(null, true);
  }
});

module.exports = upload;
module.exports.devicePhotoUpload = devicePhotoUpload;
