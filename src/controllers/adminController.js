const User = require("../models/User");
const Company = require("../models/Company");
const Product = require("../models/Product");
const Repair = require("../models/Repair");
const RecyclingEvent = require("../models/RecyclingEvent");
const LifecycleEvent = require("../models/LifecycleEvent");
const sanitizeUser = require("../utils/sanitizeUser");

async function getUsers(req, res, next) {
  try {
    const users = await User.find().populate("company").sort({ createdAt: -1 });
    res.json(users.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
}

async function verifyUser(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVerified: true },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "User verified", user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function setUserStatus(req, res, next) {
  try {
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({ message: "isActive must be boolean" });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "ADMIN") {
      return res.status(400).json({ message: "The single admin cannot be disabled here" });
    }

    user.isActive = isActive;
    await user.save();

    res.json({ message: "User status updated", user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function createCompany(req, res, next) {
  try {
    const company = await Company.create(req.body);
    res.status(201).json(company);
  } catch (error) {
    next(error);
  }
}

async function getCompanies(req, res, next) {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (error) {
    next(error);
  }
}

async function verifyCompany(req, res, next) {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isVerified: true, verificationStatus: "VERIFIED", verifiedBy: req.user._id, verifiedAt: new Date() },
      { new: true }
    );

    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ message: "Company verified", company });
  } catch (error) {
    next(error);
  }
}

async function rejectCompany(req, res, next) {
  try {
    const company = await Company.findByIdAndUpdate(
      req.params.id,
      { isVerified: false, verificationStatus: "REJECTED", verifiedBy: req.user._id, verifiedAt: new Date() },
      { new: true }
    );

    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ message: "Company rejected", company });
  } catch (error) {
    next(error);
  }
}

async function setUserCompany(req, res, next) {
  try {
    const { company } = req.body;
    const [user, organization] = await Promise.all([
      User.findById(req.params.id),
      company ? Company.findById(company) : null
    ]);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (company && !organization) return res.status(404).json({ message: "Company not found" });
    user.company = organization?._id || null;
    await user.save();
    res.json({ message: "User company updated", user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

async function stats(req, res, next) {
  try {
    const [
      users,
      products,
      repairs,
      recycled,
      companies,
      events
    ] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Repair.countDocuments(),
      RecyclingEvent.countDocuments(),
      Company.countDocuments(),
      LifecycleEvent.countDocuments()
    ]);

    res.json({
      users,
      products,
      repairs,
      recycled,
      companies,
      lifecycleEvents: events
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  verifyUser,
  setUserStatus,
  createCompany,
  getCompanies,
  verifyCompany,
  rejectCompany,
  setUserCompany,
  stats
};
