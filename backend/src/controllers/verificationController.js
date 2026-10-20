const fs = require("fs");
const Product = require("../models/Product");
const LifecycleEvent = require("../models/LifecycleEvent");
const Document = require("../models/Document");
const sha256File = require("../utils/hashFile");
const { getHederaModule } = require("../services/hederaModule");
const { verifyLifecycleRecordHash } = require("../hedera/verification/lifecycleRecordIntegrity");

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
    const currentRecord = req.query.eventId
      ? await LifecycleEvent.findOne({ eventId: String(req.query.eventId) }).lean()
      : null;
    const result = await requireHedera().verification.verifyLifecycleEvent({
      topicId: req.params.topicId,
      sequenceNumber: Number(req.params.sequenceNumber),
      expectedEventId: req.query.eventId,
      expectedDeviceId: req.query.deviceId,
      currentRecord
    });
    res.json({
      valid: result.valid,
      status: result.status || (result.valid ? "HASH_MATCH" : "INVALID_HCS_PAYLOAD"),
      event: result.event,
      consensusTimestamp: result.message?.consensusTimestamp,
      actualHash: result.actualHash,
      expectedHash: result.expectedHash,
      reason: result.reason
    });
  } catch (error) {
    next(error);
  }
}

async function verifyEvidence(req, res, next) {
  try {
    const document = await Document.findById(req.params.documentId).select("sha256 path product event uploadedBy originalName");
    if (!document) return res.status(404).json({ message: "Document not found" });
    if (!fs.existsSync(document.path)) return res.status(404).json({ message: "Evidence file not found" });
    const currentHash = await sha256File(document.path);
    res.json({
      valid: currentHash === document.sha256,
      documentId: document._id,
      expectedHash: document.sha256,
      actualHash: currentHash,
      status: currentHash === document.sha256 ? "HASH_MATCH" : "HASH_MISMATCH"
    });
  } catch (error) {
    next(error);
  }
}

async function createEvidenceDispute(req, res, next) {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) return res.status(404).json({ message: "Document not found" });

    const product = document.product ? await Product.findById(document.product) : null;
    if (!product) return res.status(404).json({ message: "Associated product not found" });

    if (req.user.role !== "ADMIN" && product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You are not authorized to create a dispute for this evidence" });
    }

    const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
    if (!description) return res.status(400).json({ message: "A dispute description is required" });

    const currentHash = fs.existsSync(document.path) ? await sha256File(document.path) : null;
    const discrepancy = await require("../services/informationDiscrepancyService").createInformationDiscrepancy({
      product,
      actor: req.user,
      description: `Evidence document: ${document.originalName || "Supporting document"}\nSHA-256 integrity: ${currentHash === document.sha256 ? "MATCH" : "MISMATCH"}\nStored hash: ${document.sha256}\nCurrent hash: ${currentHash || "unavailable"}`,
      relatedEvent: document.event,
      sourceRef: `DISCREPANCY:DOCUMENT_HASH:${document._id}:${Date.now()}`
    });

    res.status(201).json({
      message: "Evidence dispute recorded",
      dispute: discrepancy,
      documentId: document._id,
      valid: currentHash === document.sha256
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
      .select("eventId type description document hash recordHash provenance createdAt updatedAt date changedParts price sourceRef relatedEvent verificationRequest actor hederaStatus hederaTopicId hederaSequenceNumber hederaTransactionId hederaConsensusTimestamp")
      .sort({ createdAt: 1 });
    const mirrorEvents = await requireHedera().lifecycleEvents.getDeviceLifecycle({
      deviceId: product.passportId,
      order: "asc",
      limit: 100
    });
    const verificationResults = [];
    for (const localEvent of localEvents) {
      if (!localEvent.hederaTopicId || localEvent.hederaSequenceNumber === null || localEvent.hederaSequenceNumber === undefined) {
        verificationResults.push({ eventId: localEvent.eventId, status: "HCS_RECORD_NOT_FOUND" });
        continue;
      }
      try {
        const messages = await requireHedera().mirrorNode.getTopicMessages(localEvent.hederaTopicId, {
          sequenceNumber: localEvent.hederaSequenceNumber,
          limit: 1,
        });
        const message = messages.find((item) => item.sequenceNumber === localEvent.hederaSequenceNumber);
        const result = verifyLifecycleRecordHash({
          currentRecord: localEvent.toObject ? localEvent.toObject() : localEvent,
          hcsMessageText: message?.messageText
        });
        verificationResults.push({
          eventId: localEvent.eventId,
          status: result.status,
          valid: result.valid,
          actualHash: result.actualHash,
          expectedHash: result.expectedHash,
          reason: result.reason
        });
      } catch (error) {
        verificationResults.push({
          eventId: localEvent.eventId,
          status: "INVALID_HCS_PAYLOAD",
          valid: false,
          reason: error instanceof Error ? error.message : "Unable to verify HCS record integrity"
        });
      }
    }
    const hashMatchCount = verificationResults.filter((result) => result.status === "HASH_MATCH").length;
    res.json({
      passportId: product.passportId,
      localEvents,
      mirrorEvents,
      verificationResults,
      hashMatchCount,
      status: hashMatchCount > 0 && hashMatchCount === verificationResults.length ? "HASH_MATCH" : verificationResults.length ? "HASH_MISMATCH" : "HCS_RECORD_NOT_FOUND"
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { verifyNft, verifyLifecycle, verifyEvidence, createEvidenceDispute, verifyTransaction, getHistory };