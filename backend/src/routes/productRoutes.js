const router = require("express").Router();
const {
  createProduct,
  getProducts,
  getProduct,
  getPassportProof,
  retryPassportProof,
  verifyPassportProof,
  requestTechnicalInspection,
  reportStolen,
  updateListing
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/auth");
const { devicePhotoUpload } = require("../middleware/upload");

router.use(protect);

router.post("/", authorize("OWNER"), devicePhotoUpload.single("photo"), createProduct);
router.get("/:id/hedera-proof", authorize("OWNER"), getPassportProof);
router.post("/:id/hedera-proof/retry", authorize("OWNER"), retryPassportProof);
router.post("/:id/hedera-proof/verify", authorize("OWNER"), verifyPassportProof);
router.get("/", getProducts);
router.get("/:id", getProduct);
router.post("/:id/technical-inspection-request", requestTechnicalInspection);
router.post("/:id/stolen-report", authorize("OWNER"), reportStolen);
router.patch("/:id/listing", authorize("OWNER"), updateListing);

module.exports = router;
