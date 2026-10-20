require("./config/env");

const app = require("./app");
const connectDB = require("./config/db");
const { port } = require("./config/env");
const { closeHederaModule } = require("./services/hederaModule");

async function startServer() {
  await connectDB();

  const server = app.listen(port, () => {
    console.log(`ReLoop Passport API running on http://localhost:${port}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      closeHederaModule();
      server.close(() => process.exit(0));
    });
  }
}

startServer().catch((error) => {
  console.error("Server startup failed:", error);
  process.exit(1);
});
