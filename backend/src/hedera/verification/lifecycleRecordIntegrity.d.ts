export type LifecycleRecordIntegrityStatus =
  | "HASH_MATCH"
  | "HASH_MISMATCH"
  | "HCS_RECORD_NOT_FOUND"
  | "INVALID_HCS_PAYLOAD";

export interface LifecycleRecordIntegrityCheck {
  valid: boolean;
  status: LifecycleRecordIntegrityStatus;
  actualHash?: string;
  expectedHash?: string;
  reason?: string;
}

export function computeLifecycleRecordHash(record: unknown): string;
export function verifyLifecycleRecordHash(args: {
  currentRecord: unknown;
  hcsMessageText?: string;
}): LifecycleRecordIntegrityCheck;
export function secureHexEqual(expected: string, actual: string): boolean;
