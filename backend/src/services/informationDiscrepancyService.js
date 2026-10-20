const LifecycleEvent = require("../models/LifecycleEvent");
const User = require("../models/User");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("./hederaLifecyclePublisher");
const { createProvenance } = require("../domain/provenance");

async function createInformationDiscrepancy({ product, actor, description, relatedEvent, sourceRef }) {
  if (!product?._id || !description || !sourceRef) return null;

  const systemActor = actor || await User.findOne({ role: "ADMIN", firstName: "System" }) || await User.findOne({ role: "ADMIN" });
  if (!systemActor?._id) return null;

  const existing = await LifecycleEvent.findOne({ sourceRef }).select("_id");
  if (existing) return existing;

  const event = await LifecycleEvent.create({
    eventId: generateId("EVT"),
    product: product._id,
    type: "EVENT_DISPUTED",
    actor: systemActor._id,
    description: `INFORMATION DISCREPANCY\n${description}\nStatus: ${description.includes("OCR") || description.includes("manual review") ? "MANUAL REVIEW REQUIRED" : "CONFIRMED CONTRADICTION"}`,
    relatedEvent: relatedEvent || null,
    sourceRef,
    provenance: createProvenance({
      actor: systemActor,
      claimType: "INFORMATION_DISCREPANCY",
      verificationStatus: "OWNER_DECLARED"
    })
  });
  await publishAndPersistLifecycleEvent({ product, lifecycleEvent: event, actor: systemActor });
  return event;
}

module.exports = { createInformationDiscrepancy };
