const router = require("express").Router();
const { adminList, adminDecideRequest, adminReview, getInspection } = require("../controllers/technicalInspectionController");
const {
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
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");
const { createTopic, createDeviceToken } = require("../controllers/hederaAdminController");

router.use(protect, authorize("ADMIN"));

router.get("/technical-inspections", adminList);
router.get("/technical-inspections/:id", getInspection);
router.patch("/technical-inspections/:id/request", adminDecideRequest);
router.post("/technical-inspections/:id/review", adminReview);

router.get("/users", getUsers);
router.get("/repairers/verified", getVerifiedRepairers);
router.patch("/users/:id/verify", verifyUser);
router.patch("/users/:id/status", setUserStatus);
router.patch("/users/:id/institution", setUserInstitution);

router.post("/companies", createCompany);
router.get("/companies", getCompanies);
router.patch("/companies/:id/verify", verifyCompany);

router.get("/device-certificates", getDeviceCertificates);
router.patch("/device-certificates/:id/review", reviewDeviceCertificate);

router.get("/stats", stats);
router.post("/hedera/topic", createTopic);
router.post("/hedera/device-token", createDeviceToken);

module.exports = router;
