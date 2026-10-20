const TECHNICAL_LIFECYCLE_FIELDS = Object.freeze(new Set([
  "hederaStatus",
  "hederaTopicId",
  "hederaSequenceNumber",
  "hederaTransactionId",
  "hederaConsensusTimestamp",
  "hederaError",
  "recordHash",
  "updatedAt"
]));

const TECHNICAL_PROVENANCE_FIELDS = Object.freeze(new Set([
  "provenance.recordingStatus",
  "provenance.blockchain.topicId",
  "provenance.blockchain.sequenceNumber",
  "provenance.blockchain.transactionId",
  "provenance.blockchain.consensusTimestamp"
]));

function isTechnicalField(field) {
  return TECHNICAL_LIFECYCLE_FIELDS.has(field) || TECHNICAL_PROVENANCE_FIELDS.has(field);
}

function immutableError() {
  const error = new Error("Lifecycle events are immutable; create a correction, dispute, or revocation event");
  error.statusCode = 409;
  error.code = "LIFECYCLE_EVENT_IMMUTABLE";
  return error;
}

function assertLifecycleUpdateIsTechnical(update = {}) {
  const fields = [];
  for (const [key, value] of Object.entries(update)) {
    if (key.startsWith("$")) {
      if (value && typeof value === "object") fields.push(...Object.keys(value));
    } else {
      fields.push(key);
    }
  }
  if (fields.some((field) => !isTechnicalField(field))) throw immutableError();
}

function assertLifecycleEventCanBeDeleted() {
  throw immutableError();
}

function assertLifecycleDocumentSaveIsAllowed(document) {
  if (document.isNew) return;
  const paths = document.modifiedPaths({ includeChildren: true });
  const modifiedLeaves = paths.filter((path) => !paths.some((other) => other !== path && other.startsWith(`${path}.`)));
  if (modifiedLeaves.some((path) => !isTechnicalField(path))) throw immutableError();
}

module.exports = {
  TECHNICAL_LIFECYCLE_FIELDS,
  immutableError,
  assertLifecycleUpdateIsTechnical,
  assertLifecycleEventCanBeDeleted,
  assertLifecycleDocumentSaveIsAllowed
};
