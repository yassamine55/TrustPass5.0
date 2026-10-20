const Product = require("../models/Product");
const Transfer = require("../models/Transfer");
const User = require("../models/User");
const LifecycleEvent = require("../models/LifecycleEvent");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent } = require("../services/hederaLifecyclePublisher");
const { createProvenance } = require("../domain/provenance");

// Ownership changes are settled in the app's own database (payment happens off-platform,
// e.g. a bank transfer, which is out of scope here). Hedera's role is not to custody or move
// the device NFT between individual accounts -- it anchors the resulting ownership-transfer
// event to the Consensus Service, the same tamper-evident event log every other lifecycle
// event (repair, maintenance, recycling...) already uses. This mirrors how the rest of the
// app treats Hedera: best-effort, informational (see HederaBadge), and never a reason to
// block the underlying action -- publishAndPersistLifecycleEvent never throws, it records
// FAILED/PENDING/CONFIRMED on the event itself.
async function executeOwnershipTransfer({ product, fromOwnerId, toUser, isPartsSale }) {
  const fromOwner = await User.findById(fromOwnerId).select("firstName lastName");

  product.owner = toUser._id;
  if (isPartsSale) product.status = "SOLD_FOR_PARTS";
  else product.listingPrice = null;
  await product.save();

  const currentOwnerName = `${toUser.firstName || ""} ${toUser.lastName || ""}`.trim() || "Unknown owner";
  const previousOwnerName = fromOwner ? `${fromOwner.firstName || ""} ${fromOwner.lastName || ""}`.trim() : "Unknown owner";

  const lifecycleEvent = await LifecycleEvent.create({
    eventId: generateId("EVT"),
    product: product._id,
    type: isPartsSale ? "SOLD_FOR_PARTS" : "TRANSFERRED",
    actor: toUser._id,
    description: `Ownership transferred: ${previousOwnerName} -> ${currentOwnerName}`,
    provenance: createProvenance({ actor: toUser, claimType: "OWNERSHIP_TRANSFER" })
  });
  const reference = await publishAndPersistLifecycleEvent({ product, lifecycleEvent, actor: toUser });

  return { lifecycleEvent, hederaStatus: reference.status, hederaTransactionId: reference.transactionId };
}

async function requestTransfer(req, res, next) {
  try {
    const { product } = req.body;
    let { toOwner } = req.body;

    // Allow the sender to designate the recipient by e-mail (ids are not known to end users).
    if (!toOwner && req.body.toEmail) {
      const recipient = await User.findOne({ email: String(req.body.toEmail).toLowerCase().trim() }).select("_id");
      toOwner = recipient ? recipient._id.toString() : null;
    }
    if (!toOwner) return res.status(400).json({ message: "Destination owner is invalid" });

    const target = await Product.findById(product);
    if (!target) return res.status(404).json({ message: "Product not found" });
    if (target.stolenReport?.status && target.stolenReport.status !== "NONE") {
      return res.status(409).json({ message: "This device has been reported stolen and cannot be transferred" });
    }

    const isPartsSaleRequest =
      req.user.role === "BUYER" &&
      req.user.isVerified &&
      target.status === "LISTED_FOR_PARTS" &&
      toOwner === req.user._id.toString() &&
      target.owner.toString() !== req.user._id.toString();
    const isMarketplacePurchaseRequest =
      req.user.role === "BUYER" &&
      req.user.isVerified &&
      ["ACTIVE", "MAINTENANCE"].includes(target.status) &&
      target.listingPrice != null &&
      toOwner === req.user._id.toString() &&
      target.owner.toString() !== req.user._id.toString();
    const isOwnerTransferRequest =
      req.user.role === "OWNER" &&
      target.owner.toString() === req.user._id.toString();

    if (!isPartsSaleRequest && !isMarketplacePurchaseRequest && !isOwnerTransferRequest) {
      return res.status(403).json({ message: "Transfer authorization denied" });
    }

    const newOwner = await User.findById(toOwner);
    if (!newOwner || !["OWNER", "BUYER"].includes(newOwner.role) || !newOwner.isActive ||
      ((isPartsSaleRequest || isMarketplacePurchaseRequest) && (newOwner.role !== "BUYER" || !newOwner.isVerified))) {
      return res.status(400).json({ message: "Destination owner is invalid" });
    }

    if (!isPartsSaleRequest && !["ACTIVE", "MAINTENANCE", "LISTED_FOR_PARTS"].includes(target.status)) {
      return res.status(409).json({ message: "Product is not available for this transfer" });
    }
    if (target.status === "LISTED_FOR_PARTS" && newOwner.role !== "BUYER") {
      return res.status(409).json({ message: "Only a buyer can purchase a device listed for parts" });
    }

    const existing = await Transfer.findOne({ product, status: "PENDING" });
    if (existing) {
      return res.status(409).json({ message: "A transfer is already pending" });
    }

    // Marketplace purchases (a normal in-service device the owner has already priced) complete
    // immediately in one step: the owner already consented to a sale by listing a price, so
    // there is no separate accept step and no PENDING state. "Sell or transfer" (a specific
    // named recipient) and "buy for parts" both remain two-step request + accept flows below.
    if (isMarketplacePurchaseRequest) {
      // Re-check the freshest copy of the product right before committing, to avoid two buyers
      // both succeeding if they click Buy within the same instant.
      const fresh = await Product.findById(product);
      if (!fresh || fresh.listingPrice == null || !["ACTIVE", "MAINTENANCE"].includes(fresh.status) || fresh.owner.toString() !== target.owner.toString()) {
        return res.status(409).json({ message: "This device has just been sold or is no longer available." });
      }
      const salePrice = fresh.listingPrice;
      const fromOwnerId = fresh.owner;

      const transfer = await Transfer.create({
        transferId: generateId("TRF"),
        product,
        fromOwner: fromOwnerId,
        toOwner,
        status: "ACCEPTED",
        acceptedAt: new Date(),
        viaMarketplace: true,
        price: salePrice
      });

      const { hederaStatus, hederaTransactionId } = await executeOwnershipTransfer({ product: fresh, fromOwnerId, toUser: newOwner, isPartsSale: false });
      transfer.hederaStatus = hederaStatus;
      transfer.hederaTransactionId = hederaTransactionId;
      await transfer.save();

      return res.status(201).json({
        message: "Purchase complete. This device is now yours.",
        transfer,
        product: fresh
      });
    }

    const transfer = await Transfer.create({
      transferId: generateId("TRF"),
      product,
      fromOwner: isPartsSaleRequest ? target.owner : req.user._id,
      toOwner,
      status: "PENDING"
    });

    res.status(201).json({
      message: "Transfer requested",
      transfer
    });
  } catch (error) {
    next(error);
  }
}

async function acceptTransfer(req, res, next) {
  try {
    const transfer = await Transfer.findById(req.params.id);

    if (!transfer) return res.status(404).json({ message: "Transfer not found" });

    if (transfer.toOwner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the destination owner can accept" });
    }

    if (transfer.status !== "PENDING") {
      return res.status(400).json({ message: "Transfer is not pending" });
    }

    const product = await Product.findById(transfer.product);
    if (!product) return res.status(404).json({ message: "Product not found" });
    if (product.stolenReport?.status && product.stolenReport.status !== "NONE") {
      return res.status(409).json({ message: "This device has been reported stolen and cannot be transferred" });
    }

    if (product.owner.toString() !== transfer.fromOwner.toString()) {
      return res.status(409).json({ message: "Transfer no longer matches the current owner" });
    }

    const isPartsSale = req.user.role === "BUYER" && product.status === "LISTED_FOR_PARTS";
    if (!isPartsSale && !["ACTIVE", "MAINTENANCE"].includes(product.status)) {
      return res.status(409).json({ message: "Product is not available for normal purchase" });
    }

    const { hederaStatus, hederaTransactionId } = await executeOwnershipTransfer({ product, fromOwnerId: transfer.fromOwner, toUser: req.user, isPartsSale });

    transfer.status = "ACCEPTED";
    transfer.acceptedAt = new Date();
    transfer.hederaStatus = hederaStatus;
    transfer.hederaTransactionId = hederaTransactionId;
    await transfer.save();

    res.json({
      message: "Transfer accepted",
      transfer,
      product
    });
  } catch (error) {
    next(error);
  }
}

async function getMyTransfers(req, res, next) {
  try {
    const transfers = await Transfer.find({
      $or: [{ fromOwner: req.user._id }, { toOwner: req.user._id }]
    })
      .populate("product")
      .populate("fromOwner", "firstName lastName email")
      .populate("toOwner", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.json(transfers);
  } catch (error) {
    next(error);
  }
}

module.exports = { requestTransfer, acceptTransfer, getMyTransfers };
