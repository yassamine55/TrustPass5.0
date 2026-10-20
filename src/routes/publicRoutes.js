const router = require("express").Router();
const Product = require("../models/Product");
const LifecycleEvent = require("../models/LifecycleEvent");
const Repair = require("../models/Repair");
const { blockchainSummary } = require("../services/blockchainView");
const { normalizeDevicePhotoRef, resolvePublicDevicePhotoPath, getDevicePhotoMimeType } = require("../utils/devicePhoto");

router.get("/passport/:passportId", async (req, res, next) => {
  try {
    const product = await Product.findOne({ passportId: req.params.passportId })
      .populate("owner", "firstName lastName role isVerified");

    if (!product) return res.status(404).json({ message: "Passport not found" });

    const [events, repairs] = await Promise.all([
      LifecycleEvent.find({ product: product._id })
        .populate("actor", "firstName lastName role isVerified")
        .sort({ createdAt: 1 }),
      Repair.find({ product: product._id })
        .populate("repairer", "firstName lastName role isVerified company")
        .sort({ date: -1 })
    ]);

    res.json({
      passport: product,
      blockchain: blockchainSummary(product),
      events,
      repairs
    });
  } catch (error) {
    next(error);
  }
});

router.get("/devices/:productId/photo", async (req, res, next) => {
  try {
    const product = await Product.findOne({
      $or: [
        { _id: req.params.productId },
        { passportId: req.params.productId }
      ]
    });

    if (!product || !product.photo) {
      return res.status(404).json({ message: "Device photo not found" });
    }

    const photoRef = normalizeDevicePhotoRef(product.photo);
    if (!photoRef) {
      return res.status(404).json({ message: "Device photo not found" });
    }

    let filePath;
    try {
      filePath = resolvePublicDevicePhotoPath(photoRef);
    } catch (error) {
      return res.status(404).json({ message: "Device photo not found" });
    }

    return res.sendFile(filePath, {
      headers: {
        "Content-Type": getDevicePhotoMimeType(filePath),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
