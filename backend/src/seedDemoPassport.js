const path = require("path");
process.env.NODE_PATH = path.resolve(__dirname, "..", "node_modules");
require("module").Module._initPaths();
require("../../src/seedDemoPassport");