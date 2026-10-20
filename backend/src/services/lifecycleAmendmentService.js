const LifecycleEvent = require("../models/LifecycleEvent");
const Product = require("../models/Product");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("./hederaLifecyclePublisher");
const { createProvenance, EVIDENCE_INTEGRITY_STATUSES } = require("../domain/provenance");
const { assertLifecycleAmendment } = require("../domain/lifecycleAmendment");

async function createLifecycleAmendment({ productId, eventId, type, user, description, document, hash, sourceRef }) {
  const [product, original] = await Promise.all([
    Product.findById(productId),
    LifecycleEvent.findById(eventId)
  ]);
  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }
  if (!original || original.product.toString() !== product._id.toString()) {
    const error = new Error("Original lifecycle event not found");
    error.statusCode = 404;
    throw error;
  }
  assertLifecycleAmendment({ user, product, original });
  if (typeof description !== "string" || description.trim().length < 3) {
    const error = new Error("A correction or dispute description is required");
    error.statusCode = 400;
    throw error;
  }

  const event = await LifecycleEvent.create({
    eventId: generateId("EVT"),
    product: product._id,
    type,
    actor: user._id,
    description: description.trim(),
    document: document || null,
    hash: hash || null,
    relatedEvent: original._id,
    sourceRef: sourceRef || `AMENDMENT:${original.eventId}:${type}`,
    provenance: createProvenance({
      actor: user,
      documentId: document || null,
      integrityStatus: document ? EVIDENCE_INTEGRITY_STATUSES.UNVERIFIED : EVIDENCE_INTEGRITY_STATUSES.UNKNOWN
    })
  });
  await publishAndPersistLifecycleEvent({ product, lifecycleEvent: event, actor: user });
  return { event, original };
}

module.exports = { createLifecycleAmendment };
