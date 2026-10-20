const PROVENANCE_LEVELS = Object.freeze({
  OWNER_REPORTED: "OWNER_REPORTED",
  EVIDENCE_PROVIDED: "EVIDENCE_PROVIDED",
  REPAIRER_VERIFIED: "REPAIRER_VERIFIED",
  INSTITUTION_VERIFIED: "INSTITUTION_VERIFIED"
});

const TRUST_STATUSES = Object.freeze({
  OWNER_DECLARED: "OWNER_DECLARED",
  EVIDENCE_SUBMITTED: "EVIDENCE_SUBMITTED",
  PROFESSIONALLY_ATTESTED: "PROFESSIONALLY_ATTESTED",
  TECHNICALLY_VERIFIED: "TECHNICALLY_VERIFIED",
  INSTITUTION_VERIFIED: "INSTITUTION_VERIFIED",
  BLOCKCHAIN_RECORDED: "BLOCKCHAIN_RECORDED"
});

const VERIFICATION_STATUS_VALUES = Object.freeze([
  TRUST_STATUSES.OWNER_DECLARED,
  TRUST_STATUSES.EVIDENCE_SUBMITTED,
  TRUST_STATUSES.PROFESSIONALLY_ATTESTED,
  TRUST_STATUSES.TECHNICALLY_VERIFIED,
  TRUST_STATUSES.INSTITUTION_VERIFIED
]);

const RECORDING_STATUS = Object.freeze({
  NOT_RECORDED: "NOT_RECORDED",
  BLOCKCHAIN_RECORDED: TRUST_STATUSES.BLOCKCHAIN_RECORDED
});

const RECORDING_STATUS_VALUES = Object.freeze(Object.values(RECORDING_STATUS));

const PROVENANCE_SOURCES = Object.freeze({
  OWNER: "OWNER",
  REPAIRER: "REPAIRER",
  INSTITUTION: "INSTITUTION"
});

const INSTITUTION_TYPES = Object.freeze({
  MANUFACTURER: "MANUFACTURER",
  AUTHORIZED_SERVICE_CENTER: "AUTHORIZED_SERVICE_CENTER",
  CERTIFIED_RECYCLER: "CERTIFIED_RECYCLER"
});

const EVIDENCE_INTEGRITY_STATUSES = Object.freeze({
  UNKNOWN: "UNKNOWN",
  UNVERIFIED: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED"
});

const PROVENANCE_LEVEL_VALUES = Object.freeze(Object.values(PROVENANCE_LEVELS));
const PROVENANCE_SOURCE_VALUES = Object.freeze(Object.values(PROVENANCE_SOURCES));
const INSTITUTION_TYPE_VALUES = Object.freeze(Object.values(INSTITUTION_TYPES));
const EVIDENCE_INTEGRITY_STATUS_VALUES = Object.freeze(Object.values(EVIDENCE_INTEGRITY_STATUSES));

function sourceTypeForActor(actor) {
  if (actor?.role === "REPAIRER") return PROVENANCE_SOURCES.REPAIRER;
  if (actor?.role === "ADMIN" && actor?.company) return PROVENANCE_SOURCES.INSTITUTION;
  return PROVENANCE_SOURCES.OWNER;
}

function createProvenance({
  actor,
  claimType = null,
  sourceType,
  sourceRole,
  verificationStatus,
  verificationLevel = PROVENANCE_LEVELS.OWNER_REPORTED,
  institutionType = null,
  documentId = null,
  evidenceReference = null,
  evidenceReferences = [],
  integrityStatus = EVIDENCE_INTEGRITY_STATUSES.UNKNOWN,
  verifier = null,
  signature = null,
  evidenceHash = null,
  recordingStatus = RECORDING_STATUS.NOT_RECORDED,
  blockchain = null,
  dispute = null,
  verifiedAt = null
} = {}) {
  if (!actor?._id) throw new Error("Provenance actor is required");
  const resolvedSourceType = sourceType || sourceTypeForActor(actor);
  const evidenceAvailable = Boolean(documentId || evidenceReference);

  if (!PROVENANCE_SOURCE_VALUES.includes(resolvedSourceType)) {
    throw new Error("Invalid provenance source type");
  }
  if (!PROVENANCE_LEVEL_VALUES.includes(verificationLevel)) {
    throw new Error("Invalid provenance verification level");
  }
  if (institutionType !== null && !INSTITUTION_TYPE_VALUES.includes(institutionType)) {
    throw new Error("Invalid provenance institution type");
  }
  if (verificationLevel === PROVENANCE_LEVELS.EVIDENCE_PROVIDED && !evidenceAvailable) {
    throw new Error("Evidence is required for EVIDENCE_PROVIDED provenance");
  }
  if (verificationLevel === PROVENANCE_LEVELS.REPAIRER_VERIFIED && resolvedSourceType !== PROVENANCE_SOURCES.REPAIRER) {
    throw new Error("REPAIRER_VERIFIED provenance requires a repairer source");
  }
  if (verificationLevel === PROVENANCE_LEVELS.INSTITUTION_VERIFIED &&
    (resolvedSourceType !== PROVENANCE_SOURCES.INSTITUTION || !institutionType || !verifiedAt)) {
    throw new Error("INSTITUTION_VERIFIED provenance requires an institution source, type, and verification date");
  }
  if (!EVIDENCE_INTEGRITY_STATUS_VALUES.includes(integrityStatus)) {
    throw new Error("Invalid evidence integrity status");
  }

  const resolvedVerificationStatus = verificationStatus || (
    verificationLevel === PROVENANCE_LEVELS.REPAIRER_VERIFIED || verificationLevel === PROVENANCE_LEVELS.INSTITUTION_VERIFIED
      ? TRUST_STATUSES.PROFESSIONALLY_ATTESTED
      : verificationLevel === PROVENANCE_LEVELS.EVIDENCE_PROVIDED
        ? TRUST_STATUSES.EVIDENCE_SUBMITTED
        : evidenceAvailable
          ? TRUST_STATUSES.EVIDENCE_SUBMITTED
        : TRUST_STATUSES.OWNER_DECLARED
  );
  if (!VERIFICATION_STATUS_VALUES.includes(resolvedVerificationStatus)) {
    throw new Error("Invalid verification status");
  }
  if (!RECORDING_STATUS_VALUES.includes(recordingStatus)) {
    throw new Error("Invalid recording status");
  }
  if (resolvedVerificationStatus === TRUST_STATUSES.PROFESSIONALLY_ATTESTED && resolvedSourceType !== PROVENANCE_SOURCES.REPAIRER && resolvedSourceType !== PROVENANCE_SOURCES.INSTITUTION) {
    throw new Error("PROFESSIONALLY_ATTESTED provenance requires a professional verifier");
  }
  if (resolvedVerificationStatus === TRUST_STATUSES.TECHNICALLY_VERIFIED && resolvedSourceType !== PROVENANCE_SOURCES.REPAIRER) {
    throw new Error("TECHNICALLY_VERIFIED provenance requires a repairer source");
  }

  return {
    claimType,
    source: { type: resolvedSourceType, role: sourceRole || actor.role, actorId: actor._id },
    verificationStatus: resolvedVerificationStatus,
    verificationLevel,
    verificationSource: sourceRole === "EXTERNAL_VERIFICATION" || actor?.verificationSource === "EXTERNAL_VERIFICATION" ? "EXTERNAL_VERIFICATION" : "DEMO_TEST",
    externalSystemConnected: sourceRole === "EXTERNAL_VERIFICATION" || actor?.verificationSource === "EXTERNAL_VERIFICATION",
    institutionType,
    evidence: {
      available: evidenceAvailable,
      documentId,
      reference: evidenceReference,
      references: evidenceReferences,
      hash: evidenceHash,
      integrityStatus: evidenceAvailable ? integrityStatus : EVIDENCE_INTEGRITY_STATUSES.UNKNOWN
    },
    verifier: verifier ? {
      actorId: verifier.actorId || verifier._id || null,
      role: verifier.role || null,
      verifiedAt: verifier.verifiedAt || verifiedAt || null
    } : null,
    signature: signature ? {
      status: signature.status || (signature.valid === true ? "VALID" : signature.valid === false ? "INVALID" : "NOT_PROVIDED"),
      algorithm: signature.algorithm || null,
      signerId: signature.signerId || null
    } : { status: "NOT_PROVIDED", algorithm: null, signerId: null },
    recordingStatus,
    blockchain: blockchain ? {
      topicId: blockchain.topicId || null,
      sequenceNumber: blockchain.sequenceNumber ?? null,
      transactionId: blockchain.transactionId || null,
      consensusTimestamp: blockchain.consensusTimestamp || null
    } : null,
    dispute: dispute ? {
      status: dispute.status || "NONE",
      relatedEventId: dispute.relatedEventId || null,
      reason: dispute.reason || null,
      recordedAt: dispute.recordedAt || null
    } : { status: "NONE", relatedEventId: null, reason: null, recordedAt: null },
    verifiedAt: verifiedAt || null
  };
}

module.exports = {
  PROVENANCE_LEVELS,
  TRUST_STATUSES,
  VERIFICATION_STATUS_VALUES,
  RECORDING_STATUS,
  RECORDING_STATUS_VALUES,
  PROVENANCE_SOURCES,
  INSTITUTION_TYPES,
  EVIDENCE_INTEGRITY_STATUSES,
  PROVENANCE_LEVEL_VALUES,
  PROVENANCE_SOURCE_VALUES,
  INSTITUTION_TYPE_VALUES,
  EVIDENCE_INTEGRITY_STATUS_VALUES,
  createProvenance,
  sourceTypeForActor
};
