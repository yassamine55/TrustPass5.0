import { PublicKey } from "@hashgraph/sdk";
import { CanonicalSerializer } from "../serialization/canonicalSerializer.js";
import type { MirrorNodeClient } from "../mirror/mirrorNodeClient.js";

export interface RepairClaimRecord {
  readonly id: string;
  readonly type: string;
  readonly subject: string;
  readonly value: string;
  readonly assertion: string;
  readonly actorId?: string | null;
  readonly actorRole?: string | null;
  readonly timestamp: string;
  readonly evidenceReferences?: readonly string[];
  readonly hash: string;
}

export interface RepairAttestationInput {
  readonly claimId: string;
  readonly repairId: string;
  readonly productId: string;
  readonly passportId?: string | null;
  readonly repairerId: string;
  readonly repairerAccountId: string;
  readonly description: string;
  readonly changedParts: readonly string[];
  readonly date: string | Date;
  readonly price?: number | null;
  readonly invoiceHash?: string | null;
  readonly evidenceHash?: string | null;
  readonly evidenceDocumentId?: string | null;
  readonly claims?: readonly RepairClaimRecord[];
  readonly timestamp?: string | Date;
  readonly provenance?: {
    readonly claimType?: string | null;
    readonly verificationStatus?: string | null;
    readonly verificationLevel?: string | null;
    readonly evidenceHash?: string | null;
    readonly evidenceDocumentId?: string | null;
  } | null;
}

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

  public buildRepairAttestationPayload(input: RepairAttestationInput): Record<string, unknown> {
    const timestamp = toIsoString(input.timestamp ?? new Date());
    return {
      attestationType: "REPAIR_PROFESSIONALLY_ATTESTED",
      claimId: input.claimId,
      repairId: input.repairId,
      productId: input.productId,
      passportId: input.passportId ?? null,
      repairerId: input.repairerId,
      repairerAccountId: input.repairerAccountId,
      description: input.description,
      changedParts: [...input.changedParts],
      date: toIsoString(input.date),
      price: input.price ?? null,
      invoiceHash: input.invoiceHash ?? null,
      evidenceHash: input.evidenceHash ?? null,
      evidenceDocumentId: input.evidenceDocumentId ?? null,
      claims: Array.isArray(input.claims) ? input.claims.map((claim) => ({ ...claim })) : [],
      timestamp,
      provenance: {
        claimType: input.provenance?.claimType ?? "REPAIR",
        verificationStatus: input.provenance?.verificationStatus ?? "PROFESSIONALLY_ATTESTED",
        verificationLevel: input.provenance?.verificationLevel ?? "REPAIRER_VERIFIED",
        evidenceHash: input.provenance?.evidenceHash ?? input.evidenceHash ?? null,
        evidenceDocumentId: input.provenance?.evidenceDocumentId ?? input.evidenceDocumentId ?? null,
      },
    };
  }

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
      const valid = publicKey.verify(message, input.signature);
      return {
        accountId: input.accountId,
        publicKey: publicKey.toString(),
        valid,
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

function toIsoString(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}
