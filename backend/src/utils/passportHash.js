const crypto = require("crypto");

const PASSPORT_HASH_SCHEMA_VERSION = 2;

function idString(value) {
  if (value == null) return null;
  const id = value._id ?? value;
  return typeof id?.toString === "function" ? id.toString() : String(id);
}

function isoDate(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Passport dates must be valid");
  return date.toISOString();
}

function toPlainObject(value) {
  return value?.toObject
    ? value.toObject({ depopulate: true, getters: false, virtuals: false })
    : value || {};
}

function buildPassportHashPayload(passport, repairs = []) {
  if (!passport || typeof passport !== "object") {
    throw new TypeError("A passport object is required to build its hash payload");
  }

  const product = toPlainObject(passport);
  const inspection = product.technicalInspection || {};
  const recordedInspection = Array.isArray(inspection.checklist) && inspection.checklist.length > 0
    ? {
        approved: inspection.status === "TECHNICALLY_VERIFIED" &&
          inspection.reviewStatus === "APPROVED",
        inspectedAt: isoDate(inspection.inspectedAt || inspection.performedAt),
        inspectedState: inspection.inspectedState || null,
        inspector: idString(inspection.inspector || inspection.performedBy),
        checklist: (inspection.checklist || [])
          .map((item) => ({
            itemId: item.itemId,
            status: item.status,
            notes: item.notes || null,
            evidenceReferences: [...(item.evidenceReferences || [])].sort()
          }))
          .sort((left, right) => left.itemId.localeCompare(right.itemId)),
        report: {
          summary: inspection.report?.summary || null,
          evidenceHash: inspection.report?.evidenceHash || null
        },
        diagnosis: inspection.diagnosis?.decision
          ? {
              decision: inspection.diagnosis.decision,
              reason: inspection.diagnosis.reason || null,
              evidenceHash: inspection.diagnosis.evidenceHash || null
            }
          : null
      }
    : null;

  return {
    schemaVersion: PASSPORT_HASH_SCHEMA_VERSION,
    passport: {
      passportId: product.passportId,
      brand: product.brand,
      model: product.model,
      serialNumberHash: product.serialNumberHash,
      imeiHash: product.imeiHash || null,
      manufacturer: product.manufacturer || null,
      manufactureDate: isoDate(product.manufactureDate),
      purchaseDate: isoDate(product.purchaseDate),
      category: product.category
    },
    technicalVerification: recordedInspection,
    repairs: repairs
      .map((repair) => {
        const value = toPlainObject(repair);
        return {
          repairId: value.repairId,
          date: isoDate(value.date),
          description: value.description,
          changedParts: [...(value.changedParts || [])].sort(),
          price: value.price ?? null,
          claimant: idString(value.claimant),
          repairer: idString(value.repairer),
          evidenceHash: value.evidenceHash || value.invoiceHash || null,
          signatureValid: value.signatureValid ?? null,
          verificationStatus: value.provenance?.verificationStatus || null,
          verificationDecision: value.verificationDecision || "UNREVIEWED",
          ownerConfirmation: value.ownerConfirmation?.status || "PENDING"
        };
      })
      .sort((left, right) => left.repairId.localeCompare(right.repairId))
  };
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function computePassportHash(payloadOrPassport, repairs = []) {
  const payload = payloadOrPassport?.schemaVersion === PASSPORT_HASH_SCHEMA_VERSION &&
    payloadOrPassport?.passport
    ? payloadOrPassport
    : buildPassportHashPayload(payloadOrPassport, repairs);
  return crypto.createHash("sha256").update(canonicalize(payload), "utf8").digest("hex");
}

module.exports = {
  PASSPORT_HASH_SCHEMA_VERSION,
  buildPassportHashPayload,
  computePassportHash
};
