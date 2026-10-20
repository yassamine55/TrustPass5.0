const router = require("express").Router();
const { createEvent, getEvents, disputeEvent, correctEvent, revokeEvent } = require("../controllers/eventController");
const { protect } = require("../middleware/auth");

router.use(protect);

router.post("/products/:productId/events", createEvent);
router.get("/products/:productId/events", getEvents);
router.post("/products/:productId/events/:eventId/dispute", disputeEvent);
router.post("/products/:productId/events/:eventId/correct", correctEvent);
router.post("/products/:productId/events/:eventId/revoke", revokeEvent);

module.exports = router;
