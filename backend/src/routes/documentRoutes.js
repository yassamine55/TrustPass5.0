const router = require("express").Router();
const { uploadDocument, analyzeDocumentById, verifyDocument, downloadDocument } = require("../controllers/documentController");
const { protect } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.use(protect);

router.post("/", upload.single("file"), uploadDocument);
router.post("/:id/analyze", analyzeDocumentById);
router.get("/:id/download", downloadDocument);
router.get("/:id/verify", verifyDocument);

module.exports = router;
