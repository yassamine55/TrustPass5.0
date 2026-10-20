const User = require("../models/User");
const Company = require("../models/Company");
const Product = require("../models/Product");
const Repair = require("../models/Repair");
const RecyclingEvent = require("../models/RecyclingEvent");
const LifecycleEvent = require("../models/LifecycleEvent");
const Document = require("../models/Document");
const sanitizeUser = require("../utils/sanitizeUser");

async function getUsers(req, res, next) {
  try {
    const users = await User.find().populate("company").sort({ createdAt: -1 });
    res.json(users.map(sanitizeUser));
  } catch (error) {
    next(error);
  }
}

async function getVerifiedRepairers(req, res, next) {
  try {
    const repairers = await User.find({ role: "REPAIRER", isVerified: true, isActive: true })
      .select("firstName lastName email company")
      .populate("company", "name")
      .sort({ lastName: 1, firstName: 1 });
    res.json(repairers);
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

async function setUserInstitution(req, res, next) {
  try {
    const { institutionId } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "REPAIRER") {
      return res.status(400).json({ message: "Only repairers can be associated with an institution" });
    }

    if (institutionId === null || institutionId === "") {
      user.company = null;
    } else {
      const institution = await Company.findById(institutionId);
      if (!institution) return res.status(404).json({ message: "Institution not found" });
      user.company = institution._id;
    }
    await user.save();
    await user.populate("company");
    res.json({ message: "User institution association updated", user: sanitizeUser(user) });
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
      { isVerified: true, status: "VERIFIED", isActive: true },
      { new: true }
    );

    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json({ message: "Company verified", company });
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

async function getDeviceCertificates(req, res, next) {
  try {
    const documents = await Document.find({
      claimType: "DEVICE_CERTIFICATE",
      "adminReview.status": "PENDING"
    })
      .populate({ path: "product", select: "brand model passportId owner", populate: { path: "owner", select: "firstName lastName email" } })
      .sort({ createdAt: 1 });
    res.json(documents);
  } catch (error) {
    next(error);
  }
}

async function reviewDeviceCertificate(req, res, next) {
  try {
    const { action, note } = req.body;
    if (!["APPROVE", "REJECT"].includes(action)) {
      return res.status(400).json({ message: "action must be APPROVE or REJECT" });
    }
    const reviewNote = typeof note === "string" ? note.trim() : "";
    if (action === "REJECT" && reviewNote.length < 3) {
      return res.status(400).json({ message: "A review note is required when rejecting a certificate" });
    }

    const document = await Document.findOne({
      _id: req.params.id,
      claimType: "DEVICE_CERTIFICATE",
      "adminReview.status": "PENDING"
    });
    if (!document) return res.status(404).json({ message: "Pending device certificate not found" });

    document.adminReview = {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      reviewer: req.user._id,
      reviewedAt: new Date(),
      note: reviewNote || null
    };
    await document.save();
    res.json({ message: action === "APPROVE" ? "Certificate approved" : "Certificate rejected", document });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getUsers,
  getVerifiedRepairers,
  verifyUser,
  setUserStatus,
  setUserInstitution,
  createCompany,
  getCompanies,
  verifyCompany,
  stats,
  getDeviceCertificates,
  reviewDeviceCertificate
};
