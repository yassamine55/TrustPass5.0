import { describe, expect, it } from "vitest";
import { PrivateKey } from "@hashgraph/sdk";
import { CanonicalSerializer } from "../../src/hedera/serialization/canonicalSerializer.js";
import { RepairerSignatureService } from "../../src/hedera/identity/repairerSignatureService.js";

describe("repairer signature verification", () => {
  const buildPayload = (overrides: Partial<Record<string, unknown>> = {}) => ({
    claimId: "REP-001",
    repairId: "REP-001",
    productId: "507f1f77bcf86cd799439011",
    passportId: "PP-1001",
    repairerId: "repairer-123",
    repairerAccountId: "0.0.1234",
    description: "Replace battery",
    changedParts: ["battery"],
    date: "2026-09-18T22:00:00.000Z",
    price: 149.99,
    invoiceHash: "abc123",
    evidenceHash: "def456",
    evidenceDocumentId: "doc-789",
    timestamp: "2026-09-18T22:00:00.000Z",
    provenance: {
      claimType: "REPAIR",
      verificationStatus: "PROFESSIONALLY_ATTESTED",
      verificationLevel: "REPAIRER_VERIFIED",
      evidenceHash: "def456",
      evidenceDocumentId: "doc-789",
    },
    ...overrides,
  });

  it("accepts a valid attestation signature", async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = "0.0.1234";
    const payload = buildPayload();
    const serializer = new CanonicalSerializer();
    const signature = privateKey.sign(serializer.serialize(payload));
    const mirrorNode = {
      getAccountPublicKey: async (requestedAccountId: string) => {
        expect(requestedAccountId).toBe(accountId);
        return privateKey.publicKey.toString();
      },
    } as any;
    const service = new RepairerSignatureService(mirrorNode, serializer);

    const result = await service.verifySignature({ accountId, payload, signature });

    expect(result.valid).toBe(true);
    expect(result.accountId).toBe(accountId);
  });

  it("rejects modified repair details", async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = "0.0.1234";
    const payload = buildPayload();
    const serializer = new CanonicalSerializer();
    const signature = privateKey.sign(serializer.serialize(payload));
    const service = new RepairerSignatureService({
      getAccountPublicKey: async () => privateKey.publicKey.toString(),
    } as any, serializer);

    const result = await service.verifySignature({
      accountId,
      payload: buildPayload({ description: "Replace screen" }),
      signature,
    });

    expect(result.valid).toBe(false);
  });

  it("rejects modified evidence hash", async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = "0.0.1234";
    const payload = buildPayload();
    const serializer = new CanonicalSerializer();
    const signature = privateKey.sign(serializer.serialize(payload));
    const service = new RepairerSignatureService({
      getAccountPublicKey: async () => privateKey.publicKey.toString(),
    } as any, serializer);

    const result = await service.verifySignature({
      accountId,
      payload: buildPayload({ evidenceHash: "other-hash" }),
      signature,
    });

    expect(result.valid).toBe(false);
  });

  it("rejects modified repairer identity", async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = "0.0.1234";
    const payload = buildPayload();
    const serializer = new CanonicalSerializer();
    const signature = privateKey.sign(serializer.serialize(payload));
    const service = new RepairerSignatureService({
      getAccountPublicKey: async () => privateKey.publicKey.toString(),
    } as any, serializer);

    const result = await service.verifySignature({
      accountId,
      payload: buildPayload({ repairerId: "repairer-999" }),
      signature,
    });

    expect(result.valid).toBe(false);
  });

  it("rejects modified timestamp", async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = "0.0.1234";
    const payload = buildPayload();
    const serializer = new CanonicalSerializer();
    const signature = privateKey.sign(serializer.serialize(payload));
    const service = new RepairerSignatureService({
      getAccountPublicKey: async () => privateKey.publicKey.toString(),
    } as any, serializer);

    const result = await service.verifySignature({
      accountId,
      payload: buildPayload({ timestamp: "2026-09-18T23:00:00.000Z" }),
      signature,
    });

    expect(result.valid).toBe(false);
  });

  it("rejects an invalid signature blob", async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = "0.0.1234";
    const payload = buildPayload();
    const serializer = new CanonicalSerializer();
    const service = new RepairerSignatureService({
      getAccountPublicKey: async () => privateKey.publicKey.toString(),
    } as any, serializer);

    const result = await service.verifySignature({
      accountId,
      payload,
      signature: PrivateKey.generateED25519().sign(serializer.serialize(payload)),
    });

    expect(result.valid).toBe(false);
  });

  it("rejects a signature from the wrong signer account", async () => {
    const signerKey = PrivateKey.generateED25519();
    const wrongKey = PrivateKey.generateED25519();
    const accountId = "0.0.1234";
    const payload = buildPayload();
    const serializer = new CanonicalSerializer();
    const signature = signerKey.sign(serializer.serialize(payload));
    const service = new RepairerSignatureService({
      getAccountPublicKey: async () => wrongKey.publicKey.toString(),
    } as any, serializer);

    const result = await service.verifySignature({ accountId, payload, signature });

    expect(result.valid).toBe(false);
  });
});