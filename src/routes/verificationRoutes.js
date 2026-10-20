const router = require("express").Router();
const {
  verifyNft,
  verifyLifecycle,
  verifyEvidence,
  verifyTransaction,
  getHistory
} = require("../controllers/verificationController");

router.get("/nft/:tokenId/:serialNumber", verifyNft);
router.get("/lifecycle/:topicId/:sequenceNumber", verifyLifecycle);
router.get("/evidence/:documentId", verifyEvidence);
router.get("/transaction/:transactionId", verifyTransaction);
router.get("/history/:passportId", getHistory);

module.exports = router;