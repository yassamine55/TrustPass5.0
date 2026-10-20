const { PROVENANCE_LEVELS } = require("./provenance");

function repairProvenanceLevel({ signatureValid, evidenceAvailable }) {
  if (signatureValid === true) return PROVENANCE_LEVELS.REPAIRER_VERIFIED;
  if (evidenceAvailable) return PROVENANCE_LEVELS.EVIDENCE_PROVIDED;
  return PROVENANCE_LEVELS.OWNER_REPORTED;
}

function ownerConfirmationEventType(confirmed) {
  return confirmed ? "REPAIR_OWNER_CONFIRMED" : "REPAIR_OWNER_DISPUTED";
}

function assertRepairOwner({ user, product }) {
  if (!user || user.role !== "OWNER" || !product?.owner || product.owner.toString() !== user._id.toString()) {
    const error = new Error("Only the device owner can confirm or reject a repair");
    error.statusCode = 403;
    error.code = "REPAIR_OWNER_CONFIRMATION_FORBIDDEN";
    throw error;
  }
}

module.exports = { repairProvenanceLevel, ownerConfirmationEventType, assertRepairOwner };
