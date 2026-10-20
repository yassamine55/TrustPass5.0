const router = require("express").Router();
const {
  requestTransfer,
  acceptTransfer,
  getMyTransfers
} = require("../controllers/transferController");
const { protect, authorize } = require("../middleware/auth");

router.use(protect);

router.post("/", requestTransfer);
router.post("/:id/accept", authorize("OWNER", "BUYER"), acceptTransfer);
router.get("/mine", authorize("OWNER"), getMyTransfers);

module.exports = router;
