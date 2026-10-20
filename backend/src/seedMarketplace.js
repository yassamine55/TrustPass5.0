require("./config/env");

const crypto = require("crypto");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const User = require("./models/User");
const Product = require("./models/Product");
const LifecycleEvent = require("./models/LifecycleEvent");
const { createProvenance } = require("./domain/provenance");
const { generateId } = require("./utils/generateId");

const SELLER_EMAIL = "marketplace-demo-owner@trustpass.local";
const REPAIRER_EMAIL = "marketplace-demo-repairer@trustpass.local";
const catalog = [
  { id: "RLP-DEMO-IP13", brand: "Apple", model: "iPhone 13", category: "Smartphone", price: 1090, condition: "Very good · 128 GB · Battery health 93%", description: "Clean condition, synthetic TrustPass marketplace example.", status: "ACTIVE" },
  { id: "RLP-DEMO-S22", brand: "Samsung", model: "Galaxy S22", category: "Smartphone", price: 820, condition: "Good · 8 GB RAM · Battery condition recorded", description: "128 GB, normal signs of use, synthetic TrustPass marketplace example.", status: "ACTIVE" },
  { id: "RLP-DEMO-MBA1", brand: "Apple", model: "MacBook Air M1 (2020)", category: "Laptop", price: 1650, condition: "Very good · 8 GB RAM · 256 GB SSD", description: "Battery and history available, synthetic TrustPass marketplace example.", status: "ACTIVE" },
  { id: "RLP-DEMO-D5420", brand: "Dell", model: "Latitude 5420", category: "Laptop", price: 980, condition: "Good · Core i5 · 16 GB RAM · 512 GB SSD", description: "Business laptop with documented device history, synthetic TrustPass marketplace example.", status: "ACTIVE" },
  { id: "RLP-DEMO-IPXR", brand: "Apple", model: "iPhone XR", category: "Smartphone", price: 300, condition: "Camera fault · Battery health 79%", description: "Camera fault recorded by the repairer; sold only for parts.", status: "LISTED_FOR_PARTS", reason: "Critical motherboard/component failure" },
  { id: "RLP-DEMO-A54", brand: "Samsung", model: "Galaxy A54", category: "Smartphone", price: 260, condition: "Power failure · Screen condition recorded", description: "Motherboard/power failure recorded by the repairer; sold only for parts.", status: "LISTED_FOR_PARTS", reason: "Critical motherboard/component failure" },
  { id: "RLP-DEMO-HP840", brand: "HP", model: "EliteBook 840 G7", category: "Laptop", price: 420, condition: "Motherboard failure · RAM and SSD condition recorded", description: "Motherboard failure recorded by the repairer; sold only for parts.", status: "LISTED_FOR_PARTS", reason: "Repair cost not economically reasonable" }
];

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function ensureUser(email, firstName, lastName, role) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({
      firstName,
      lastName,
      email,
      password: `Demo-${role}-2026-only`,
      role,
      isVerified: true,
      isActive: true
    });
  }
  return user;
}

async function ensureEvent({ product, actor, type, description, sourceRef, relatedEvent = null }) {
  let event = await LifecycleEvent.findOne({ sourceRef });
  if (!event) {
    event = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: product._id,
      type,
      actor: actor._id,
      description,
      relatedEvent,
      sourceRef,
      provenance: createProvenance({ actor, claimType: type })
    });
  }
  return event;
}

async function seedMarketplace() {
  await connectDB();
  const owner = await ensureUser(SELLER_EMAIL, "Marketplace", "Owner", "OWNER");
  const repairer = await ensureUser(REPAIRER_EMAIL, "TechFix", "Repairer", "REPAIRER");

  for (const item of catalog) {
    let product = await Product.findOne({ passportId: item.id });
    if (!product) {
      product = await Product.create({
        passportId: item.id,
        brand: item.brand,
        model: item.model,
        manufacturer: item.brand,
        category: item.category,
        serialNumberHash: hash(`demo-marketplace:${item.id}`),
        description: item.description,
        currentCondition: item.condition,
        listingPrice: item.price,
        owner: owner._id,
        status: item.status,
      });
    }

    const created = await ensureEvent({
      product,
      actor: owner,
      type: "PRODUCT_CREATED",
      description: "Synthetic TrustPass marketplace listing created",
      sourceRef: `DEMO:MARKETPLACE:${item.id}:PRODUCT_CREATED`
    });

    if (item.status === "LISTED_FOR_PARTS") {
      const request = await ensureEvent({
        product,
        actor: owner,
        type: "INSPECTION_REQUESTED",
        description: "Owner requested a repairability assessment",
        sourceRef: `DEMO:MARKETPLACE:${item.id}:INSPECTION_REQUESTED`
      });
      const endOfLife = await ensureEvent({
        product,
        actor: repairer,
        type: "END_OF_LIFE",
        description: item.reason,
        sourceRef: `DEMO:MARKETPLACE:${item.id}:END_OF_LIFE`,
        relatedEvent: request._id
      });
      await ensureEvent({
        product,
        actor: owner,
        type: "LISTED_FOR_PARTS",
        description: "Owner listed the device for parts only",
        sourceRef: `DEMO:MARKETPLACE:${item.id}:LISTED_FOR_PARTS`,
        relatedEvent: endOfLife._id
      });
      product.technicalInspection = {
        ...(product.technicalInspection?.toObject?.() || product.technicalInspection || {}),
        status: "TECHNICALLY_VERIFIED",
        reviewStatus: "APPROVED",
        requestedBy: owner._id,
        assignedRepairer: repairer._id,
        performedBy: repairer._id,
        diagnosis: {
          decision: "NOT_REPAIRABLE",
          reason: item.reason,
          repairer: repairer._id,
          diagnosedAt: new Date(),
          requestEvent: request._id,
          lifecycleEvent: endOfLife._id,
          signatureValid: true
        }
      };
      product.status = "LISTED_FOR_PARTS";
    }
    product.listingPrice = item.price;
    product.currentCondition = item.condition;
    await product.save();
    void created;
  }

  console.log(`Marketplace demo catalog ready: ${catalog.length} listings`);
}

seedMarketplace()
  .catch((error) => {
    console.error(`Marketplace seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  });
