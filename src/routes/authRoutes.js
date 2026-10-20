const router = require("express").Router();
const { register, login, me, updatePassword } = require("../controllers/authController");
const { protect } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, me);
router.patch("/me/password", protect, updatePassword);

module.exports = router;
