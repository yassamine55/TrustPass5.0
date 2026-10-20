const { getHederaModule } = require("./hederaModule");

const EVENT_TYPES = new Set([
  "PRODUCT_CREATED",
  "PURCHASED",
  "TRANSFERRED",
  "REPAIR",
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
  await lifecycleEvent.save();
  return reference;
}

module.exports = {
  mintProductDevice,
  publishAndPersistLifecycleEvent,
  publishLifecycleEvent,
  transferProductDevice
};