import { HederaOperationError } from "../hederaErrors.js";
import { isDeviceLifecycleEventType } from "./lifecycleEventType.js";
import {
  PROVENANCE_LEVELS,
  VERIFICATION_STATUSES,
  PROVENANCE_SOURCES,
  INSTITUTION_TYPES,
  EVIDENCE_INTEGRITY_STATUSES,
} from "./lifecycleEventTypes.js";
import type {
  DecodedLifecycleEvent,
  LifecycleEvent,
  SafeLifecycleMetadata,
  SafeProvenance,
} from "./lifecycleEventTypes.js";

const EVENT_KEYS = new Set([
  "eventId",
  "eventType",
  "deviceId",
  "deviceTokenId",
  "deviceSerialNumber",
  "actorAccountId",
  "occurredAt",
  "evidenceHash",
  "recordHash",
  "provenance",
  "metadata",
]);

const METADATA_KEYS = new Set([
  "deviceModel",
  "deviceCategory",
  "condition",
  "partReference",
  "publicReference",
]);

export function validateLifecycleEvent(value: unknown): LifecycleEvent {
  if (!isRecord(value)) throw invalid("Lifecycle event must be an object");
  for (const key of Object.keys(value)) {
    if (!EVENT_KEYS.has(key)) throw invalid(`Unsupported lifecycle event field: ${key}`);
  }
  requireString(value.eventId, "eventId");
  if (typeof value.eventType !== "string" || !isDeviceLifecycleEventType(value.eventType)) {
    throw invalid("eventType must be a supported lifecycle event type");
  }
  requireString(value.deviceId, "deviceId");
  if (value.deviceTokenId !== undefined) requireTokenId(value.deviceTokenId, "deviceTokenId");
    const deviceSerialNumber = value.deviceSerialNumber;
    if (deviceSerialNumber !== undefined &&
      (!Number.isInteger(deviceSerialNumber) || typeof deviceSerialNumber !== "number" || deviceSerialNumber <= 0)) {
    throw invalid("deviceSerialNumber must be a positive integer");
  }
  if (!isAccountId(value.actorAccountId)) throw invalid("actorAccountId must be a Hedera account ID");
  if (typeof value.occurredAt !== "string" || Number.isNaN(Date.parse(value.occurredAt))) {
    throw invalid("occurredAt must be an ISO-compatible timestamp");
  }
  const evidenceHash = value.evidenceHash;
  if (evidenceHash !== undefined &&
      (typeof evidenceHash !== "string" || !/^[a-f0-9]{64}$/i.test(evidenceHash))) {
    throw invalid("evidenceHash must be a SHA-256 hexadecimal digest");
  }
  const recordHash = value.recordHash;
  if (recordHash !== undefined &&
      (typeof recordHash !== "string" || !/^[a-f0-9]{64}$/i.test(recordHash))) {
    throw invalid("recordHash must be a SHA-256 hexadecimal digest");
  }
  if (value.provenance !== undefined) validateSafeProvenance(value.provenance);
  if (value.metadata !== undefined) validateSafeMetadata(value.metadata);
  return value as unknown as LifecycleEvent;
}

export function decodeLifecycleMessage(
  messageText: string,
  blockchain: Omit<DecodedLifecycleEvent, keyof LifecycleEvent>,
): DecodedLifecycleEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(messageText) as unknown;
  } catch {
    throw invalid("HCS message is not valid JSON");
  }
  if (!isRecord(parsed) || parsed.protocolVersion !== 1) {
    throw invalid("HCS message has an unsupported protocol version");
  }
  const { protocolVersion: _protocolVersion, ...event } = parsed;
  return { ...validateLifecycleEvent(event), ...blockchain };
}

function validateSafeMetadata(value: unknown): asserts value is SafeLifecycleMetadata {
  if (!isRecord(value)) throw invalid("metadata must be an object");
  for (const [key, item] of Object.entries(value)) {
    if (!METADATA_KEYS.has(key)) throw invalid(`Unsupported safe metadata field: ${key}`);
    requireString(item, `metadata.${key}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) throw invalid(`${field} must be a non-empty string`);
}

function requireTokenId(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) throw invalid(`${field} must be a token ID`);
}

function isAccountId(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function invalid(message: string): HederaOperationError {
  return new HederaOperationError(message);
}

function validateSafeProvenance(value: unknown): asserts value is SafeProvenance {
  if (!isRecord(value)) throw invalid("provenance must be an object");
  const allowedKeys = new Set([
    "sourceType",
    "sourceRole",
    "claimType",
    "verificationLevel",
    "verificationStatus",
    "institutionType",
    "evidenceAvailable",
    "evidenceIntegrityStatus",
  ]);
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) throw invalid(`Unsupported provenance field: ${key}`);
  }
  if (!isOneOf(value.sourceType, PROVENANCE_SOURCES)) throw invalid("provenance.sourceType is invalid");
  if (value.sourceRole !== undefined) requireString(value.sourceRole, "provenance.sourceRole");
  if (value.claimType !== undefined) requireString(value.claimType, "provenance.claimType");
  if (!isOneOf(value.verificationLevel, PROVENANCE_LEVELS)) throw invalid("provenance.verificationLevel is invalid");
  if (value.verificationStatus !== undefined && !isOneOf(value.verificationStatus, VERIFICATION_STATUSES)) throw invalid("provenance.verificationStatus is invalid");
  if (typeof value.evidenceAvailable !== "boolean") throw invalid("provenance.evidenceAvailable must be boolean");
  if (value.institutionType !== undefined && !isOneOf(value.institutionType, INSTITUTION_TYPES)) {
    throw invalid("provenance.institutionType is invalid");
  }
  if (value.evidenceIntegrityStatus !== undefined && !isOneOf(value.evidenceIntegrityStatus, EVIDENCE_INTEGRITY_STATUSES)) {
    throw invalid("provenance.evidenceIntegrityStatus is invalid");
  }
  if (value.verificationLevel === "EVIDENCE_PROVIDED" && value.evidenceAvailable !== true) {
    throw invalid("EVIDENCE_PROVIDED provenance requires evidence");
  }
  if (value.verificationLevel === "REPAIRER_VERIFIED" && value.sourceType !== "REPAIRER") {
    throw invalid("REPAIRER_VERIFIED provenance requires a repairer source");
  }
  if (value.verificationLevel === "INSTITUTION_VERIFIED" &&
    (value.sourceType !== "INSTITUTION" || value.institutionType === undefined)) {
    throw invalid("INSTITUTION_VERIFIED provenance requires an institution source and type");
  }
}

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}