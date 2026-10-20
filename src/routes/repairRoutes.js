const router = require("express").Router();
const { createRepair, getRepair, getRepairs } = require("../controllers/repairController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/", authorize("REPAIRER"), createRepair);
router.get("/", getRepairs);
router.get("/:id", getRepair);

module.exports = router;
