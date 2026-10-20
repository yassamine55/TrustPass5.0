function sanitizeUser(user) {
  if (!user) return null;

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
    company: user.company
  };
}

module.exports = sanitizeUser;
