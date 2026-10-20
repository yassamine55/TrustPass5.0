const Product = require("../models/Product");
const Repair = require("../models/Repair");
const LifecycleEvent = require("../models/LifecycleEvent");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { assertLifecycleTransition } = require("../services/lifecycleState");
const Document = require("../models/Document");
const { getHederaModule } = require("../services/hederaModule");

async function createRepair(req, res, next) {
  try {
    if (req.user.role !== "REPAIRER" || !req.user.isVerified) {
      return res.status(403).json({
        message: "Only a verified repairer can register a repair"
      });
    }

    const { product, description, changedParts, price, invoice, invoiceHash, date, documentId, signature } = req.body;

    const target = await Product.findById(product);
    if (!target) return res.status(404).json({ message: "Product not found" });

    assertLifecycleTransition(target.status, "REPAIR");

    let evidenceDocument = null;
    if (documentId) {
      evidenceDocument = await Document.findById(documentId);
      if (!evidenceDocument) return res.status(404).json({ message: "Evidence document not found" });
      if (evidenceDocument.uploadedBy.toString() !== req.user._id.toString() && req.user.role !== "ADMIN") {
        return res.status(403).json({ message: "Evidence document access denied" });
      }
    }

    let signatureValid = null;
    let signatureError = null;
    if (signature) {
      const hedera = getHederaModule();
      if (hedera && req.user.hederaAccountId) {
        const result = await hedera.repairerSignatures.verifySignature({
          accountId: req.user.hederaAccountId,
          payload: { product, description, changedParts: changedParts || [], date },
          signature: Buffer.from(signature, "base64")
        });
        signatureValid = result.valid;
        signatureError = result.reason || null;
        if (!result.valid) return res.status(400).json({ message: "Repairer signature is invalid" });
      }
    }

    const repair = await Repair.create({
      repairId: generateId("REP"),
      product,
      repairer: req.user._id,
      description,
      changedParts: changedParts || [],
      price,
      invoice: invoice || null,
      invoiceHash: invoiceHash || null,
      evidenceDocument: evidenceDocument?._id || null,
      evidenceHash: evidenceDocument?.sha256 || invoiceHash || null,
      signature: signature || null,
      signatureValid,
      signatureError,
      date
    });

    target.status = "ACTIVE";
    await target.save();

    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product,
      type: "REPAIR",
      actor: req.user._id,
      description,
      document: evidenceDocument?._id || null,
      hash: evidenceDocument?.sha256 || invoiceHash || null,
      sourceRef: repair.repairId
    });
    const blockchain = await publishAndPersistLifecycleEvent({ product: target, lifecycleEvent, actor: req.user });
    repair.lifecycleEvent = lifecycleEvent._id;
    repair.hederaStatus = blockchain.status;
    repair.hederaTopicId = blockchain.topicId;
    repair.hederaSequenceNumber = blockchain.sequenceNumber;
    repair.hederaTransactionId = blockchain.transactionId;
    repair.hederaConsensusTimestamp = blockchain.consensusTimestamp;
    repair.hederaError = blockchain.error;
    await repair.save();

    const populated = await Repair.findById(repair._id)
      .populate("product")
      .populate("repairer", "firstName lastName email role isVerified company");

    res.status(201).json({
      message: "Repair saved",
      repair: populated
    });
  } catch (error) {
    next(error);
  }
}

async function getRepair(req, res, next) {
  try {
    const repair = await Repair.findById(req.params.id)
      .populate("product")
      .populate("repairer", "firstName lastName email role isVerified company");

    if (!repair) return res.status(404).json({ message: "Repair not found" });

    if (req.user.role !== "ADMIN" && repair.repairer._id.toString() !== req.user._id.toString()) {
      const product = repair.product;
      if (!product || product.owner.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    res.json(repair);
  } catch (error) {
    next(error);
  }
}

async function getRepairs(req, res, next) {
  try {
    let filter = {};
    if (req.user.role === "REPAIRER") filter = { repairer: req.user._id };
    if (req.user.role === "OWNER" || req.user.role === "BUYER") {
      const products = await Product.find({ owner: req.user._id }).select("_id");
      filter = { product: { $in: products.map((product) => product._id) } };
    }

    const repairs = await Repair.find(filter)
      .populate("product")
      .populate("repairer", "firstName lastName email role isVerified")
      .sort({ date: -1 });

    res.json(repairs);
  } catch (error) {
    next(error);
  }
}

module.exports = { createRepair, getRepair, getRepairs };
