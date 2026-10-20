import {
  Client,
  PrivateKey,
  AccountId,
  TopicId,
  TokenId,
} from "@hashgraph/sdk";
import { HederaOperationError } from "../hederaErrors.js";
import type { HederaConfig } from "../hederaTypes.js";

export class HederaClient {
  public readonly sdkClient: Client;
  public readonly operatorId: AccountId;
  public readonly operatorKey: PrivateKey;

  public constructor(public readonly config: HederaConfig) {
    this.operatorId = AccountId.fromString(config.operatorId);
    this.operatorKey = PrivateKey.fromString(config.operatorKey);
    this.sdkClient = createSdkClient(config);
    this.sdkClient.setOperator(this.operatorId, this.operatorKey);
    if (config.transactionTimeoutMs !== undefined) {
      this.sdkClient.setRequestTimeout(config.transactionTimeoutMs);
    }
  }

  public close(): void {
    this.sdkClient.close();
  }

  public requireTopicId(): TopicId {
    if (!this.config.topicId) {
      throw new HederaOperationError(
        "HEDERA_TOPIC_ID is not configured; create a topic during initial setup first",
      );
    }
    return TopicId.fromString(this.config.topicId);
  }

  public requireDeviceTokenId(): TokenId {
    if (!this.config.deviceTokenId) {
      throw new HederaOperationError(
        "HEDERA_DEVICE_TOKEN_ID is not configured; create the device token during initial setup first",
      );
    }
    return TokenId.fromString(this.config.deviceTokenId);
  }
}

function createSdkClient(config: HederaConfig): Client {
  switch (config.network) {
    case "testnet":
      return Client.forTestnet();
    case "previewnet":
      return Client.forPreviewnet();
    case "mainnet":
      return Client.forMainnet();
  }
}
