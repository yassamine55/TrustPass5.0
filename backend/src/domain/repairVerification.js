function assertRepairVerificationAssignedToUser({ request, user }) {
  const assignedRepairer = request?.targetRepairerId?._id || request?.targetRepairerId;
  if (!assignedRepairer || assignedRepairer.toString() !== user?._id?.toString()) {
    const error = new Error("This repair verification request is not assigned to you");
    error.statusCode = 403;
    error.code = "REPAIR_VERIFICATION_ASSIGNMENT_FORBIDDEN";
    throw error;
  }
}

module.exports = { assertRepairVerificationAssignedToUser };
