const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { jwtSecret, jwtIssuer } = require("../config/env");

async function protect(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, jwtSecret, { issuer: jwtIssuer });

    const user = await User.findById(decoded.id).populate("company");
    if (!user || !user.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    next();
  };
}

module.exports = { protect, authorize };
