const transitions = {
  REPAIR: { from: ["ACTIVE", "MAINTENANCE"], to: "ACTIVE" },
  MAINTENANCE: { from: ["ACTIVE", "MAINTENANCE"], to: "MAINTENANCE" },
  RESALE: { from: ["ACTIVE", "MAINTENANCE"], to: null },
  END_OF_LIFE: { from: ["ACTIVE", "MAINTENANCE"], to: "END_OF_LIFE" },
  LISTED_FOR_PARTS: { from: ["END_OF_LIFE"], to: "LISTED_FOR_PARTS" },
  SOLD_FOR_PARTS: { from: ["LISTED_FOR_PARTS"], to: "SOLD_FOR_PARTS" },
  RECYCLED: { from: ["SOLD_FOR_PARTS"], to: "RECYCLED" },
  DECOMMISSIONED: { from: ["SOLD_FOR_PARTS"], to: "DECOMMISSIONED" }
};

function assertLifecycleTransition(status, eventType) {
  const transition = transitions[eventType];
  if (!transition) {
    throw badTransition(`Lifecycle event ${eventType} must use its dedicated workflow`);
  }
  if (!transition.from.includes(status)) {
    throw badTransition(`${eventType} is not allowed from product status ${status}`);
  }
  return transition.to;
}

function assertLifecycleAuthorization({ eventType, user, product, repairRequest }) {
  if (eventType === "END_OF_LIFE" && (user.role !== "REPAIRER" || !user.isVerified || !repairRequest)) {
    throw forbidden("Only a verified repairer can declare end of life through a repair request");
  }
  if (["RECYCLED", "DECOMMISSIONED"].includes(eventType) && (user.role !== "BUYER" || !user.isVerified)) {
    throw forbidden("Only a verified buyer can complete end-of-life processing");
  }
  if (eventType === "LISTED_FOR_PARTS" && !(
    user.role === "OWNER" && product.owner.toString() === user._id.toString()
  )) {
    throw forbidden("Only the owner can list a device for parts");
  }
}

function badTransition(message) {
  const error = new Error(message);
  error.statusCode = 409;
  error.code = "INVALID_LIFECYCLE_TRANSITION";
  return error;
}

function forbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = "LIFECYCLE_AUTHORIZATION_FAILED";
  return error;
}

module.exports = { assertLifecycleTransition, assertLifecycleAuthorization, transitions };