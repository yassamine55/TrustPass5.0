import { describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import signToken from "../../src/utils/jwt.js";
import { assertInstitutionUser } from "../../src/middleware/institutionPolicy.js";

const institution = {
  _id: "507f1f77bcf86cd799439011",
  type: "AUTHORIZED_SERVICE_CENTER",
  status: "VERIFIED",
  isActive: true,
};

function repairer(overrides: Record<string, unknown> = {}) {
  return {
    _id: "507f1f77bcf86cd799439012",
    role: "REPAIRER",
    isVerified: true,
    company: institution._id,
    ...overrides,
  } as any;
}

describe("institution authorization policy", () => {
  it("allows only a verified repairer attached to the exact institution", () => {
    expect(assertInstitutionUser({ user: repairer(), institution })).toBe(institution);
  });

  it.each([
    ["pending", { status: "PENDING" }],
    ["suspended", { status: "SUSPENDED" }],
    ["inactive", { isActive: false }],
  ])("rejects a %s institution", (_label, changes) => {
    expect(() => assertInstitutionUser({ user: repairer(), institution: { ...institution, ...changes } }))
      .toThrow("Institution is not verified and active");
  });

  it.each([
    ["owner", { role: "OWNER" }],
    ["unassociated repairer", { company: null }],
    ["unverified repairer", { isVerified: false }],
    ["mismatched association", { company: "507f1f77bcf86cd799439099" }],
  ])("rejects a normal %s from acting as an institution user", (_label, changes) => {
    expect(() => assertInstitutionUser({ user: repairer(changes), institution })).toThrow();
  });

  it("does not trust institution type or status in a JWT payload", () => {
    const token = signToken({
      _id: { toString: () => "507f1f77bcf86cd799439012" },
      role: "REPAIRER",
      company: { type: "MANUFACTURER", status: "VERIFIED" },
    } as any);
    const payload = jwt.decode(token) as Record<string, unknown>;

    expect(payload).toMatchObject({ id: "507f1f77bcf86cd799439012", role: "REPAIRER" });
    expect(payload).not.toHaveProperty("company");
    expect(payload).not.toHaveProperty("institution");
    expect(payload).not.toHaveProperty("institutionType");
    expect(payload).not.toHaveProperty("institutionStatus");
  });
});
