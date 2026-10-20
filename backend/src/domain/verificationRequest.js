const VERIFICATION_REQUEST_STATUSES = Object.freeze({
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED",
  CANCELLED: "CANCELLED"
});

const VERIFICATION_REQUEST_STATUS_VALUES = Object.freeze(Object.values(VERIFICATION_REQUEST_STATUSES));

function policyError(message, code = "VERIFICATION_REQUEST_FORBIDDEN", statusCode = 403) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function assertCanRequestVerification({ user, product, lifecycleEvent }) {
  if (!user || !["OWNER", "REPAIRER"].includes(user.role)) {
    throw policyError("Only an owner or repairer can request institution verification");
  }
  if (!product || !lifecycleEvent || lifecycleEvent.product.toString() !== product._id.toString()) {
    throw policyError("Verification claim does not belong to this device", "VERIFICATION_CLAIM_MISMATCH", 400);
  }

  const isOwner = user.role === "OWNER" && product.owner.toString() === user._id.toString();
  const isClaimActor = lifecycleEvent.actor.toString() === user._id.toString();
  if (!isOwner && !isClaimActor) {
    throw policyError("You are not authorized to request verification for this claim");
  }
}

function assertCanRespondToVerification({ user, institution, request }) {
  if (!user || user._id.toString() === request.requester.toString()) {
    throw policyError("The requester cannot respond to their own verification request");
  }
  if (!institution || request.targetInstitution.toString() !== institution._id.toString()) {
    throw policyError("This verification request belongs to another institution");
  }
  if (request.status !== VERIFICATION_REQUEST_STATUSES.PENDING) {
    throw policyError("This verification request has already been answered", "VERIFICATION_REQUEST_ALREADY_RESPONDED", 409);
  }
}

module.exports = {
  VERIFICATION_REQUEST_STATUSES,
  VERIFICATION_REQUEST_STATUS_VALUES,
  assertCanRequestVerification,
  assertCanRespondToVerification
};
