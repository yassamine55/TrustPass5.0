require("./config/env");

const crypto = require("crypto");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const Product = require("./models/Product");
const User = require("./models/User");
const Repair = require("./models/Repair");
const Maintenance = require("./models/Maintenance");
const LifecycleEvent = require("./models/LifecycleEvent");
const { clientUrl, hederaEnabled } = require("./config/env");
const { getHederaModule, closeHederaModule } = require("./services/hederaModule");
const { mintProductDevice, publishAndPersistLifecycleEvent } = require("./services/hederaLifecyclePublisher");
const { generateId } = require("./utils/generateId");

const PASSPORT_ID = "RLP-2026-F39BC90";
const DEMO_EMAIL = "rlp-2026-f39bc90@demo.reloop.local";
const DEMO_PASSWORD = "RLP-2026-F39BC90-demo-only";
const DATES = {
  created: new Date("2026-01-15T10:00:00.000Z"),
  repair: new Date("2026-03-10T14:30:00.000Z"),
  maintenance: new Date("2026-06-12T09:15:00.000Z"),
  resale: new Date("2026-08-20T16:45:00.000Z")
};

function requireHederaConfiguration() {
  if (!hederaEnabled) return false;
  const required = [
    "HEDERA_OPERATOR_ID",
    "HEDERA_OPERATOR_KEY",
    "HEDERA_DEVICE_TOKEN_ID",
    "HEDERA_TOPIC_ID"
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Demo passport seed is missing: ${missing.join(", ")}`);
  return true;
}

function assertDemoProduct(product) {
  const expected = {
    passportId: PASSPORT_ID,
    brand: "Apple",
    model: "MacBook Air M1",
    category: "Laptop",
    description: "Example MacBook Air M1 used to demonstrate the ReLoop digital device passport."
  };
  for (const [field, value] of Object.entries(expected)) {
    if (product[field] !== value) throw new Error(`Existing demo passport has an unexpected ${field}`);
  }
}

async function ensureEvent({ product, actor, type, description, date, sourceRef, requireHedera }) {
  let event = await LifecycleEvent.findOne({ sourceRef });
  if (!event) {
    event = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: product._id,
      type,
      actor: actor._id,
      description,
      sourceRef,
      createdAt: date,
      updatedAt: date
    });
  }
  if (event.product.toString() !== product._id.toString() || event.type !== type) {
    throw new Error(`Lifecycle source reference collision for ${sourceRef}`);
  }
  if (event.hederaStatus !== "CONFIRMED") {
    await publishAndPersistLifecycleEvent({ product, lifecycleEvent: event, actor });
  }
  if (requireHedera && event.hederaStatus !== "CONFIRMED") {
    throw new Error(`${type} was not confirmed on Hedera: ${event.hederaError || "unknown error"}`);
  }
  if (!requireHedera && !["FAILED", "CONFIRMED"].includes(event.hederaStatus)) {
    throw new Error(`${type} has an unexpected blockchain state: ${event.hederaStatus}`);
  }
  return event;
}

async function ensureRepair(product, actor, requireHedera) {
  const sourceRef = `DEMO:${PASSPORT_ID}:REPAIR`;
  let repair = await Repair.findOne({ repairId: sourceRef });
  if (!repair) {
    repair = await Repair.create({
      repairId: sourceRef,
      product: product._id,
      repairer: actor._id,
      date: DATES.repair,
      description: "Example repair: replaced the keyboard assembly and tested the device.",
      changedParts: ["keyboard assembly"]
    });
  }
  const event = await ensureEvent({
    product,
    actor,
    type: "REPAIR",
    description: repair.description,
    date: DATES.repair,
    sourceRef,
    requireHedera
  });
  if (!repair.lifecycleEvent || repair.lifecycleEvent.toString() !== event._id.toString()) {
    repair.lifecycleEvent = event._id;
    repair.hederaStatus = event.hederaStatus;
    repair.hederaTopicId = event.hederaTopicId;
    repair.hederaSequenceNumber = event.hederaSequenceNumber;
    repair.hederaTransactionId = event.hederaTransactionId;
    repair.hederaConsensusTimestamp = event.hederaConsensusTimestamp;
    repair.hederaError = event.hederaError;
    await repair.save();
  }
}

async function ensureMaintenance(product, actor, requireHedera) {
  const sourceRef = `DEMO:${PASSPORT_ID}:MAINTENANCE`;
  let maintenance = await Maintenance.findOne({ maintenanceId: sourceRef });
  if (!maintenance) {
    maintenance = await Maintenance.create({
      maintenanceId: sourceRef,
      product: product._id,
      performedBy: actor._id,
      date: DATES.maintenance,
      description: "Example maintenance: cleaned the cooling system and checked battery health."
    });
  }
  const event = await ensureEvent({
    product,
    actor,
    type: "MAINTENANCE",
    description: maintenance.description,
    date: DATES.maintenance,
    sourceRef,
    requireHedera
  });
  if (!maintenance.lifecycleEvent || maintenance.lifecycleEvent.toString() !== event._id.toString()) {
    maintenance.lifecycleEvent = event._id;
    maintenance.hederaStatus = event.hederaStatus;
    maintenance.hederaTopicId = event.hederaTopicId;
    maintenance.hederaSequenceNumber = event.hederaSequenceNumber;
    maintenance.hederaTransactionId = event.hederaTransactionId;
    maintenance.hederaConsensusTimestamp = event.hederaConsensusTimestamp;
    maintenance.hederaError = event.hederaError;
    await maintenance.save();
  }
}

async function ensureMirrorHistory(hedera) {
  const sourceRefs = [
    `DEMO:${PASSPORT_ID}:PRODUCT_CREATED`,
    `DEMO:${PASSPORT_ID}:REPAIR`,
    `DEMO:${PASSPORT_ID}:MAINTENANCE`,
    `DEMO:${PASSPORT_ID}:RESALE`
  ];
  const expected = await LifecycleEvent.find({ sourceRef: { $in: sourceRefs } });
  const expectedIds = new Set(expected.map((event) => event.eventId));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const mirrorEvents = await hedera.lifecycleEvents.getDeviceLifecycle({ deviceId: PASSPORT_ID, order: "asc", limit: 100 });
    if ([...expectedIds].every((eventId) => mirrorEvents.some((event) => event.eventId === eventId))) return mirrorEvents;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Mirror Node did not return the complete demo lifecycle history");
}

async function persistMirrorReferences(mirrorEvents) {
  const byEventId = new Map(mirrorEvents.map((event) => [event.eventId, event]));
  const events = await LifecycleEvent.find({
    sourceRef: { $in: [
      `DEMO:${PASSPORT_ID}:PRODUCT_CREATED`,
      `DEMO:${PASSPORT_ID}:REPAIR`,
      `DEMO:${PASSPORT_ID}:MAINTENANCE`,
      `DEMO:${PASSPORT_ID}:RESALE`
    ] }
  });

  for (const event of events) {
    const mirror = byEventId.get(event.eventId);
    if (!mirror) throw new Error(`Mirror Node event missing: ${event.eventId}`);
    event.hederaStatus = "CONFIRMED";
    event.hederaTopicId = mirror.topicId;
    event.hederaSequenceNumber = mirror.sequenceNumber;
    event.hederaConsensusTimestamp = mirror.consensusTimestamp;
    event.hederaError = null;
    await event.save();

    if (event.type === "REPAIR") {
      await Repair.updateOne({ lifecycleEvent: event._id }, {
        $set: {
          hederaStatus: "CONFIRMED",
          hederaTopicId: mirror.topicId,
          hederaSequenceNumber: mirror.sequenceNumber,
          hederaConsensusTimestamp: mirror.consensusTimestamp,
          hederaError: null
        }
      });
    }
    if (event.type === "MAINTENANCE") {
      await Maintenance.updateOne({ lifecycleEvent: event._id }, {
        $set: {
          hederaStatus: "CONFIRMED",
          hederaTopicId: mirror.topicId,
          hederaSequenceNumber: mirror.sequenceNumber,
          hederaConsensusTimestamp: mirror.consensusTimestamp,
          hederaError: null
        }
      });
    }
  }
}

async function seedDemoPassport() {
  const requireHedera = requireHederaConfiguration();
  const hedera = requireHedera ? getHederaModule() : null;
  await connectDB();

  let actor = await User.findOne({ email: DEMO_EMAIL });
  if (!actor) {
    actor = await User.create({
      firstName: "Demo",
      lastName: "Account",
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      role: "OWNER",
      isVerified: true,
      isActive: true
    });
  }

  let product = await Product.findOne({ passportId: PASSPORT_ID });
  if (product) {
    assertDemoProduct(product);
  } else {
    product = await Product.create({
      passportId: PASSPORT_ID,
      brand: "Apple",
      model: "MacBook Air M1",
      serialNumberHash: crypto.createHash("sha256").update(`demo:${PASSPORT_ID}`).digest("hex"),
      manufacturer: "Apple",
      category: "Laptop",
      description: "Example MacBook Air M1 used to demonstrate the ReLoop digital device passport.",
      owner: actor._id,
      status: "ACTIVE"
    });
  }

  if (product.owner.toString() !== actor._id.toString()) {
    throw new Error("Existing demo passport is owned by a different account");
  }
  const mint = await mintProductDevice(product);
  if (requireHedera && mint.status !== "CONFIRMED") {
    throw new Error(`Demo NFT was not confirmed: ${mint.error || "unknown error"}`);
  }
  if (!requireHedera && mint.status !== "FAILED" && mint.status !== "CONFIRMED") {
    throw new Error(`Demo NFT has an unexpected state: ${mint.status}`);
  }
  product.hederaStatus = mint.status;
  product.hederaTokenId = mint.tokenId;
  product.hederaSerialNumber = mint.serialNumber;
  product.hederaMintTransactionId = mint.transactionId;
  product.hederaError = mint.error || null;
  product.status = "ACTIVE";
  await product.save();

  await ensureEvent({
    product,
    actor,
    type: "PRODUCT_CREATED",
    description: "Device created",
    date: DATES.created,
    sourceRef: `DEMO:${PASSPORT_ID}:PRODUCT_CREATED`,
    requireHedera
  });
  await ensureRepair(product, actor, requireHedera);
  await ensureMaintenance(product, actor, requireHedera);
  await ensureEvent({
    product,
    actor,
    type: "RESALE",
    description: "Example resale and ownership transfer event.",
    date: DATES.resale,
    sourceRef: `DEMO:${PASSPORT_ID}:RESALE`,
    requireHedera
  });

  if (requireHedera) {
    const mirrorEvents = await ensureMirrorHistory(hedera);
    await persistMirrorReferences(mirrorEvents);
  }
  console.log(`Demo passport ready: ${PASSPORT_ID}`);
  console.log(`Public URL: ${clientUrl.replace(/\/$/, "")}/passport/${PASSPORT_ID}`);
  if (!requireHedera) console.log("Hedera anchoring is unavailable; blockchain references were not created.");
}

seedDemoPassport()
  .catch((error) => {
    console.error(`Demo passport seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    closeHederaModule();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
