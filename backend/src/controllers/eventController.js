const LifecycleEvent = require("../models/LifecycleEvent");
const Product = require("../models/Product");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { assertLifecycleTransition, assertLifecycleAuthorization } = require("../services/lifecycleState");
const { createProvenance, EVIDENCE_INTEGRITY_STATUSES } = require("../domain/provenance");
const { createLifecycleAmendment } = require("../services/lifecycleAmendmentService");
const { AMENDMENT_EVENT_TYPES } = require("../domain/lifecycleAmendment");

async function createEvent(req, res, next) {
  try {
    const { type, description, document, hash } = req.body;

    if (!type) return res.status(400).json({ message: "Lifecycle event type is required" });

    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (req.user.role === "OWNER" && product.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (["PURCHASED", "TRANSFERRED", "RESALE", "SOLD_FOR_PARTS", "REPAIR", "MAINTENANCE"].includes(type)) {
      return res.status(409).json({ message: `${type} must use its dedicated workflow` });
    }
    if (Object.values(AMENDMENT_EVENT_TYPES).includes(type)) {
      return res.status(409).json({ message: `${type} must use its dedicated amendment workflow` });
    }
    assertLifecycleAuthorization({ eventType: type, user: req.user, product });

    const nextStatus = assertLifecycleTransition(product.status, type);

    const event = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: product._id,
      type,
      actor: req.user._id,
      description,
      document: document || null,
      hash: hash || null,
      sourceRef: req.headers["idempotency-key"] || undefined,
      provenance: createProvenance({
        actor: req.user,
        documentId: document || null,
        integrityStatus: document ? EVIDENCE_INTEGRITY_STATUSES.UNVERIFIED : EVIDENCE_INTEGRITY_STATUSES.UNKNOWN
      })
    });

    if (nextStatus) {
      product.status = nextStatus;
      if (type === "LISTED_FOR_PARTS" && req.body.price !== undefined) {
        const price = Number(req.body.price);
        if (!Number.isFinite(price) || price < 0) return res.status(400).json({ message: "Listing price must be a non-negative number" });
        product.listingPrice = price;
      }
      await product.save();
    }

    await publishAndPersistLifecycleEvent({ product, lifecycleEvent: event, actor: req.user });
    res.status(201).json({
      message: "Lifecycle event saved",
      event
    });
  } catch (error) {
    next(error);
  }
}

function amendmentHandler(type) {
  return async (req, res, next) => {
    try {
      const result = await createLifecycleAmendment({
        productId: req.params.productId,
        eventId: req.params.eventId,
        type,
        user: req.user,
        description: req.body.description,
        document: req.body.document,
        hash: req.body.hash,
        sourceRef: req.headers["idempotency-key"] || undefined
      });
      res.status(201).json({ message: `${type} lifecycle event created`, event: result.event, originalEvent: result.original });
    } catch (error) {
      next(error);
    }
  };
}

async function getEvents(req, res, next) {
  try {
    const product = await Product.findById(req.params.productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const events = await LifecycleEvent.find({ product: product._id })
      .populate("actor", "firstName lastName role isVerified")
      .sort({ createdAt: 1 });

    res.json(events);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createEvent,
  getEvents,
  disputeEvent: amendmentHandler(AMENDMENT_EVENT_TYPES.DISPUTED),
  correctEvent: amendmentHandler(AMENDMENT_EVENT_TYPES.CORRECTED),
  revokeEvent: amendmentHandler(AMENDMENT_EVENT_TYPES.REVOKED)
};
