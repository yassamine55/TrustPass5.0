import { HederaConfigurationError } from "../hederaErrors.js";
import type { HederaConfig, HederaNetwork } from "../hederaTypes.js";

const DEFAULT_MIRROR_NODE_URL = "https://testnet.mirrornode.hedera.com/api/v1";

function optionalPositiveInteger(name: string, value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new HederaConfigurationError(`${name} must be a positive integer when provided`);
  }
  return parsed;
}

export function createHederaConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HederaConfig {
  const network = (environment.HEDERA_NETWORK ?? "testnet") as HederaNetwork;
  if (!["testnet", "previewnet", "mainnet"].includes(network)) {
    throw new HederaConfigurationError("HEDERA_NETWORK must be testnet, previewnet, or mainnet");
  }

  const operatorId = environment.HEDERA_OPERATOR_ID;
  const operatorKey = environment.HEDERA_OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    throw new HederaConfigurationError(
      "HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY are required",
    );
  }

  return {
    network,
    operatorId,
    operatorKey,
    topicId: environment.HEDERA_TOPIC_ID || undefined,
    deviceTokenId: environment.HEDERA_DEVICE_TOKEN_ID || undefined,
    mirrorNodeUrl: environment.HEDERA_MIRROR_NODE_URL ?? DEFAULT_MIRROR_NODE_URL,
    mirrorNodeApiKey: environment.HEDERA_MIRROR_NODE_API_KEY || undefined,
    transactionTimeoutMs: optionalPositiveInteger(
      "HEDERA_TRANSACTION_TIMEOUT_MS",
      environment.HEDERA_TRANSACTION_TIMEOUT_MS,
    ),
    mirrorNodeTimeoutMs: optionalPositiveInteger(
      "HEDERA_MIRROR_NODE_TIMEOUT_MS",
      environment.HEDERA_MIRROR_NODE_TIMEOUT_MS,
    ),
  };
}
