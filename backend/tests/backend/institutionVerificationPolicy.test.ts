import { describe, expect, it } from "vitest";
import {
  INSTITUTION_VERIFICATION_MODE,
  assertInstitutionCanReview,
  getInstitutionVerificationScope,
} from "../../src/domain/institutionVerificationPolicy.js";

describe("institution verification scope", () => {
  it.each([
    ["MANUFACTURER", "PRODUCT_CREATED", "DEMO_TEST", false],
    ["AUTHORIZED_SERVICE_CENTER", "REPAIR", "DEMO_TEST", false],
    ["CERTIFIED_RECYCLER", "RECYCLED", "DEMO_TEST", false],
    ["MANUFACTURER", "PRODUCT_CREATED", "EXTERNAL_VERIFICATION", true],
    ["AUTHORIZED_SERVICE_CENTER", "REPAIR", "EXTERNAL_VERIFICATION", true],
    ["CERTIFIED_RECYCLER", "RECYCLED", "EXTERNAL_VERIFICATION", true],
  ])("allows %s to review %s in %s mode", (institutionType, claimType, mode, externalSystemConnected) => {
    const scope = getInstitutionVerificationScope(institutionType, claimType, mode);
    expect(scope).toMatchObject({
      institutionType,
      claimType,
      mode,
      verificationSource: mode,
      externalSystemConnected
    });
    expect(scope?.label).toBeTruthy();
  });

  it("rejects an institution type outside its legitimate scope", () => {
    expect(getInstitutionVerificationScope("MANUFACTURER", "REPAIR")).toBeNull();
    expect(() => assertInstitutionCanReview({ institution: { type: "MANUFACTURER" }, claimType: "REPAIR" }))
      .toThrow("cannot independently verify");
  });

  it("explicitly distinguishes demo verification from real external verification", () => {
    const demoScope = getInstitutionVerificationScope("AUTHORIZED_SERVICE_CENTER", "REPAIR", "DEMO_TEST");
    const externalScope = getInstitutionVerificationScope("AUTHORIZED_SERVICE_CENTER", "REPAIR", "EXTERNAL_VERIFICATION");

    expect(demoScope?.mode).toBe("DEMO_TEST");
    expect(demoScope?.verificationSource).toBe("DEMO_TEST");
    expect(demoScope?.externalSystemConnected).toBe(false);
    expect(demoScope?.limitation).toContain("No external service-center system");

    expect(externalScope?.mode).toBe("EXTERNAL_VERIFICATION");
    expect(externalScope?.verificationSource).toBe("EXTERNAL_VERIFICATION");
    expect(externalScope?.externalSystemConnected).toBe(true);
    expect(externalScope?.limitation).toContain("external institution system");
  });

  it("keeps the default demo mode explicit for compatibility", () => {
    const scope = getInstitutionVerificationScope("AUTHORIZED_SERVICE_CENTER", "REPAIR");
    expect(scope?.mode).toBe(INSTITUTION_VERIFICATION_MODE);
    expect(scope?.verificationSource).toBe(INSTITUTION_VERIFICATION_MODE);
    expect(scope?.externalSystemConnected).toBe(false);
  });
});
