import { describe, expect, it } from "vitest";
import {
  computeLifecycleRecordHash,
  verifyLifecycleRecordHash,
} from "../../src/hedera/verification/lifecycleRecordIntegrity.js";

const baseRecord = {
  eventId: "EVT-001",
  sourceRef: "REP-001",
  product: "507f1f77bcf86cd799439011",
  type: "REPAIR",
  actor: "507f1f77bcf86cd799439012",
  description: "Replaced display assembly",
  document: null,
  hash: null,
  relatedEvent: null,
  verificationRequest: null,
  provenance: {
    claimType: "REPAIR",
    source: { type: "REPAIRER", role: "REPAIRER", actorId: "507f1f77bcf86cd799439013" },
    verificationStatus: "PROFESSIONALLY_ATTESTED",
    verificationLevel: "REPAIRER_VERIFIED",
    evidence: {
      available: true,
      documentId: null,
      reference: null,
      references: [],
      hash: null,
      integrityStatus: "VERIFIED",
    },
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:05:00.000Z",
  date: "2026-01-01T00:00:00.000Z",
  changedParts: ["display", "digitizer"],
  price: 249.99,
};

function makeHcsMessage(record: Record<string, unknown>) {
  return JSON.stringify({
    protocolVersion: 1,
    eventId: record.eventId,
    eventType: record.type,
    deviceId: "RLP-2026-TEST",
    deviceTokenId: "0.0.100",
    deviceSerialNumber: 1,
    actorAccountId: "0.0.123",
    occurredAt: record.createdAt,
    recordHash: computeLifecycleRecordHash(record),
    provenance: {
      sourceType: "REPAIRER",
      verificationLevel: "REPAIRER_VERIFIED",
      verificationStatus: "PROFESSIONALLY_ATTESTED",
      evidenceAvailable: true,
      evidenceIntegrityStatus: "VERIFIED",
    },
    metadata: {
      deviceModel: "ReLoop Phone",
      deviceCategory: "ELECTRONICS",
      publicReference: "RLP-2026-TEST",
    },
  });
}

describe("lifecycle record integrity", () => {
  it("unchanged event => hash matches", () => {
    const message = makeHcsMessage(baseRecord);
    const result = verifyLifecycleRecordHash({ currentRecord: baseRecord, hcsMessageText: message });
    expect(result.status).toBe("HASH_MATCH");
    expect(result.valid).toBe(true);
  });

  it("modified description => hash mismatch", () => {
    const altered = { ...baseRecord, description: "Replaced battery instead" };
    const result = verifyLifecycleRecordHash({ currentRecord: altered, hcsMessageText: makeHcsMessage(baseRecord) });
    expect(result.status).toBe("HASH_MISMATCH");
    expect(result.valid).toBe(false);
  });

  it("modified date => hash mismatch", () => {
    const altered = { ...baseRecord, date: "2026-01-02T00:00:00.000Z" };
    const result = verifyLifecycleRecordHash({ currentRecord: altered, hcsMessageText: makeHcsMessage(baseRecord) });
    expect(result.status).toBe("HASH_MISMATCH");
    expect(result.valid).toBe(false);
  });

  it("modified parts => hash mismatch", () => {
    const altered = { ...baseRecord, changedParts: ["battery"] };
    const result = verifyLifecycleRecordHash({ currentRecord: altered, hcsMessageText: makeHcsMessage(baseRecord) });
    expect(result.status).toBe("HASH_MISMATCH");
    expect(result.valid).toBe(false);
  });

  it("modified price => hash mismatch", () => {
    const altered = { ...baseRecord, price: 320 };
    const result = verifyLifecycleRecordHash({ currentRecord: altered, hcsMessageText: makeHcsMessage(baseRecord) });
    expect(result.status).toBe("HASH_MISMATCH");
    expect(result.valid).toBe(false);
  });

  it("modified provenance => hash mismatch", () => {
    const altered = {
      ...baseRecord,
      provenance: {
        ...baseRecord.provenance,
        verificationLevel: "OWNER_REPORTED",
      },
    };
    const result = verifyLifecycleRecordHash({ currentRecord: altered, hcsMessageText: makeHcsMessage(baseRecord) });
    expect(result.status).toBe("HASH_MISMATCH");
    expect(result.valid).toBe(false);
  });

  it("hash present but unverified => returns unverified state", () => {
    const result = verifyLifecycleRecordHash({
      currentRecord: baseRecord,
      hcsMessageText: JSON.stringify({ protocolVersion: 1, recordHash: null }),
    });
    expect(result.status).toBe("INVALID_HCS_PAYLOAD");
    expect(result.valid).toBe(false);
  });

  it("verified state requires successful recomputation", () => {
    const result = verifyLifecycleRecordHash({ currentRecord: baseRecord, hcsMessageText: makeHcsMessage(baseRecord) });
    expect(result.status).toBe("HASH_MATCH");
    expect(result.valid).toBe(true);
  });

  it("tampered current record produces mismatched verification state", () => {
    const altered = { ...baseRecord, description: "Replaced battery instead" };
    const result = verifyLifecycleRecordHash({ currentRecord: altered, hcsMessageText: makeHcsMessage(baseRecord) });
    expect(result.status).toBe("HASH_MISMATCH");
    expect(result.valid).toBe(false);
  });

  it("missing HCS message", () => {
    const result = verifyLifecycleRecordHash({ currentRecord: baseRecord, hcsMessageText: undefined });
    expect(result.status).toBe("HCS_RECORD_NOT_FOUND");
    expect(result.valid).toBe(false);
  });

  it("malformed HCS payload", () => {
    const result = verifyLifecycleRecordHash({ currentRecord: baseRecord, hcsMessageText: "{not valid json" });
    expect(result.status).toBe("INVALID_HCS_PAYLOAD");
    expect(result.valid).toBe(false);
  });
});
