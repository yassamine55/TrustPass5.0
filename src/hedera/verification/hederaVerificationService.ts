import { HederaOperationError } from "../hederaErrors.js";
import { EvidenceHasher } from "../evidence/evidenceHasher.js";
import type { MirrorNft, MirrorNodeClient, MirrorTopicMessage } from "../mirror/index.js";
import { decodeLifecycleMessage } from "../hcs/lifecycleEventValidation.js";
import type { LifecycleEvent } from "../hcs/lifecycleEventTypes.js";

export interface VerifyLifecycleEventInput {
  readonly topicId: string;
  readonly sequenceNumber: number;
  readonly expectedEventId?: string;
  readonly expectedDeviceId?: string;
}

export interface VerifiedLifecycleEvent extends LifecycleEvent {
  readonly topicId: string;
  readonly sequenceNumber: number;
  readonly consensusTimestamp: string;
  readonly runningHash?: string;
}

export interface LifecycleEventVerificationResult {
  readonly valid: boolean;
  readonly event?: VerifiedLifecycleEvent;
  readonly message?: MirrorTopicMessage;
  readonly reason?: string;
}

export interface VerifyEvidenceInput {
  readonly data: Uint8Array | string;
  readonly expectedHash: string;
}

export interface EvidenceVerificationResult {
  readonly valid: boolean;
  readonly actualHash: string;
  readonly expectedHash: string;
}

export class HederaVerificationService {
  public constructor(
    private readonly mirrorNode: MirrorNodeClient,
    private readonly evidenceHasher = new EvidenceHasher(),
  ) {}

  public async verifyLifecycleEvent(
    input: VerifyLifecycleEventInput,
  ): Promise<LifecycleEventVerificationResult> {
    try {
      const messages = await this.mirrorNode.getTopicMessages(input.topicId, {
        sequenceNumber: input.sequenceNumber,
        limit: 1,
      });
      const message = messages.find((item) => item.sequenceNumber === input.sequenceNumber);
      if (!message) return { valid: false, reason: "HCS message was not found" };
      const event = decodeLifecycleMessage(message.messageText, message);
      if (input.expectedEventId && event.eventId !== input.expectedEventId) {
        return { valid: false, message, reason: "Lifecycle event ID does not match" };
      }
      if (input.expectedDeviceId && event.deviceId !== input.expectedDeviceId) {
        return { valid: false, message, reason: "Lifecycle device ID does not match" };
      }
      return { valid: true, event, message };
    } catch (error) {
      return {
        valid: false,
        reason: error instanceof Error ? error.message : "Unable to verify HCS message",
      };
    }
  }

  public async verifyEvidenceHash(
    input: VerifyEvidenceInput,
  ): Promise<EvidenceVerificationResult> {
    const actualHash = this.evidenceHasher.hash(input.data);
    return {
      valid: this.evidenceHasher.verify(input.data, input.expectedHash),
      actualHash,
      expectedHash: input.expectedHash,
    };
  }

  public async getDeviceNft(tokenId: string, serialNumber: number): Promise<MirrorNft> {
    return this.mirrorNode.getNft(tokenId, serialNumber);
  }
}
