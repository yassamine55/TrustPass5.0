const router = require("express").Router();
const {
  create,
  list,
  getOne,
  verify,
  reject
} = require("../controllers/verificationRequestController");
const { protect, authorize } = require("../middleware/auth");
const { requireVerifiedInstitutionUser } = require("../middleware/institutionPolicy");

router.use(protect);

router.post("/", authorize("OWNER", "REPAIRER"), create);
router.get("/", list);
router.get("/:id", getOne);
router.post("/:id/verify", authorize("REPAIRER"), requireVerifiedInstitutionUser, verify);
router.post("/:id/reject", authorize("REPAIRER"), requireVerifiedInstitutionUser, reject);

module.exports = router;
