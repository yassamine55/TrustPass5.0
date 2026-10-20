import type { HederaTransactionResult } from "../hederaTypes.js";
import type { DeviceLifecycleEventType } from "./lifecycleEventType.js";

export const PROVENANCE_LEVELS = [
  "OWNER_REPORTED",
  "EVIDENCE_PROVIDED",
  "REPAIRER_VERIFIED",
  "INSTITUTION_VERIFIED",
] as const;
export type ProvenanceLevel = (typeof PROVENANCE_LEVELS)[number];

export const VERIFICATION_STATUSES = [
  "OWNER_DECLARED",
  "EVIDENCE_SUBMITTED",
  "PROFESSIONALLY_ATTESTED",
  "TECHNICALLY_VERIFIED",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PROVENANCE_SOURCES = ["OWNER", "REPAIRER", "INSTITUTION"] as const;
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

export const INSTITUTION_TYPES = [
  "MANUFACTURER",
  "AUTHORIZED_SERVICE_CENTER",
  "CERTIFIED_RECYCLER",
] as const;
export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export const EVIDENCE_INTEGRITY_STATUSES = ["UNKNOWN", "UNVERIFIED", "VERIFIED", "FAILED"] as const;
export type EvidenceIntegrityStatus = (typeof EVIDENCE_INTEGRITY_STATUSES)[number];

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
  readonly recordHash?: string;
  readonly provenance?: SafeProvenance;
  readonly metadata?: SafeLifecycleMetadata;
}

export interface SafeProvenance {
  readonly sourceType: ProvenanceSource;
  readonly sourceRole?: string;
  readonly claimType?: string;
  readonly verificationLevel: ProvenanceLevel;
  readonly verificationStatus?: VerificationStatus;
  readonly institutionType?: InstitutionType;
  readonly evidenceAvailable: boolean;
  readonly evidenceIntegrityStatus?: EvidenceIntegrityStatus;
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
