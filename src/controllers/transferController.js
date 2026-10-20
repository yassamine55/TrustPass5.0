const Product = require("../models/Product");
const Transfer = require("../models/Transfer");
const User = require("../models/User");
const LifecycleEvent = require("../models/LifecycleEvent");
const { generateId } = require("../utils/generateId");
const { publishAndPersistLifecycleEvent, transferProductDevice } = require("../services/hederaLifecyclePublisher");
const { hederaEnabled } = require("../config/env");

async function requestTransfer(req, res, next) {
  try {
    const { product, toOwner } = req.body;

    const target = await Product.findById(product);
    if (!target) return res.status(404).json({ message: "Product not found" });

    const isPartsSaleRequest =
      req.user.role === "BUYER" &&
      req.user.isVerified &&
      target.status === "LISTED_FOR_PARTS" &&
      toOwner === req.user._id.toString() &&
      target.owner.toString() !== req.user._id.toString();
    const isOwnerTransferRequest =
      req.user.role === "OWNER" &&
      target.owner.toString() === req.user._id.toString();

    if (!isPartsSaleRequest && !isOwnerTransferRequest) {
      return res.status(403).json({ message: "Transfer authorization denied" });
    }

    const newOwner = await require("../models/User").findById(toOwner);
    if (!newOwner || !["OWNER", "BUYER"].includes(newOwner.role) || !newOwner.isActive ||
      (isPartsSaleRequest && (newOwner.role !== "BUYER" || !newOwner.isVerified))) {
      return res.status(400).json({ message: "Destination owner is invalid" });
    }

    if (!isPartsSaleRequest && !["ACTIVE", "MAINTENANCE", "LISTED_FOR_PARTS"].includes(target.status)) {
      return res.status(409).json({ message: "Product is not available for this transfer" });
    }
    if (target.status === "LISTED_FOR_PARTS" && newOwner.role !== "BUYER") {
      return res.status(409).json({ message: "Only a buyer can purchase a device listed for parts" });
    }

    const existing = await Transfer.findOne({
      product,
      status: "PENDING"
    });

    if (existing) {
      return res.status(409).json({ message: "A transfer is already pending" });
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

    const isPartsSale = req.user.role === "BUYER" && product.status === "LISTED_FOR_PARTS";
    if (!isPartsSale && !["ACTIVE", "MAINTENANCE"].includes(product.status)) {
      return res.status(409).json({ message: "Product is not available for normal purchase" });
    }

    const fromOwner = await User.findById(transfer.fromOwner).select("hederaAccountId");
    const nftTransfer = await transferProductDevice({
      product,
      fromAccountId: fromOwner?.hederaAccountId,
      toAccountId: req.user.hederaAccountId
    });
    transfer.hederaStatus = nftTransfer.status;
    transfer.hederaTransactionId = nftTransfer.transactionId;
    transfer.hederaError = nftTransfer.error;
    if (hederaEnabled && nftTransfer.status !== "CONFIRMED") {
      await transfer.save();
      return res.status(502).json({ message: "Hedera ownership transfer failed", transfer });
    }

    product.owner = req.user._id;
    if (isPartsSale) product.status = "SOLD_FOR_PARTS";
    await product.save();

    transfer.status = "ACCEPTED";
    transfer.acceptedAt = new Date();
    await transfer.save();

    const lifecycleEvent = await LifecycleEvent.create({
      eventId: generateId("EVT"),
      product: product._id,
      type: isPartsSale ? "SOLD_FOR_PARTS" : req.user.role === "BUYER" ? "PURCHASED" : "RESALE",
      actor: req.user._id,
      description: `Ownership transferred from ${transfer.fromOwner} to ${transfer.toOwner}`,
      sourceRef: transfer.transferId
    });
    await publishAndPersistLifecycleEvent({ product, lifecycleEvent, actor: req.user });

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
