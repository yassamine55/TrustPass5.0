const path = require("path");
const fs = require("fs");

let moduleInstance;
let loadError;

function getHederaModule() {
  const { hederaEnabled } = require("../config/env");
  if (!hederaEnabled) return null;
  if (moduleInstance) return moduleInstance;
  if (loadError) throw loadError;

  try {
    const candidates = [
      path.resolve(__dirname, "../../dist/src/hedera/index.js"),
      path.resolve(__dirname, "../../backend/dist/src/hedera/index.js")
    ];
    const compiledPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!compiledPath) throw new Error("Compiled Hedera integration was not found; run the backend build first");
    const { createHederaModule } = require(compiledPath);
    moduleInstance = createHederaModule();
    return moduleInstance;
  } catch (error) {
    loadError = error;
    throw error;
  }
}

function closeHederaModule() {
  if (!moduleInstance) return;
  moduleInstance.client.close();
  moduleInstance = undefined;
}

module.exports = { getHederaModule, closeHederaModule };