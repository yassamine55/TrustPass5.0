const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const { available, getInspection, acceptInspection, completeInspection } = require("../controllers/technicalInspectionController");

router.use(protect);
router.get("/available", authorize("REPAIRER"), available);
router.get("/:id", getInspection);
router.post("/:id/accept", authorize("REPAIRER"), acceptInspection);
router.post("/:id/complete", authorize("REPAIRER"), completeInspection);

module.exports = router;