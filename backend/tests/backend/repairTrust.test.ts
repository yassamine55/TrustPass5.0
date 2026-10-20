import { describe, expect, it } from "vitest";
import {
  assertRepairOwner,
  ownerConfirmationEventType,
  repairProvenanceLevel,
} from "../../src/domain/repairTrust.js";
import { PROVENANCE_LEVELS } from "../../src/domain/provenance.js";

const owner = { _id: "owner-1", role: "OWNER" } as any;
const product = { owner: { toString: () => "owner-1" } } as any;

describe("repair trust workflow", () => {
  it("maps a valid signature to repairer verification", () => {
    expect(repairProvenanceLevel({ signatureValid: true, evidenceAvailable: true }))
      .toBe(PROVENANCE_LEVELS.REPAIRER_VERIFIED);
  });

  it("keeps evidence separate from repairer verification", () => {
    expect(repairProvenanceLevel({ signatureValid: null, evidenceAvailable: true }))
      .toBe(PROVENANCE_LEVELS.EVIDENCE_PROVIDED);
    expect(repairProvenanceLevel({ signatureValid: false, evidenceAvailable: true }))
      .toBe(PROVENANCE_LEVELS.EVIDENCE_PROVIDED);
    expect(repairProvenanceLevel({ signatureValid: null, evidenceAvailable: false }))
      .toBe(PROVENANCE_LEVELS.OWNER_REPORTED);
  });

  it("creates separate owner confirmation and rejection events", () => {
    expect(ownerConfirmationEventType(true)).toBe("REPAIR_OWNER_CONFIRMED");
    expect(ownerConfirmationEventType(false)).toBe("REPAIR_OWNER_DISPUTED");
  });

  it("allows only the current owner to confirm a repair", () => {
    expect(() => assertRepairOwner({ user: owner, product })).not.toThrow();
    expect(() => assertRepairOwner({ user: { _id: "other", role: "OWNER" }, product }))
      .toThrow("Only the device owner");
    expect(() => assertRepairOwner({ user: { _id: "owner-1", role: "REPAIRER" }, product }))
      .toThrow("Only the device owner");
  });

  it("never assigns institutional verification in the normal repair flow", () => {
    for (const input of [
      { signatureValid: true, evidenceAvailable: true },
      { signatureValid: null, evidenceAvailable: true },
      { signatureValid: null, evidenceAvailable: false },
    ]) {
      expect(repairProvenanceLevel(input)).not.toBe(PROVENANCE_LEVELS.INSTITUTION_VERIFIED);
    }
  });
});
