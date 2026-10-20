function sanitizeUser(user) {
  if (!user) return null;

  const institution = user.company && user.company._id
    ? {
      _id: user.company._id,
      name: user.company.name,
      type: user.company.type,
      status: user.company.status,
      isActive: user.company.isActive
    }
    : null;

  return {
    _id: user._id,
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    address: user.address,
    role: user.role,
    isVerified: user.isVerified,
    isActive: user.isActive,
    company: user.company,
    institution,
    hederaAccountId: user.hederaAccountId
  };
}

module.exports = sanitizeUser;
