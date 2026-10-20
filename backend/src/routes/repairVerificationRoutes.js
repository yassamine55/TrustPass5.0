const router = require("express").Router();
const { protect, authorize } = require("../middleware/auth");
const { list, respond } = require("../controllers/repairVerificationController");

router.use(protect, authorize("REPAIRER"));
router.get("/", list);
router.post("/:id/respond", respond);

module.exports = router;