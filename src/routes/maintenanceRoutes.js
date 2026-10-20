const router = require("express").Router();
const {
  createMaintenance,
  getMaintenances
} = require("../controllers/maintenanceController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/", createMaintenance);
router.get("/", getMaintenances);

module.exports = router;
