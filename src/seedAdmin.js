require("./config/env");
const connectDB = require("./config/db");
const User = require("./models/User");

async function seedAdmin() {
  await connectDB();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  const existingAdmin = await User.findOne({ role: "ADMIN" });

  if (existingAdmin) {
    console.log(`Admin already exists: ${existingAdmin.email}`);
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

  console.log(`Admin created: ${admin.email}`);
  console.log("Change ADMIN_PASSWORD in .env before using this in a real environment.");
  process.exit(0);
}

seedAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
