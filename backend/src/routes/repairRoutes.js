const router = require("express").Router();
const { createRepair, createOwnerRepairClaim, getRepairers, confirmRepair, professionallyConfirmRepair, getRepair, getRepairs } = require("../controllers/repairController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.get("/repairers", getRepairers);
router.post("/", authorize("REPAIRER"), createRepair);
router.post("/claims", authorize("OWNER"), createOwnerRepairClaim);
router.patch("/:id/owner-confirmation", authorize("OWNER"), confirmRepair);
router.post("/:id/professional-confirmation", authorize("REPAIRER"), professionallyConfirmRepair);
router.get("/", getRepairs);
router.get("/:id", getRepair);

module.exports = router;
