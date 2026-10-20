const crypto = require("node:crypto");

const IGNORED_KEYS = new Set([
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "recordHash",
  "hederaStatus",
  "hederaTopicId",
  "hederaSequenceNumber",
  "hederaTransactionId",
  "hederaConsensusTimestamp",
  "hederaError",
]);

const IGNORED_PROVENANCE_KEYS = new Set(["blockchain", "recordingStatus"]);

function toPlainRecord(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((entry) => toPlainRecord(entry));
  if (typeof value === "object") {
    if (typeof value.toObject === "function") {
      return toPlainRecord(value.toObject({ depopulate: true, virtuals: false }));
    }
    if (value.constructor && value.constructor.name === "ObjectId") {
      return value.toString();
    }
    const next = {};
    for (const key of Object.keys(value).sort()) {
      if (IGNORED_KEYS.has(key)) continue;
      if (key === "provenance" && value.provenance && typeof value.provenance === "object") {
        next[key] = toPlainRecord(stripIgnoredProvenance(value.provenance));
        continue;
      }
      next[key] = toPlainRecord(value[key]);
    }
    return next;
  }
  return value;
}

function stripIgnoredProvenance(provenance) {
  const next = {};
  for (const key of Object.keys(provenance).sort()) {
    if (IGNORED_PROVENANCE_KEYS.has(key)) continue;
    next[key] = provenance[key];
  }
  return next;
}

function canonicalizeRecord(value) {
  const plain = toPlainRecord(value);
  return stableStringify(plain);
}

function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    const serialized = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${serialized.join(",")}}`;
  }
  return JSON.stringify(value);
}

function secureHexEqual(expected, actual) {
  if (typeof expected !== "string" || typeof actual !== "string") return false;
  if (expected.length !== actual.length) return false;
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(actual, "hex");
  try {
    return crypto.timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function computeLifecycleRecordHash(record) {
  const canonical = canonicalizeRecord(record);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function verifyLifecycleRecordHash({ currentRecord, hcsMessageText }) {
  if (typeof hcsMessageText !== "string" || hcsMessageText.trim().length === 0) {
    return {
      valid: false,
      status: "HCS_RECORD_NOT_FOUND",
      reason: "HCS message was not found",
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(hcsMessageText);
  } catch {
    return {
      valid: false,
      status: "INVALID_HCS_PAYLOAD",
      reason: "HCS message is not valid JSON",
    };
  }

  if (!parsed || typeof parsed !== "object" || parsed.protocolVersion !== 1) {
    return {
      valid: false,
      status: "INVALID_HCS_PAYLOAD",
      reason: "HCS payload is missing the required protocol version",
    };
  }

  const expectedHash = typeof parsed.recordHash === "string" ? parsed.recordHash : null;
  if (!expectedHash || !/^[a-f0-9]{64}$/i.test(expectedHash)) {
    return {
      valid: false,
      status: "INVALID_HCS_PAYLOAD",
      reason: "HCS payload is missing a valid recordHash",
    };
  }

  const actualHash = computeLifecycleRecordHash(currentRecord);
  const match = secureHexEqual(actualHash, expectedHash);

  return match
    ? {
        valid: true,
        status: "HASH_MATCH",
        actualHash,
        expectedHash,
      }
    : {
        valid: false,
        status: "HASH_MISMATCH",
        actualHash,
        expectedHash,
        reason: "Stored event hash does not match the current canonical record",
      };
}

module.exports = {
  computeLifecycleRecordHash,
  verifyLifecycleRecordHash,
  secureHexEqual,
};
