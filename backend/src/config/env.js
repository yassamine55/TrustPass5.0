const path = require("path");
const dotenv = require("dotenv");

dotenv.config();
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
}

const required = ["MONGO_URI", "JWT_SECRET"];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing environment variable: ${key}`);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}

module.exports = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  jwtIssuer: process.env.JWT_ISSUER || "reloop-passport-api",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
  uploadDir: process.env.UPLOAD_DIR || "uploads",
  hederaEnabled: process.env.HEDERA_ENABLED === "true"
};
