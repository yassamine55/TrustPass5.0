const jwt = require("jsonwebtoken");
const { jwtSecret, jwtExpiresIn, jwtIssuer } = require("../config/env");

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn, issuer: jwtIssuer }
  );
}

module.exports = signToken;
