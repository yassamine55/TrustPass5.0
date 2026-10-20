const AMENDMENT_EVENT_TYPES = Object.freeze({
  DISPUTED: "EVENT_DISPUTED",
  CORRECTED: "EVENT_CORRECTED",
  REVOKED: "EVENT_REVOKED"
});

const AMENDMENT_EVENT_TYPE_VALUES = Object.freeze(Object.values(AMENDMENT_EVENT_TYPES));

function assertLifecycleAmendment({ user, product, original }) {
  const isAdmin = user?.role === "ADMIN";
  const isOwner = user?.role === "OWNER" && product.owner.toString() === user._id.toString();
  const isOriginalActor = original.actor.toString() === user?._id?.toString();
  if (!isAdmin && !isOwner && !isOriginalActor) {
    const error = new Error("Only the owner, original actor, or administrator can amend a lifecycle event");
    error.statusCode = 403;
    error.code = "LIFECYCLE_AMENDMENT_FORBIDDEN";
    throw error;
  }
}

module.exports = { AMENDMENT_EVENT_TYPES, AMENDMENT_EVENT_TYPE_VALUES, assertLifecycleAmendment };
