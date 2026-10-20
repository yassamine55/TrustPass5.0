const INSTITUTION_VERIFICATION_MODE = "DEMO_TEST";
const EXTERNAL_VERIFICATION_MODE = "EXTERNAL_VERIFICATION";

const INSTITUTION_VERIFICATION_SCOPES = Object.freeze({
  MANUFACTURER: Object.freeze({
    claimTypes: ["PRODUCT_CREATED"],
    label: "device identity and origin",
    limitation: "No external manufacturer database is connected; this is a demo/test review of the submitted record.",
    externalLimitation: "This mode does not connect to an external manufacturer system."
  }),
  AUTHORIZED_SERVICE_CENTER: Object.freeze({
    claimTypes: ["REPAIR", "MAINTENANCE"],
    label: "authorized service record",
    limitation: "No external service-center system is connected; this is a demo/test review of the submitted record and evidence.",
    externalLimitation: "This mode does not connect to an external service-center system."
  }),
  CERTIFIED_RECYCLER: Object.freeze({
    claimTypes: ["RECYCLED", "DECOMMISSIONED"],
    label: "recycling or decommissioning record",
    limitation: "No external recycling registry is connected; this is a demo/test review of the submitted record and evidence.",
    externalLimitation: "This mode does not connect to an external recycling registry."
  })
});

function getInstitutionVerificationScope(institutionType, claimType, mode = INSTITUTION_VERIFICATION_MODE) {
  const scope = INSTITUTION_VERIFICATION_SCOPES[institutionType];
  if (!scope || !scope.claimTypes.includes(claimType)) return null;

  const resolvedMode = mode === EXTERNAL_VERIFICATION_MODE ? EXTERNAL_VERIFICATION_MODE : INSTITUTION_VERIFICATION_MODE;
  const externalSystemConnected = resolvedMode === EXTERNAL_VERIFICATION_MODE;

  return {
    institutionType,
    claimType,
    label: scope.label,
    limitation: externalSystemConnected
      ? `External verification is connected for ${scope.label}. This mode uses an external institution system.`
      : scope.limitation,
    mode: resolvedMode,
    verificationSource: resolvedMode,
    externalSystemConnected
  };
}

function assertInstitutionCanReview({ institution, claimType, mode = INSTITUTION_VERIFICATION_MODE }) {
  const scope = getInstitutionVerificationScope(institution?.type, claimType, mode);
  if (!scope) {
    const error = new Error("This institution type cannot independently verify this claim type");
    error.statusCode = 409;
    error.code = "INSTITUTION_VERIFICATION_SCOPE_UNSUPPORTED";
    throw error;
  }
  return scope;
}

module.exports = {
  INSTITUTION_VERIFICATION_MODE,
  EXTERNAL_VERIFICATION_MODE,
  INSTITUTION_VERIFICATION_SCOPES,
  getInstitutionVerificationScope,
  assertInstitutionCanReview
};
