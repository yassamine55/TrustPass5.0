const router = require("express").Router();
const {
  createRecycling,
  getRecycling
} = require("../controllers/recyclingController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/", authorizeBuyer, createRecycling);
router.get("/", getRecycling);

function authorizeBuyer(req, res, next) {
  if (req.user.role !== "BUYER") {
    return res.status(403).json({ message: "Buyer access required" });
  }
  next();
}

module.exports = router;
