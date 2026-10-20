import { describe, expect, it } from "vitest";
import { EvidenceHasher } from "../../src/hedera/evidence/evidenceHasher.js";
import { CanonicalSerializer } from "../../src/hedera/serialization/canonicalSerializer.js";

describe("evidence and canonical serialization", () => {
  it("hashes and verifies SHA-256 evidence", () => {
    const hasher = new EvidenceHasher();
    const hash = hasher.hash("ReLoop evidence");

    expect(hash).toBe("b3b44af49b8b6d2283e0a5fafec4cf72091181469ea7374c1d91c806d0b9e7ac");
    expect(hasher.verify("ReLoop evidence", hash)).toBe(true);
    expect(hasher.verify("tampered evidence", hash)).toBe(false);
  });

  it("serializes equivalent objects deterministically", () => {
    const serializer = new CanonicalSerializer();

    expect(new TextDecoder().decode(serializer.serialize({ b: 2, a: 1 })))
      .toBe('{"a":1,"b":2}');
    expect(serializer.serialize({ a: 1, b: 2 })).toEqual(serializer.serialize({ b: 2, a: 1 }));
  });
});