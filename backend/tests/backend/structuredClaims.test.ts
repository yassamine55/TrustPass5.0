import { describe, expect, it } from "vitest";
import { deriveInspectionClaims, deriveRepairClaims } from "../../src/domain/structuredClaims.js";
import { RepairerSignatureService } from "../../src/hedera/identity/repairerSignatureService.js";
import { CanonicalSerializer } from "../../src/hedera/serialization/canonicalSerializer.js";

describe("structured claims", () => {
  it("turns a repair claim into machine-readable assertions", () => {
    const claims = deriveRepairClaims({
      description: "Battery replacement and screen inspection",
      changedParts: ["battery", "screen"],
      evidenceDocumentId: "doc-123",
      actorId: "user-1",
      actorRole: "OWNER"
    });

    expect(claims.length).toBeGreaterThan(0);
    expect(claims.some((claim) => claim.type === "REPAIR" && claim.subject === "device")).toBe(true);
    expect(claims.some((claim) => claim.type === "PART_REPLACED" && claim.subject === "battery")).toBe(true);
    expect(claims.every((claim) => typeof claim.id === "string" && claim.id.length > 10)).toBe(true);
    expect(claims.every((claim) => claim.hash && claim.hash.length === 64)).toBe(true);
  });

  it("includes claims in the signed repair attestation payload", async () => {
    const claims = deriveRepairClaims({
      description: "Battery replacement",
      changedParts: ["battery"],
      evidenceDocumentId: "doc-456",
      actorId: "user-2",
      actorRole: "OWNER"
    });

    const service = new RepairerSignatureService({
      getAccountPublicKey: async () => ""
    } as any, new CanonicalSerializer());

    const payload = service.buildRepairAttestationPayload({
      claimId: "RCLM-001",
      repairId: "REP-001",
      productId: "prod-123",
      passportId: "PP-1001",
      repairerId: "repairer-1",
      repairerAccountId: "0.0.1234",
      description: "Battery replacement",
      changedParts: ["battery"],
      date: "2026-09-03T00:00:00.000Z",
      evidenceDocumentId: "doc-456",
      claims,
      timestamp: "2026-09-03T00:00:00.000Z"
    });

    expect(payload.claims).toEqual(claims);
    expect(Array.isArray(payload.claims)).toBe(true);
    expect(payload.claims[0]?.type).toBe("REPAIR");
  });

  it("derives inspection claims from checklist state", () => {
    const claims = deriveInspectionClaims({
      checklist: [
        { itemId: "screen", label: "Screen", status: "PASS" },
        { itemId: "battery", label: "Battery", status: "FAIL" }
      ],
      summary: "Battery failed, screen still passes",
      decision: "REPAIRABLE",
      reason: "Battery replacement required",
      inspectorId: "repairer-11",
      evidenceDocuments: ["doc-1"]
    });

    expect(claims.some((claim) => claim.subject === "screen" && claim.value === "PASS")).toBe(true);
    expect(claims.some((claim) => claim.subject === "battery" && claim.value === "FAIL")).toBe(true);
    expect(claims.some((claim) => claim.type === "INSPECTION_DECISION")).toBe(true);
  });
});
