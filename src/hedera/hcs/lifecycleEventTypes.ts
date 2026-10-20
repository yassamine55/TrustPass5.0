import type { HederaTransactionResult } from "../hederaTypes.js";
import type { DeviceLifecycleEventType } from "./lifecycleEventType.js";

export interface CreateLifecycleTopicInput {
  readonly memo?: string;
}

export interface CreateLifecycleTopicResult extends HederaTransactionResult {
  readonly topicId: string;
}

export interface LifecycleEvent {
  readonly eventId: string;
  readonly eventType: DeviceLifecycleEventType;
  readonly deviceId: string;
  readonly deviceTokenId?: string;
  readonly deviceSerialNumber?: number;
  readonly actorAccountId: string;
  readonly occurredAt: string;
  readonly evidenceHash?: string;
  readonly metadata?: SafeLifecycleMetadata;
}

export interface SafeLifecycleMetadata {
  readonly deviceModel?: string;
  readonly deviceCategory?: string;
  readonly condition?: string;
  readonly partReference?: string;
  readonly publicReference?: string;
}

export interface PublishLifecycleEventInput {
  readonly topicId?: string;
  readonly event: LifecycleEvent;
}

export interface GetLifecycleEventInput {
  readonly topicId?: string;
  readonly sequenceNumber: number;
}

export interface GetDeviceLifecycleInput {
  readonly topicId?: string;
  readonly deviceId: string;
  readonly limit?: number;
  readonly order?: "asc" | "desc";
}

export interface DecodedLifecycleEvent extends LifecycleEvent {
  readonly topicId: string;
  readonly sequenceNumber: number;
  readonly consensusTimestamp: string;
  readonly runningHash?: string;
}
