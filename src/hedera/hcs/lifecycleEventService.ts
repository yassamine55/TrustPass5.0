import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
} from "@hashgraph/sdk";
import { HederaClient } from "../core/hederaClient.js";
import type { MirrorNodeClient } from "../mirror/mirrorNodeClient.js";
import { CanonicalSerializer } from "../serialization/canonicalSerializer.js";
import type { ConsensusSubmission } from "../hederaTypes.js";
import { HederaOperationError } from "../hederaErrors.js";
import { decodeLifecycleMessage, validateLifecycleEvent } from "./lifecycleEventValidation.js";
import type {
  CreateLifecycleTopicInput,
  DecodedLifecycleEvent,
  GetDeviceLifecycleInput,
  GetLifecycleEventInput,
  CreateLifecycleTopicResult,
  PublishLifecycleEventInput,
} from "./lifecycleEventTypes.js";

export class LifecycleEventService {
  public constructor(
    private readonly hedera: HederaClient,
    private readonly mirrorNode: MirrorNodeClient,
    private readonly serializer = new CanonicalSerializer(),
  ) {}

  public async createTopic(
    input: CreateLifecycleTopicInput = {},
  ): Promise<CreateLifecycleTopicResult> {
    const transaction = await new TopicCreateTransaction()
      .setTopicMemo(input.memo ?? "ReLoop device lifecycle events")
      .setSubmitKey(this.hedera.operatorKey)
      .freezeWith(this.hedera.sdkClient);
    const response = await transaction.sign(this.hedera.operatorKey).then((signed) =>
      signed.execute(this.hedera.sdkClient),
    );
    const receipt = await response.getReceipt(this.hedera.sdkClient);
    if (!receipt.topicId) {
      throw new HederaOperationError("HCS topic creation returned no topic ID");
    }

    return {
      topicId: receipt.topicId.toString(),
      transactionId: response.transactionId.toString(),
      receiptStatus: receipt.status,
    };
  }

  public async publishEvent(
    input: PublishLifecycleEventInput,
  ): Promise<ConsensusSubmission> {
    validateLifecycleEvent(input.event);
    const topicId = input.topicId
      ? TopicId.fromString(input.topicId)
      : this.hedera.requireTopicId();
    const message = this.serializer.serialize({
      protocolVersion: 1,
      ...input.event,
    });
    const response = await new TopicMessageSubmitTransaction()
      .setTopicId(topicId)
      .setMessage(message)
      .execute(this.hedera.sdkClient);
    const receipt = await response.getReceipt(this.hedera.sdkClient);

    return {
      topicId: topicId.toString(),
      transactionId: response.transactionId.toString(),
      receiptStatus: receipt.status,
      sequenceNumber: receipt.topicSequenceNumber?.toNumber(),
    };
  }

  public async getEvent(input: GetLifecycleEventInput): Promise<DecodedLifecycleEvent> {
    const topicId = input.topicId ?? this.hedera.requireTopicId().toString();
    const messages = await this.mirrorNode.getTopicMessages(topicId, {
      sequenceNumber: input.sequenceNumber,
      limit: 1,
    });
    const message = messages.find((item) => item.sequenceNumber === input.sequenceNumber);
    if (!message) throw new Error(`HCS event not found at ${topicId}/${input.sequenceNumber}`);
    return decodeLifecycleMessage(message.messageText, message);
  }

  public async getDeviceLifecycle(
    input: GetDeviceLifecycleInput,
  ): Promise<DecodedLifecycleEvent[]> {
    const topicId = input.topicId ?? this.hedera.requireTopicId().toString();
    const messages = await this.mirrorNode.getTopicMessages(topicId, {
      limit: input.limit,
      order: input.order,
    });
    const events: DecodedLifecycleEvent[] = [];
    for (const message of messages) {
      try {
        const event = decodeLifecycleMessage(message.messageText, message);
        if (event.deviceId === input.deviceId) events.push(event);
      } catch {
        // Topics can contain non-lifecycle messages; ignore those during device filtering.
      }
    }
    return events;
  }
}
