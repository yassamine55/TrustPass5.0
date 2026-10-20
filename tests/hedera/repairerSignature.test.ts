import { describe, expect, it } from "vitest";
import { PrivateKey } from "@hashgraph/sdk";
import { CanonicalSerializer } from "../../src/hedera/serialization/canonicalSerializer.js";
import { RepairerSignatureService } from "../../src/hedera/identity/repairerSignatureService.js";

describe("repairer signature verification", () => {
  it("accepts valid signatures and rejects invalid or tampered payloads", async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = "0.0.1234";
    const payload = {
      product: "507f1f77bcf86cd799439011",
      description: "Replace battery",
      changedParts: ["battery"],
      date: "2026-09-18T22:00:00.000Z"
    };
    const serializer = new CanonicalSerializer();
    const signature = privateKey.sign(serializer.serialize(payload));
    const mirrorNode = {
      getAccountPublicKey: async (requestedAccountId: string) => {
        expect(requestedAccountId).toBe(accountId);
        return privateKey.publicKey.toString();
      }
    } as any;
    const service = new RepairerSignatureService(mirrorNode, serializer);

    const valid = await service.verifySignature({ accountId, payload, signature });
    const invalid = await service.verifySignature({
      accountId,
      payload,
      signature: PrivateKey.generateED25519().sign(serializer.serialize(payload))
    });
    const tamperedPayload = await service.verifySignature({
      accountId,
      payload: { ...payload, description: "Replace screen" },
      signature
    });

    expect(valid.valid).toBe(true);
    expect(invalid.valid).toBe(false);
    expect(tamperedPayload.valid).toBe(false);
  });
});