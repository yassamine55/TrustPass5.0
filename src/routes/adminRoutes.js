const router = require("express").Router();
const {
  getUsers,
  verifyUser,
  setUserStatus,
  createCompany,
  getCompanies,
  verifyCompany,
  rejectCompany,
  setUserCompany,
  stats
} = require("../controllers/adminController");
const { protect, authorize } = require("../middleware/auth");
const { createTopic, createDeviceToken } = require("../controllers/hederaAdminController");

router.use(protect, authorize("ADMIN"));

router.get("/users", getUsers);
router.patch("/users/:id/verify", verifyUser);
router.patch("/users/:id/status", setUserStatus);
router.patch("/users/:id/company", setUserCompany);

router.post("/companies", createCompany);
router.get("/companies", getCompanies);
router.patch("/companies/:id/verify", verifyCompany);
router.patch("/companies/:id/reject", rejectCompany);

router.get("/stats", stats);
router.post("/hedera/topic", createTopic);
router.post("/hedera/device-token", createDeviceToken);

module.exports = router;
