import { PublicKey } from "@hashgraph/sdk";
import { CanonicalSerializer } from "../serialization/canonicalSerializer.js";
import type { MirrorNodeClient } from "../mirror/mirrorNodeClient.js";

export interface VerifyRepairerSignatureInput {
  readonly accountId: string;
  readonly payload: unknown;
  readonly signature: Uint8Array;
}

export interface SignatureVerificationResult {
  readonly accountId: string;
  readonly valid: boolean;
  readonly publicKey?: string;
  readonly reason?: string;
}

export class RepairerSignatureService {
  public constructor(
    private readonly mirrorNode: MirrorNodeClient,
    private readonly serializer = new CanonicalSerializer(),
  ) {}

  public createSigningPayload(payload: unknown): Uint8Array {
    return this.serializer.serialize(payload);
  }

  public async verifySignature(
    input: VerifyRepairerSignatureInput,
  ): Promise<SignatureVerificationResult> {
    try {
      const publicKeyString = await this.mirrorNode.getAccountPublicKey(input.accountId);
      const publicKey = PublicKey.fromString(publicKeyString);
      const message = this.createSigningPayload(input.payload);
      return {
        accountId: input.accountId,
        publicKey: publicKey.toString(),
        valid: publicKey.verify(message, input.signature),
      };
    } catch (error) {
      return {
        accountId: input.accountId,
        valid: false,
        reason: error instanceof Error ? error.message : "Unable to verify signature",
      };
    }
  }
}
