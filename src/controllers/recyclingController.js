const Product = require("../models/Product");
const RecyclingEvent = require("../models/RecyclingEvent");
const LifecycleEvent = require("../models/LifecycleEvent");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { assertLifecycleTransition } = require("../services/lifecycleState");

async function createRecycling(req, res, next) {
  try {
    if (req.user.role !== "BUYER" || !req.user.isVerified) {
      return res.status(403).json({
        message: "Only a verified buyer can register recycling"
      });
    }

    const {
      product,
      condition,
      recoveredComponents,
      proof,
      date
    } = req.body;

    const target = await Product.findById(product);
    if (!target) return res.status(404).json({ message: "Product not found" });

    assertLifecycleTransition(target.status, "RECYCLED");

    const event = await RecyclingEvent.create({
      recyclingId: generateId("REC"),
      product,
      center: req.user._id,
      condition,
      recoveredComponents: recoveredComponents || [],
      proof: proof || null,
      date
    });

    target.status = "RECYCLED";
    await target.save();

    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product,
      type: "RECYCLED",
      actor: req.user._id,
      description: "Product recycled",
      sourceRef: event.recyclingId
    });
    const blockchain = await publishAndPersistLifecycleEvent({ product: target, lifecycleEvent, actor: req.user });
    event.lifecycleEvent = lifecycleEvent._id;
    event.hederaStatus = blockchain.status;
    event.hederaTopicId = blockchain.topicId;
    event.hederaSequenceNumber = blockchain.sequenceNumber;
    event.hederaTransactionId = blockchain.transactionId;
    event.hederaConsensusTimestamp = blockchain.consensusTimestamp;
    event.hederaError = blockchain.error;
    await event.save();

    res.status(201).json({
      message: "Recycling operation saved",
      recycling: event
    });
  } catch (error) {
    next(error);
  }
}

async function getRecycling(req, res, next) {
  try {
    const events = await RecyclingEvent.find(
      req.user.role === "BUYER" ? { center: req.user._id } : {}
    )
      .populate("product")
      .populate("center", "firstName lastName email role isVerified")
      .sort({ date: -1 });

    res.json(events);
  } catch (error) {
    next(error);
  }
}

module.exports = { createRecycling, getRecycling };
