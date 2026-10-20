import { describe, expect, it } from "vitest";
import {
  DEVICE_LIFECYCLE_EVENT_TYPES,
  validateLifecycleEvent,
  validateDeviceNftMetadata,
} from "../../src/hedera/index.js";

const baseEvent = {
  eventId: "event-1",
  deviceId: "passport-1",
  actorAccountId: "0.0.123",
  occurredAt: "2026-09-18T12:00:00.000Z",
  evidenceHash: "a".repeat(64),
  metadata: { publicReference: "public-ref" },
};

describe("lifecycle event validation", () => {
  it.each(DEVICE_LIFECYCLE_EVENT_TYPES)("accepts %s", (eventType) => {
    expect(validateLifecycleEvent({ ...baseEvent, eventType })).toMatchObject({ eventType });
  });

  it("rejects unsupported fields that could carry sensitive data", () => {
    expect(() => validateLifecycleEvent({ ...baseEvent, eventType: "REPAIR", payload: { email: "private@example.com" } }))
      .toThrow("Unsupported lifecycle event field: payload");
  });

  it("rejects unsafe metadata keys", () => {
    expect(() => validateLifecycleEvent({
      ...baseEvent,
      eventType: "REPAIR",
      metadata: { email: "private@example.com" },
    })).toThrow("Unsupported safe metadata field: email");
  });

  it("rejects invalid event identity and evidence", () => {
    expect(() => validateLifecycleEvent({ ...baseEvent, eventType: "REPAIR", actorAccountId: "user-1" }))
      .toThrow("actorAccountId must be a Hedera account ID");
    expect(() => validateLifecycleEvent({ ...baseEvent, eventType: "REPAIR", evidenceHash: "not-a-hash" }))
      .toThrow("evidenceHash must be a SHA-256 hexadecimal digest");
  });

  it("allows only public NFT device references", () => {
    expect(() => validateDeviceNftMetadata({ deviceId: "passport-1", publicReference: "demo" }))
      .not.toThrow();
    expect(() => validateDeviceNftMetadata({ deviceId: "passport-1", email: "private@example.com" }))
      .toThrow("Unsupported NFT metadata field: email");
  });
});