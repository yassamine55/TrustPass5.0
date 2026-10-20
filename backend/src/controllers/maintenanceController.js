const Maintenance = require("../models/Maintenance");
const Product = require("../models/Product");
const LifecycleEvent = require("../models/LifecycleEvent");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { assertLifecycleTransition } = require("../services/lifecycleState");
const { createProvenance } = require("../domain/provenance");

async function createMaintenance(req, res, next) {
  try {
    const { product, description, document, date } = req.body;

    const target = await Product.findById(product);
    if (!target) return res.status(404).json({ message: "Product not found" });
    if (req.user.role === "OWNER" && target.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "You do not own this product" });
    }
    if (!["OWNER", "REPAIRER", "ADMIN"].includes(req.user.role) ||
      (req.user.role === "REPAIRER" && !req.user.isVerified)) {
      return res.status(403).json({ message: "Maintenance access denied" });
    }
    assertLifecycleTransition(target.status, "MAINTENANCE");

    const maintenance = await Maintenance.create({
      maintenanceId: generateId("MNT"),
      product,
      performedBy: req.user._id,
      description,
      document: document || null,
      date
    });

    target.status = "MAINTENANCE";
    await target.save();

    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product,
      type: "MAINTENANCE",
      actor: req.user._id,
      description,
      sourceRef: maintenance.maintenanceId,
      provenance: createProvenance({ actor: req.user })
    });
    const blockchain = await publishAndPersistLifecycleEvent({ product: target, lifecycleEvent, actor: req.user });
    maintenance.lifecycleEvent = lifecycleEvent._id;
    maintenance.hederaStatus = blockchain.status;
    maintenance.hederaTopicId = blockchain.topicId;
    maintenance.hederaSequenceNumber = blockchain.sequenceNumber;
    maintenance.hederaTransactionId = blockchain.transactionId;
    maintenance.hederaConsensusTimestamp = blockchain.consensusTimestamp;
    maintenance.hederaError = blockchain.error;
    await maintenance.save();

    res.status(201).json({
      message: "Maintenance saved",
      maintenance
    });
  } catch (error) {
    next(error);
  }
}

async function getMaintenances(req, res, next) {
  try {
    const filter = {};
    if (req.user.role === "OWNER" || req.user.role === "BUYER") {
      const products = await Product.find({ owner: req.user._id }).select("_id");
      filter.product = { $in: products.map((p) => p._id) };
    }
    if (req.user.role === "REPAIRER") filter.performedBy = req.user._id;

    const maintenances = await Maintenance.find(filter)
      .populate("product")
      .populate("performedBy", "firstName lastName role isVerified")
      .sort({ date: -1 });

    res.json(maintenances);
  } catch (error) {
    next(error);
  }
}

module.exports = { createMaintenance, getMaintenances };
