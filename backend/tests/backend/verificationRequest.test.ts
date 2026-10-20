import { describe, expect, it } from "vitest";
import VerificationRequest from "../../src/models/VerificationRequest.js";
import {
  VERIFICATION_REQUEST_STATUSES,
  assertCanRequestVerification,
  assertCanRespondToVerification,
} from "../../src/domain/verificationRequest.js";

const product = {
  _id: "507f1f77bcf86cd799439011",
  owner: { toString: () => "owner-1" },
} as any;
const claim = {
  _id: "507f1f77bcf86cd799439012",
  product: product._id,
  actor: { toString: () => "repairer-1" },
} as any;
const institution = {
  _id: "507f1f77bcf86cd799439013",
  status: "VERIFIED",
  isActive: true,
  type: "MANUFACTURER",
} as any;
const request = {
  requester: "requester-1",
  targetInstitution: institution._id,
  status: VERIFICATION_REQUEST_STATUSES.PENDING,
} as any;

describe("verification request policies", () => {
  it("allows the current owner or claim actor to request verification", () => {
    expect(() => assertCanRequestVerification({
      user: { _id: "owner-1", role: "OWNER" } as any,
      product,
      lifecycleEvent: claim,
    })).not.toThrow();
    expect(() => assertCanRequestVerification({
      user: { _id: "repairer-1", role: "REPAIRER" } as any,
      product,
      lifecycleEvent: claim,
    })).not.toThrow();
  });

  it("rejects an unrelated user requesting verification", () => {
    expect(() => assertCanRequestVerification({
      user: { _id: "other", role: "OWNER" } as any,
      product,
      lifecycleEvent: claim,
    })).toThrow("not authorized");
  });

  it("rejects the requester responding to their own request", () => {
    expect(() => assertCanRespondToVerification({
      user: { _id: "requester-1", role: "REPAIRER" } as any,
      institution,
      request,
    })).toThrow("requester cannot respond");
  });

  it("rejects another institution responding", () => {
    expect(() => assertCanRespondToVerification({
      user: { _id: "institution-user", role: "REPAIRER" } as any,
      institution: { ...institution, _id: "507f1f77bcf86cd799439099" },
      request,
    })).toThrow("another institution");
  });

  it.each([VERIFICATION_REQUEST_STATUSES.VERIFIED, VERIFICATION_REQUEST_STATUSES.REJECTED])(
    "rejects duplicate response for %s request",
    (status) => {
      expect(() => assertCanRespondToVerification({
        user: { _id: "institution-user", role: "REPAIRER" } as any,
        institution,
        request: { ...request, status },
      })).toThrow("already been answered");
    }
  );

  it("defaults new requests to pending and cannot store a caller-selected final level", async () => {
    const created = new VerificationRequest({
      product: product._id,
      lifecycleEvent: claim._id,
      requester: "507f1f77bcf86cd799439014",
      targetInstitution: institution._id,
      reason: "Please independently review this repair claim",
    });
    expect(created.status).toBe(VERIFICATION_REQUEST_STATUSES.PENDING);
    expect((created as any).verificationLevel).toBeUndefined();
    const invalid = new VerificationRequest({
      product: product._id,
      lifecycleEvent: claim._id,
      requester: "507f1f77bcf86cd799439014",
      targetInstitution: institution._id,
      reason: "Please independently review this repair claim",
      status: "INSTITUTION_VERIFIED",
    });
    await expect(invalid.validate()).rejects.toThrow("is not a valid enum value");
  });
});
