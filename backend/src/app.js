const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { clientUrl } = require("./config/env");

const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const productRoutes = require("./routes/productRoutes");
const repairRoutes = require("./routes/repairRoutes");
const maintenanceRoutes = require("./routes/maintenanceRoutes");
const transferRoutes = require("./routes/transferRoutes");
const recyclingRoutes = require("./routes/recyclingRoutes");
const eventRoutes = require("./routes/eventRoutes");
const documentRoutes = require("./routes/documentRoutes");
const publicRoutes = require("./routes/publicRoutes");
const verificationRoutes = require("./routes/verificationRoutes");
const verificationRequestRoutes = require("./routes/verificationRequestRoutes");
const technicalInspectionRoutes = require("./routes/technicalInspectionRoutes");
const repairVerificationRoutes = require("./routes/repairVerificationRoutes");

const { notFound, errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(helmet());

app.use(cors({
  origin: clientUrl,
  credentials: true
}));

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false
}));

app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "ReLoop Passport API is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/passports", productRoutes);
app.use("/api/repairs", repairRoutes);
app.use("/api/maintenance", maintenanceRoutes);
app.use("/api/transfers", transferRoutes);
app.use("/api/recycling", recyclingRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/verify", verificationRoutes);
app.use("/api/verification-requests", verificationRequestRoutes);
app.use("/api/technical-inspections", technicalInspectionRoutes);
app.use("/api/repair-verification-requests", repairVerificationRoutes);
app.use("/api", eventRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
