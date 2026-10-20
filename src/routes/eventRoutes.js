const router = require("express").Router();
const { createEvent, getEvents } = require("../controllers/eventController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/products/:productId/events", createEvent);
router.get("/products/:productId/events", getEvents);

module.exports = router;
