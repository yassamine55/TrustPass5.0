function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack || err);

  if (err.code === 11000) {
    return res.status(409).json({
      message: "Duplicate value",
      fields: err.keyValue
    });
  }

  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: "Validation error",
      errors: Object.values(err.errors).map((e) => e.message)
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID" });
  }

  if (["HederaConfigurationError", "HederaOperationError", "MirrorNodeError"].includes(err.name)) {
    return res.status(err.statusCode || 502).json({ message: "Hedera operation failed" });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode >= 500 ? "Internal server error" : (err.message || "Request failed")
  });
}

module.exports = { notFound, errorHandler };
