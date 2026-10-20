import { createHash, timingSafeEqual } from "node:crypto";

export type EvidenceHash = string;

export class EvidenceHasher {
  public hash(data: Uint8Array | string): EvidenceHash {
    return createHash("sha256").update(data).digest("hex");
  }

  public verify(data: Uint8Array | string, expectedHash: EvidenceHash): boolean {
    const actual = Buffer.from(this.hash(data), "ascii");
    const expected = Buffer.from(expectedHash.toLowerCase(), "ascii");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
