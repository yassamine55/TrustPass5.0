const { getHederaModule } = require("./hederaModule");
const { PROVENANCE_LEVELS, PROVENANCE_SOURCES, EVIDENCE_INTEGRITY_STATUSES, TRUST_STATUSES } = require("../domain/provenance");
const { computeLifecycleRecordHash } = require("../hedera/verification/lifecycleRecordIntegrity.js");

const EVENT_TYPES = new Set([
  "PRODUCT_CREATED",
  "STOLEN_REPORTED",
  "INSPECTION_REQUESTED",
  "TECHNICAL_INSPECTION_APPROVED",
  "TECHNICAL_INSPECTION_REJECTED",
  "TECHNICAL_INSPECTION_EVIDENCE_REQUESTED",
  "PURCHASED",
  "TRANSFERRED",
  "REPAIR",
  "REPAIR_CLAIM_SUBMITTED",
  "REPAIR_CLAIM_REJECTED",
  "REPAIR_PROFESSIONALLY_ATTESTED",
  "REPAIR_OWNER_CONFIRMED",
  "REPAIR_OWNER_DISPUTED",
  "REPAIR_OWNER_REJECTED",
  "INSTITUTION_VERIFIED",
  "INSTITUTION_REJECTED",
  "EVENT_DISPUTED",
  "EVENT_CORRECTED",
  "EVENT_REVOKED",
  "MAINTENANCE",
  "RESALE",
  "END_OF_LIFE",
  "LISTED_FOR_PARTS",
  "SOLD_FOR_PARTS",
  "RECYCLED",
  "DECOMMISSIONED"
]);

function resolveHedera(override) {
  return override === undefined ? getHederaModule() : override;
}

async function publishPassportHash(product, hash, hederaOverride) {
  const reference = {
    status: "PENDING",
    transactionId: null,
    topicId: null,
    sequenceNumber: null,
    consensusTimestamp: null,
    hash,
    error: null
  };

  try {
    const hedera = resolveHedera(hederaOverride);
    if (!hedera) return { ...reference, status: "FAILED", error: "Hedera integration is disabled" };
    const submission = await hedera.lifecycleEvents.publishPassportHash(hash);
    let consensusTimestamp = submission.consensusTimestamp || null;
    if (submission.sequenceNumber !== undefined) {
      for (let attempt = 0; attempt < 8 && !consensusTimestamp; attempt += 1) {
        if (attempt) await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          const [message] = await hedera.mirrorNode.getTopicMessages(submission.topicId, {
            sequenceNumber: submission.sequenceNumber,
            limit: 1
          });
          if (message?.sequenceNumber === submission.sequenceNumber && message.messageText === hash) {
            consensusTimestamp = message.consensusTimestamp;
          }
        } catch {
          // Consensus is confirmed by the transaction receipt; Mirror Node indexing can lag.
        }
      }
    }
    return {
      ...reference,
      status: "CONFIRMED",
      transactionId: submission.transactionId,
      topicId: submission.topicId,
      sequenceNumber: submission.sequenceNumber ?? null,
      consensusTimestamp
    };
  } catch (error) {
    console.error(`[hedera] passport proof publish failed for ${product.passportId}:`, error);
    return {
      ...reference,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Passport proof publication failed"
    };
  }
}

async function mintProductDevice(product, hederaOverride) {
  if (product.hederaStatus === "CONFIRMED" && product.hederaTokenId && product.hederaSerialNumber) {
    return {
      status: "CONFIRMED",
      tokenId: product.hederaTokenId,
      serialNumber: product.hederaSerialNumber,
      transactionId: product.hederaMintTransactionId,
      error: null
    };
  }
  const reference = {
    status: "PENDING",
    tokenId: null,
    serialNumber: null,
    transactionId: null,
    error: null
  };

  try {
    const hedera = resolveHedera(hederaOverride);
    if (!hedera) return { ...reference, status: "FAILED", error: "Hedera integration is disabled" };

    const result = await hedera.deviceNft.mintDevice({
      metadata: {
        deviceId: product.passportId,
        passportId: product.passportId,
        publicReference: product.passportId
      }
    });
    return {
      ...reference,
      status: "CONFIRMED",
      tokenId: result.tokenId.toString(),
      serialNumber: result.serialNumber,
      transactionId: result.transactionId
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[hedera] mint failed for product ${product.passportId}:`, error);
    return {
      ...reference,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Hedera device mint failed"
    };
  }
}

async function transferProductDevice({ product, fromAccountId, toAccountId, hedera: hederaOverride }) {
  const reference = { status: "PENDING", transactionId: null, error: null };
  if (!product.hederaTokenId || !product.hederaSerialNumber) {
    return { ...reference, status: "FAILED", error: "Product has no confirmed Hedera NFT" };
  }

  try {
    const hedera = resolveHedera(hederaOverride);
    if (!hedera) return { ...reference, status: "FAILED", error: "Hedera integration is disabled" };
    if (!fromAccountId || !toAccountId) {
      return { ...reference, status: "FAILED", error: "Both owners require Hedera account IDs" };
    }
    const result = await hedera.deviceNft.transferDevice({
      tokenId: product.hederaTokenId,
      serialNumber: product.hederaSerialNumber,
      from: fromAccountId,
      to: toAccountId
    });
    return { ...reference, status: "CONFIRMED", transactionId: result.transactionId };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[hedera] NFT transfer failed for product ${product.passportId} (${fromAccountId} -> ${toAccountId}):`, error);
    return {
      ...reference,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Hedera NFT transfer failed"
    };
  }
}

async function publishLifecycleEvent({ product, lifecycleEvent, actor, hedera: hederaOverride }) {
  const reference = {
    status: "PENDING",
    topicId: null,
    sequenceNumber: null,
    transactionId: null,
    consensusTimestamp: null,
    error: null
  };

  if (!EVENT_TYPES.has(lifecycleEvent.type)) {
    return { ...reference, status: "FAILED", error: `Unsupported lifecycle event: ${lifecycleEvent.type}` };
  }

  try {
    const hedera = resolveHedera(hederaOverride);
    if (!hedera) {
      return { ...reference, status: "FAILED", error: "Hedera integration is disabled" };
    }

    const actorAccountId = actor.hederaAccountId || hedera.client.operatorId.toString();
    const provenance = lifecycleEvent.provenance || {
      source: { type: PROVENANCE_SOURCES.OWNER },
      verificationLevel: PROVENANCE_LEVELS.OWNER_REPORTED,
      evidence: { available: false, integrityStatus: EVIDENCE_INTEGRITY_STATUSES.UNKNOWN }
    };
    const canonicalRecord = lifecycleEvent.toObject ? lifecycleEvent.toObject() : { ...lifecycleEvent };
    const recordHash = computeLifecycleRecordHash(canonicalRecord);
    lifecycleEvent.recordHash = recordHash;
    const submission = await hedera.lifecycleEvents.publishEvent({
      event: {
        eventId: lifecycleEvent.eventId,
        eventType: lifecycleEvent.type,
        deviceId: product.passportId,
        deviceTokenId: product.hederaTokenId || undefined,
        deviceSerialNumber: product.hederaSerialNumber || undefined,
        actorAccountId,
        occurredAt: (lifecycleEvent.createdAt || new Date()).toISOString(),
        evidenceHash: lifecycleEvent.hash || undefined,
        recordHash,
        provenance: {
          sourceType: provenance.source?.type || PROVENANCE_SOURCES.OWNER,
          sourceRole: provenance.source?.role || undefined,
          claimType: provenance.claimType || undefined,
          verificationLevel: provenance.verificationLevel || PROVENANCE_LEVELS.OWNER_REPORTED,
          verificationStatus: provenance.verificationStatus || TRUST_STATUSES.OWNER_DECLARED,
          institutionType: provenance.institutionType || undefined,
          evidenceAvailable: Boolean(provenance.evidence?.available),
          evidenceIntegrityStatus: provenance.evidence?.integrityStatus || EVIDENCE_INTEGRITY_STATUSES.UNKNOWN
        },
        metadata: {
          deviceModel: `${product.brand} ${product.model}`,
          deviceCategory: product.category,
          publicReference: product.passportId
        }
      }
    });

    let consensusTimestamp = null;
    if (submission.sequenceNumber !== undefined) {
      try {
        const verified = await hedera.verification.verifyLifecycleEvent({
          topicId: submission.topicId,
          sequenceNumber: submission.sequenceNumber,
          expectedEventId: lifecycleEvent.eventId,
          expectedDeviceId: product.passportId
        });
        consensusTimestamp = verified.message?.consensusTimestamp || null;
      } catch {
        // Confirmation remains represented by the submission until Mirror Node catches up.
      }
    }

    return {
      ...reference,
      status: "CONFIRMED",
      topicId: submission.topicId,
      sequenceNumber: submission.sequenceNumber ?? null,
      transactionId: submission.transactionId,
      consensusTimestamp
    };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[hedera] lifecycle publish failed for event ${lifecycleEvent.eventId} (${lifecycleEvent.type}):`, error);
    return {
      ...reference,
      status: "FAILED",
      error: error instanceof Error ? error.message : "Hedera lifecycle publication failed"
    };
  }
}

async function publishAndPersistLifecycleEvent({ product, lifecycleEvent, actor }) {
  if (lifecycleEvent.hederaStatus === "CONFIRMED") {
    return {
      status: "CONFIRMED",
      topicId: lifecycleEvent.hederaTopicId,
      sequenceNumber: lifecycleEvent.hederaSequenceNumber,
      transactionId: lifecycleEvent.hederaTransactionId,
      consensusTimestamp: lifecycleEvent.hederaConsensusTimestamp,
      error: null
    };
  }
  const reference = await publishLifecycleEvent({ product, lifecycleEvent, actor });
  lifecycleEvent.hederaStatus = reference.status;
  lifecycleEvent.hederaTopicId = reference.topicId;
  lifecycleEvent.hederaSequenceNumber = reference.sequenceNumber;
  lifecycleEvent.hederaTransactionId = reference.transactionId;
  lifecycleEvent.hederaConsensusTimestamp = reference.consensusTimestamp;
  lifecycleEvent.hederaError = reference.error;
  if (reference.status === "CONFIRMED") {
    lifecycleEvent.provenance.recordingStatus = "BLOCKCHAIN_RECORDED";
    lifecycleEvent.provenance.blockchain = {
      topicId: reference.topicId,
      sequenceNumber: reference.sequenceNumber,
      transactionId: reference.transactionId,
      consensusTimestamp: reference.consensusTimestamp
    };
  }
  await lifecycleEvent.save();
  return reference;
}

module.exports = {
  mintProductDevice,
  publishPassportHash,
  publishAndPersistLifecycleEvent,
  publishLifecycleEvent,
  transferProductDevice
};