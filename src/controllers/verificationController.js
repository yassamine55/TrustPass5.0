const fs = require("fs");
const Product = require("../models/Product");
const LifecycleEvent = require("../models/LifecycleEvent");
const Document = require("../models/Document");
const sha256File = require("../utils/hashFile");
const { getHederaModule } = require("../services/hederaModule");

function requireHedera() {
  const hedera = getHederaModule();
  if (!hedera) {
    const error = new Error("Hedera integration is disabled");
    error.statusCode = 503;
    throw error;
  }
  return hedera;
}

async function verifyNft(req, res, next) {
  try {
    const nft = await requireHedera().verification.getDeviceNft(
      req.params.tokenId,
      Number(req.params.serialNumber)
    );
    res.json({
      valid: Boolean(nft.tokenId && nft.serialNumber),
      tokenId: nft.tokenId,
      serialNumber: nft.serialNumber,
      accountId: nft.accountId,
      metadataText: nft.metadataText,
      createdTimestamp: nft.createdTimestamp
    });
  } catch (error) {
    next(error);
  }
}

async function verifyLifecycle(req, res, next) {
  try {
    const result = await requireHedera().verification.verifyLifecycleEvent({
      topicId: req.params.topicId,
      sequenceNumber: Number(req.params.sequenceNumber),
      expectedEventId: req.query.eventId,
      expectedDeviceId: req.query.deviceId
    });
    res.json({
      valid: result.valid,
      event: result.event,
      consensusTimestamp: result.message?.consensusTimestamp,
      reason: result.reason
    });
  } catch (error) {
    next(error);
  }
}

async function verifyEvidence(req, res, next) {
  try {
    const document = await Document.findById(req.params.documentId).select("sha256 path");
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (!fs.existsSync(document.path)) return res.status(404).json({ message: "Evidence file not found" });
    const currentHash = await sha256File(document.path);
    res.json({
      valid: currentHash === document.sha256,
      documentId: document._id,
      expectedHash: document.sha256,
      actualHash: currentHash
    });
  } catch (error) {
    next(error);
  }
}

async function verifyTransaction(req, res, next) {
  try {
    const transaction = await requireHedera().transactions.getTransactionStatus(req.params.transactionId);
    res.json({ valid: true, transaction });
  } catch (error) {
    next(error);
  }
}

async function getHistory(req, res, next) {
  try {
    const product = await Product.findOne({ passportId: req.params.passportId }).select("passportId hederaTokenId hederaSerialNumber");
    if (!product) return res.status(404).json({ message: "Passport not found" });
    const localEvents = await LifecycleEvent.find({ product: product._id })
      .select("eventId type hederaStatus hederaTopicId hederaSequenceNumber hederaTransactionId hederaConsensusTimestamp")
      .sort({ createdAt: 1 });
    const mirrorEvents = await requireHedera().lifecycleEvents.getDeviceLifecycle({
      deviceId: product.passportId,
      order: "asc",
      limit: 100
    });
    res.json({ passportId: product.passportId, localEvents, mirrorEvents });
  } catch (error) {
    next(error);
  }
}

module.exports = { verifyNft, verifyLifecycle, verifyEvidence, verifyTransaction, getHistory };