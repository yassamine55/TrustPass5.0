const path = require("path");

let moduleInstance;
let loadError;

function getHederaModule() {
  const { hederaEnabled } = require("../config/env");
  if (!hederaEnabled) return null;
  if (moduleInstance) return moduleInstance;
  if (loadError) throw loadError;

  try {
    const compiledPath = path.resolve(__dirname, "../../dist/src/hedera/index.js");
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