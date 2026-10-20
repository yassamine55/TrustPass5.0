const crypto = require("node:crypto");

function stableStringify(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashClaim(claim) {
  const canonical = stableStringify(claim);
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function makeClaim({ id, type, subject, value, assertion, actorId, actorRole, timestamp, evidenceReferences = [] }) {
  const claim = {
    id,
    type,
    subject,
    value,
    assertion,
    actorId: actorId || null,
    actorRole: actorRole || null,
    timestamp: timestamp || new Date().toISOString(),
    evidenceReferences: Array.isArray(evidenceReferences) ? evidenceReferences.filter(Boolean) : [],
  };
  claim.hash = hashClaim(claim);
  return claim;
}

function deriveRepairClaims({
  description,
  changedParts = [],
  evidenceDocumentId = null,
  actorId = null,
  actorRole = null,
  timestamp = new Date().toISOString()
} = {}) {
  const evidenceReferences = evidenceDocumentId ? [String(evidenceDocumentId)] : [];
  const claims = [];

  const repairClaim = makeClaim({
    id: `claim-repair-${String(description || "repair").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "repair"}-${hashClaim({ description, changedParts, evidenceDocumentId, actorId, actorRole, timestamp }).slice(0, 12)}`,
    type: "REPAIR",
    subject: "device",
    value: "REPAIR",
    assertion: description || "Repair was recorded",
    actorId,
    actorRole,
    timestamp,
    evidenceReferences
  });
  claims.push(repairClaim);

  for (const part of Array.isArray(changedParts) ? changedParts : []) {
    const cleaned = String(part || "").trim();
    if (!cleaned) continue;
    claims.push(makeClaim({
      id: `claim-part-${cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${hashClaim({ part: cleaned, actorId, timestamp }).slice(0, 12)}`,
      type: "PART_REPLACED",
      subject: cleaned.toLowerCase(),
      value: "REPLACED",
      assertion: `${cleaned} was replaced`,
      actorId,
      actorRole,
      timestamp,
      evidenceReferences
    }));
  }

  return claims;
}

function deriveInspectionClaims({
  checklist = [],
  summary = "",
  decision = null,
  reason = null,
  inspectorId = null,
  evidenceDocuments = [],
  timestamp = new Date().toISOString()
} = {}) {
  const claims = [];

  for (const item of checklist) {
    const itemId = String(item?.itemId || "").trim();
    const value = String(item?.status || "").trim();
    if (!itemId || !value) continue;
    claims.push(makeClaim({
      id: `claim-inspection-${itemId}-${value.toLowerCase()}-${hashClaim({ itemId, value, timestamp }).slice(0, 12)}`,
      type: "INSPECTION_ITEM",
      subject: itemId,
      value,
      assertion: `${item?.label || itemId} was recorded as ${value}`,
      actorId: inspectorId,
      actorRole: "REPAIRER",
      timestamp,
      evidenceReferences: Array.isArray(evidenceDocuments) ? evidenceDocuments.map(String) : []
    }));
  }

  if (decision || summary || reason) {
    claims.push(makeClaim({
      id: `claim-inspection-decision-${hashClaim({ decision, reason, summary, timestamp }).slice(0, 12)}`,
      type: "INSPECTION_DECISION",
      subject: "device",
      value: decision || "UNKNOWN",
      assertion: reason || summary || "Inspection decision recorded",
      actorId: inspectorId,
      actorRole: "REPAIRER",
      timestamp,
      evidenceReferences: Array.isArray(evidenceDocuments) ? evidenceDocuments.map(String) : []
    }));
  }

  return claims;
}

module.exports = {
  deriveRepairClaims,
  deriveInspectionClaims,
  hashClaim,
  stableStringify,
};
