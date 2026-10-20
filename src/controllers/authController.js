const User = require("../models/User");
const signToken = require("../utils/jwt");
const sanitizeUser = require("../utils/sanitizeUser");

async function register(req, res, next) {
  try {
    const { firstName, lastName, email, password, phone, address, role, company } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "firstName, lastName, email and password are required"
      });
    }

    // ADMIN can never be created through public registration.
    const allowedRoles = ["OWNER", "REPAIRER", "BUYER"];
    const selectedRole = role || "OWNER";

    if (!allowedRoles.includes(selectedRole)) {
      return res.status(400).json({
        message: "Public registration only supports OWNER, REPAIRER or BUYER"
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      address,
      role: selectedRole,
      company: company || null,
      isVerified: selectedRole === "OWNER"
    });

    const token = signToken(user);

    res.status(201).json({
      message: "Registration successful",
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() })
      .select("+password")
      .populate("company");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ message: "Account is disabled" });
    }

    const token = signToken(user);

    res.json({
      message: "Login successful",
      token,
      user: sanitizeUser(user)
    });
  } catch (error) {
    next(error);
  }
}

async function me(req, res) {
  res.json({ user: sanitizeUser(req.user) });
}

async function updatePassword(req, res, next) {
  try {
    if (req.user.role !== "OWNER") {
      return res.status(403).json({ message: "Only owners can change their password" });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await user.comparePassword(currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = String(newPassword);
    await user.save();
    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login, me, updatePassword };
