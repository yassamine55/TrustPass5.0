const crypto = require("crypto");

function randomPart(length = 8) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString("hex").slice(0, length).toUpperCase();
}

function generatePassportId() {
  return `RLP-${new Date().getFullYear()}-${randomPart(7)}`;
}

function generateId(prefix) {
  return `${prefix}-${Date.now()}-${randomPart(5)}`;
}

module.exports = { generatePassportId, generateId };
