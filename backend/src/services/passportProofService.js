const Product = require("../models/Product");
const Repair = require("../models/Repair");
const { buildPassportHashPayload, computePassportHash, PASSPORT_HASH_SCHEMA_VERSION } = require("../utils/passportHash");
const { publishPassportHash } = require("./hederaLifecyclePublisher");

async function loadCurrentPayload(product) {
  const repairs = await Repair.find({ product: product._id })
    .select("repairId date description changedParts price claimant repairer evidenceHash invoiceHash signatureValid verificationDecision provenance.verificationStatus ownerConfirmation.status")
    .lean();
  return buildPassportHashPayload(product, repairs);
}

async function anchorPassportRevision(product, reason) {
  const current = await Product.findById(product._id)
    .select("+hederaProof.payload +hederaProofHistory");
  if (!current) throw new Error(`Passport ${product.passportId} was not found while anchoring a revision`);

  const payload = await loadCurrentPayload(current);
  const hash = computePassportHash(payload);
  if (current.hederaProof?.status === "CONFIRMED" &&
    current.hederaProof.schemaVersion === PASSPORT_HASH_SCHEMA_VERSION &&
    current.hederaProof.hash === hash) {
    return current.hederaProof;
  }
  const proof = await publishPassportHash(current, hash);
  const previousProof = current.hederaProof?.toObject
    ? current.hederaProof.toObject()
    : current.hederaProof;

  if (previousProof?.status === "CONFIRMED" && previousProof.transactionId) {
    current.hederaProofHistory.push({
      ...previousProof,
      schemaVersion: previousProof.schemaVersion || null,
      reason: previousProof.reason || "Initial passport proof",
      archivedAt: new Date()
    });
  }

  current.hederaProof = {
    ...proof,
    hash,
    schemaVersion: PASSPORT_HASH_SCHEMA_VERSION,
    payload,
    reason
  };
  await current.save();
  return current.hederaProof;
}

async function anchorPassportRevisionSafely(product, reason) {
  try {
    return await anchorPassportRevision(product, reason);
  } catch (error) {
    console.error(`[hedera] passport revision anchoring failed for ${product.passportId}:`, error);
    return null;
  }
}

module.exports = { anchorPassportRevision, anchorPassportRevisionSafely, loadCurrentPayload };
