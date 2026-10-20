import { describe, expect, it } from "vitest";
import LifecycleEvent from "../../src/models/LifecycleEvent.js";
import {
  createProvenance,
  PROVENANCE_LEVELS,
  PROVENANCE_SOURCES,
  INSTITUTION_TYPES,
  EVIDENCE_INTEGRITY_STATUSES,
} from "../../src/domain/provenance.js";
import { validateLifecycleEvent } from "../../src/hedera/hcs/lifecycleEventValidation.js";

const actor = { _id: "507f1f77bcf86cd799439011", role: "OWNER" } as any;
const baseHcsEvent = {
  eventId: "event-provenance-1",
  eventType: "REPAIR" as const,
  deviceId: "RLP-2026-PROVENANCE",
  actorAccountId: "0.0.123",
  occurredAt: "2026-09-20T12:00:00.000Z",
};

describe("provenance domain", () => {
  it("creates valid owner evidence provenance", () => {
    const provenance = createProvenance({
      actor,
      verificationLevel: PROVENANCE_LEVELS.EVIDENCE_PROVIDED,
      documentId: "507f1f77bcf86cd799439012",
      integrityStatus: EVIDENCE_INTEGRITY_STATUSES.VERIFIED,
    });

    expect(provenance).toMatchObject({
      source: { type: PROVENANCE_SOURCES.OWNER, actorId: actor._id },
      verificationLevel: PROVENANCE_LEVELS.EVIDENCE_PROVIDED,
      evidence: { available: true, integrityStatus: EVIDENCE_INTEGRITY_STATUSES.VERIFIED },
    });
  });

  it("records end-of-life as a repairer-attested diagnosis", () => {
    const repairer = { _id: "507f1f77bcf86cd799439013", role: "REPAIRER" } as any;
    const provenance = createProvenance({
      actor: repairer,
      claimType: "END_OF_LIFE_DIAGNOSIS",
      verificationLevel: PROVENANCE_LEVELS.REPAIRER_VERIFIED,
      verificationStatus: "PROFESSIONALLY_ATTESTED",
      evidenceReference: "repair-request-1",
      verifier: repairer,
      signature: { valid: true, signerId: "0.0.123" },
      verifiedAt: new Date("2026-09-20T12:00:00.000Z")
    });

    expect(provenance).toMatchObject({
      claimType: "END_OF_LIFE_DIAGNOSIS",
      source: { type: PROVENANCE_SOURCES.REPAIRER, role: "REPAIRER" },
      verificationLevel: PROVENANCE_LEVELS.REPAIRER_VERIFIED,
      verificationStatus: "PROFESSIONALLY_ATTESTED",
      signature: { status: "VALID", signerId: "0.0.123" }
    });
  });

  it("allows an admin to verify a claim whose provenance remains attributed to its repairer", () => {
    const repairer = { _id: "507f1f77bcf86cd799439013", role: "REPAIRER" } as any;
    const admin = { _id: "507f1f77bcf86cd799439014", role: "ADMIN" } as any;
    const verifiedAt = new Date("2026-09-20T12:00:00.000Z");
    const provenance = createProvenance({
      actor: repairer,
      claimType: "TECHNICAL_INSPECTION",
      verificationLevel: PROVENANCE_LEVELS.REPAIRER_VERIFIED,
      verificationStatus: "TECHNICALLY_VERIFIED",
      verifier: { ...admin, verifiedAt },
      verifiedAt
    });

    expect(provenance).toMatchObject({
      source: { type: PROVENANCE_SOURCES.REPAIRER, actorId: repairer._id },
      verifier: { actorId: admin._id, role: "ADMIN", verifiedAt }
    });
  });

  it("rejects provenance escalation without the required source", () => {
    expect(() => createProvenance({
      actor,
      verificationLevel: PROVENANCE_LEVELS.REPAIRER_VERIFIED,
    })).toThrow("REPAIRER_VERIFIED provenance requires a repairer source");
  });

  it("requires an actor and a valid institution type", () => {
    expect(() => createProvenance()).toThrow("Provenance actor is required");
    expect(() => createProvenance({
      actor: { ...actor, role: "ADMIN", company: "institution" },
      sourceType: PROVENANCE_SOURCES.INSTITUTION,
      verificationLevel: PROVENANCE_LEVELS.INSTITUTION_VERIFIED,
      institutionType: "NOT_AN_INSTITUTION",
      verifiedAt: new Date(),
    })).toThrow("Invalid provenance institution type");
  });

  it("validates safe HCS provenance and rejects invalid institution types", () => {
    expect(validateLifecycleEvent({
      ...baseHcsEvent,
      provenance: {
        sourceType: PROVENANCE_SOURCES.INSTITUTION,
        verificationLevel: PROVENANCE_LEVELS.INSTITUTION_VERIFIED,
        institutionType: INSTITUTION_TYPES.MANUFACTURER,
        evidenceAvailable: true,
        evidenceIntegrityStatus: EVIDENCE_INTEGRITY_STATUSES.VERIFIED,
      },
    }).provenance?.verificationLevel).toBe(PROVENANCE_LEVELS.INSTITUTION_VERIFIED);

    expect(() => validateLifecycleEvent({
      ...baseHcsEvent,
      provenance: {
        sourceType: PROVENANCE_SOURCES.INSTITUTION,
        verificationLevel: PROVENANCE_LEVELS.INSTITUTION_VERIFIED,
        institutionType: "INVALID",
        evidenceAvailable: false,
      },
    })).toThrow("provenance.institutionType is invalid");
  });

  it("defaults old events without provenance safely", () => {
    const event = new LifecycleEvent({
      eventId: "legacy-event",
      product: actor._id,
      type: "REPAIR",
      actor: actor._id,
    });
    const provenance = event.toObject().provenance;

    expect(provenance).toMatchObject({
      source: { type: PROVENANCE_SOURCES.OWNER, actorId: null },
      verificationLevel: PROVENANCE_LEVELS.OWNER_REPORTED,
      evidence: { available: false, integrityStatus: EVIDENCE_INTEGRITY_STATUSES.UNKNOWN },
      verifiedAt: null,
    });
  });
});
