const Company = require("../models/Company");

function forbidden(message) {
  const error = new Error(message);
  error.statusCode = 403;
  error.code = "INSTITUTION_AUTHORIZATION_FAILED";
  return error;
}

function assertInstitutionUser({ user, institution }) {
  if (!user) throw forbidden("Authentication required");
  if (user.role !== "REPAIRER") throw forbidden("Only an institution repairer can perform this action");
  if (!user.company || !institution) throw forbidden("No institution is associated with this user");

  const associatedId = user.company._id ? user.company._id.toString() : user.company.toString();
  if (associatedId !== institution._id.toString()) {
    throw forbidden("Institution association is invalid");
  }
  if (!user.isVerified) throw forbidden("User institution access is not verified");
  if (institution.status !== "VERIFIED" || institution.isActive !== true) {
    throw forbidden("Institution is not verified and active");
  }

  return institution;
}

async function requireVerifiedInstitutionUser(req, res, next) {
  try {
    const institutionId = req.user?.company?._id || req.user?.company;
    const institution = institutionId ? await Company.findById(institutionId) : null;
    req.institution = assertInstitutionUser({ user: req.user, institution });
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { assertInstitutionUser, requireVerifiedInstitutionUser };
