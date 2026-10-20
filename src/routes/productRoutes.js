const router = require("express").Router();
const {
  createProduct,
  getProducts,
  getProduct,
  requestTechnicalInspection,
  reportStolen
} = require("../controllers/productController");
const { protect, authorize } = require("../middleware/auth");
const { devicePhotoUpload } = require("../middleware/upload");

router.use(protect);

router.post("/", authorize("OWNER"), devicePhotoUpload.fields([
  { name: "photo", maxCount: 1 },
  { name: "devicePhoto", maxCount: 1 }
]), createProduct);
router.get("/", getProducts);
router.get("/:id", getProduct);
router.post("/:id/technical-inspection-request", requestTechnicalInspection);
router.post("/:id/stolen-report", authorize("OWNER"), reportStolen);

module.exports = router;
