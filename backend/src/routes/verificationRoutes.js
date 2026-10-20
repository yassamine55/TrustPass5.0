const router = require("express").Router();
const {
  verifyNft,
  verifyLifecycle,
  verifyEvidence,
  createEvidenceDispute,
  verifyTransaction,
  getHistory
} = require("../controllers/verificationController");
const { protect, authorize } = require("../middleware/auth");

router.get("/nft/:tokenId/:serialNumber", verifyNft);
router.get("/lifecycle/:topicId/:sequenceNumber", verifyLifecycle);
router.get("/evidence/:documentId", verifyEvidence);
router.post("/evidence/:documentId/dispute", protect, authorize("ADMIN", "OWNER"), createEvidenceDispute);
router.get("/transaction/:transactionId", verifyTransaction);
router.get("/history/:passportId", getHistory);

module.exports = router;