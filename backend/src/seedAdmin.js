require("./config/env");
const connectDB = require("./config/db");
const User = require("./models/User");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured");
  }
  if (password.length < 6) {
    throw new Error("ADMIN_PASSWORD must be at least 6 characters long");
  }

  await connectDB();

  const existingAdmin = await User.findOne({ role: "ADMIN" });

  if (existingAdmin) {
    existingAdmin.password = password;
    await existingAdmin.save();
    console.log("Admin password updated from ADMIN_PASSWORD.");
    process.exit(0);
  }

  const admin = await User.create({
    firstName: "System",
    lastName: "Admin",
    email,
    password,
    role: "ADMIN",
    isVerified: true,
    isActive: true
  });

  console.log("Admin created using ADMIN_EMAIL and ADMIN_PASSWORD.");
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
