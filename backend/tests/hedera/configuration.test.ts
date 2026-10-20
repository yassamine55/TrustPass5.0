import { describe, expect, it } from "vitest";
import { createHederaConfig } from "../../src/hedera/config/hederaConfig.js";

const validEnvironment = {
  HEDERA_NETWORK: "testnet",
  HEDERA_OPERATOR_ID: "0.0.123",
  HEDERA_OPERATOR_KEY: "operator-key",
};

describe("Hedera configuration", () => {
  it("allows topic and token IDs to be absent during setup", () => {
    const config = createHederaConfig(validEnvironment);

    expect(config.topicId).toBeUndefined();
    expect(config.deviceTokenId).toBeUndefined();
  });

  it("requires operator credentials", () => {
    expect(() => createHederaConfig({ HEDERA_NETWORK: "testnet" }))
      .toThrow("HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY are required");
  });

  it("rejects unsupported networks and invalid timeouts", () => {
    expect(() => createHederaConfig({ ...validEnvironment, HEDERA_NETWORK: "local" }))
      .toThrow("HEDERA_NETWORK must be testnet, previewnet, or mainnet");
    expect(() => createHederaConfig({ ...validEnvironment, HEDERA_MIRROR_NODE_TIMEOUT_MS: "0" }))
      .toThrow("HEDERA_MIRROR_NODE_TIMEOUT_MS must be a positive integer when provided");
  });
});