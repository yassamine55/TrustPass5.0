import { HederaOperationError } from "../hederaErrors.js";
import type { DeviceNftMetadata } from "./deviceNftTypes.js";

const METADATA_KEYS = new Set(["deviceId", "passportId", "publicReference", "evidenceHash"]);

export function validateDeviceNftMetadata(value: unknown): asserts value is DeviceNftMetadata {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HederaOperationError("NFT metadata must be a public device reference object");
  }
  const metadata = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(metadata)) {
    if (!METADATA_KEYS.has(key)) {
      throw new HederaOperationError(`Unsupported NFT metadata field: ${key}`);
    }
    if (typeof item !== "string" || item.trim().length === 0) {
      throw new HederaOperationError(`NFT metadata.${key} must be a non-empty string`);
    }
  }
  if (typeof metadata.deviceId !== "string" || metadata.deviceId.trim().length === 0) {
    throw new HederaOperationError("NFT metadata.deviceId is required");
  }
  if (metadata.evidenceHash !== undefined && !/^[a-f0-9]{64}$/i.test(metadata.evidenceHash as string)) {
    throw new HederaOperationError("NFT metadata.evidenceHash must be a SHA-256 hexadecimal digest");
  }
}