const fs = require("fs");
const path = require("path");
const { uploadDir } = require("../config/env");

const DEVICE_PHOTO_ROOT = "device-photos";
const LEGACY_UPLOAD_ROOT = "uploads";
const LEGACY_UPLOAD_DIRS = [
  path.resolve(uploadDir, LEGACY_UPLOAD_ROOT),
  path.resolve(process.cwd(), "backend", LEGACY_UPLOAD_ROOT)
];

function normalizeDevicePhotoRef(value) {
  if (typeof value !== "string") return null;

  const cleaned = value.trim().replace(/\\/g, "/");
  if (!cleaned || /^https?:\/\//i.test(cleaned) || cleaned.startsWith("data:")) return null;

  const relative = cleaned.replace(/^\/+/, "");
  if (!relative || relative.includes("..")) return null;

  const legacyAliasMatch = relative.match(/^devicePhoto\/(.+)$/i);
  if (legacyAliasMatch) return `${DEVICE_PHOTO_ROOT}/${legacyAliasMatch[1]}`;

  const deviceMatch = relative.match(/^device-photos\/([A-Za-z0-9._-]+)$/);
  if (deviceMatch) return `${DEVICE_PHOTO_ROOT}/${deviceMatch[1]}`;

  const legacyMatch = relative.match(/^uploads\/([A-Za-z0-9._-]+)$/);
  if (legacyMatch) return `${DEVICE_PHOTO_ROOT}/${legacyMatch[1]}`;

  return null;
}

function isAllowedPublicPhotoRef(value) {
  return Boolean(normalizeDevicePhotoRef(value));
}

function resolvePublicDevicePhotoPath(value) {
  const normalized = normalizeDevicePhotoRef(value);
  if (!normalized) {
    throw new Error("Invalid device photo reference");
  }

  const photoRoot = path.resolve(uploadDir, DEVICE_PHOTO_ROOT);
  const fileName = normalized.replace(/^device-photos\//, "");
  const resolved = path.resolve(photoRoot, fileName);

  if (!resolved.startsWith(photoRoot)) {
    throw new Error("Device photo path is not allowed");
  }

  if (!fs.existsSync(resolved)) {
    for (const legacyDir of LEGACY_UPLOAD_DIRS) {
      const legacyResolved = path.resolve(legacyDir, fileName);
      if (legacyResolved.startsWith(legacyDir) && fs.existsSync(legacyResolved)) {
        fs.mkdirSync(photoRoot, { recursive: true });
        fs.copyFileSync(legacyResolved, resolved);
        return resolved;
      }
    }
    throw new Error("Device photo file not found");
  }

  return resolved;
}

function getDevicePhotoMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const map = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp"
  };
  return map[extension] || "application/octet-stream";
}

module.exports = {
  DEVICE_PHOTO_ROOT,
  LEGACY_UPLOAD_ROOT,
  normalizeDevicePhotoRef,
  isAllowedPublicPhotoRef,
  resolvePublicDevicePhotoPath,
  getDevicePhotoMimeType
};
