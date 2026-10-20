import {
  AccountId,
  PrivateKey,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenId,
  TokenMintTransaction,
  TokenType,
  TransferTransaction,
} from "@hashgraph/sdk";
import { HederaOperationError } from "../hederaErrors.js";
import { HederaClient } from "../core/hederaClient.js";
import type { MirrorNodeClient } from "../mirror/mirrorNodeClient.js";
import { CanonicalSerializer } from "../serialization/canonicalSerializer.js";
import { validateDeviceNftMetadata } from "./deviceNftValidation.js";
import type { HederaTransactionResult } from "../hederaTypes.js";
import type {
  AssociateDeviceInput,
  CreateDeviceTokenInput,
  CreateDeviceTokenResult,
  MintDeviceInput,
  MintDeviceResult,
  TransferDeviceInput,
  GetDeviceNftInput,
  DeviceNftState,
} from "./deviceNftTypes.js";

export class DeviceNftService {
  public constructor(
    private readonly hedera: HederaClient,
    private readonly mirrorNode: MirrorNodeClient,
    private readonly serializer = new CanonicalSerializer(),
  ) {}

  public async createDeviceToken(
    input: CreateDeviceTokenInput = {},
  ): Promise<CreateDeviceTokenResult> {
    const transaction = await new TokenCreateTransaction()
      .setTokenName(input.name ?? "ReLoop Device")
      .setTokenSymbol(input.symbol ?? "RLPD")
      .setTokenType(TokenType.NonFungibleUnique)
      .setTreasuryAccountId(this.hedera.operatorId)
      .setAdminKey(this.hedera.operatorKey)
      .setSupplyKey(this.hedera.operatorKey)
      .setTokenMemo(input.memo ?? "ReLoop device identity NFT")
      .setInitialSupply(0)
      .freezeWith(this.hedera.sdkClient);

    const response = await transaction.sign(this.hedera.operatorKey).then((signed) =>
      signed.execute(this.hedera.sdkClient),
    );
    const receipt = await response.getReceipt(this.hedera.sdkClient);
    if (!receipt.tokenId) {
      throw new HederaOperationError("HTS device token creation returned no token ID");
    }

    return {
      tokenId: receipt.tokenId,
      transactionId: response.transactionId.toString(),
      receiptStatus: receipt.status,
    };
  }

  public async mintDevice(input: MintDeviceInput): Promise<MintDeviceResult> {
    const tokenId = input.tokenId ? TokenId.fromString(input.tokenId) : this.hedera.requireDeviceTokenId();
    validateDeviceNftMetadata(input.metadata);
    const metadata = this.serializer.serialize(input.metadata);
    if (metadata.byteLength > 100) {
      throw new HederaOperationError("NFT metadata must be 100 bytes or fewer");
    }
    const response = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata([Buffer.from(metadata)])
      .execute(this.hedera.sdkClient);
    const receipt = await response.getReceipt(this.hedera.sdkClient);
    const serialNumber = receipt.serials[0]?.toNumber();
    if (serialNumber === undefined) {
      throw new HederaOperationError("HTS device mint returned no serial number");
    }

    return {
      tokenId,
      serialNumber,
      transactionId: response.transactionId.toString(),
      receiptStatus: receipt.status,
    };
  }

  public async transferDevice(input: TransferDeviceInput): Promise<HederaTransactionResult> {
    const tokenId = input.tokenId ? TokenId.fromString(input.tokenId) : this.hedera.requireDeviceTokenId();
    const response = await new TransferTransaction()
      .addNftTransfer(
        tokenId,
        input.serialNumber,
        toAccountId(input.from),
        toAccountId(input.to),
      )
      .execute(this.hedera.sdkClient);
    const receipt = await response.getReceipt(this.hedera.sdkClient);

    return {
      transactionId: response.transactionId.toString(),
      receiptStatus: receipt.status,
    };
  }

  public async associateDevice(input: AssociateDeviceInput): Promise<HederaTransactionResult> {
    const tokenId = input.tokenId ? TokenId.fromString(input.tokenId) : this.hedera.requireDeviceTokenId();
    const accountId = toAccountId(input.accountId);
    const accountKey = PrivateKey.fromString(input.accountKey);
    const transaction = await new TokenAssociateTransaction()
      .setAccountId(accountId)
      .setTokenIds([tokenId])
      .freezeWith(this.hedera.sdkClient);
    const signed = await transaction.sign(accountKey);
    const response = await signed.execute(this.hedera.sdkClient);
    const receipt = await response.getReceipt(this.hedera.sdkClient);

    return {
      transactionId: response.transactionId.toString(),
      receiptStatus: receipt.status,
    };
  }

  public async getDeviceNft(input: GetDeviceNftInput): Promise<DeviceNftState> {
    const tokenId = input.tokenId ?? this.hedera.requireDeviceTokenId().toString();
    return this.mirrorNode.getNft(tokenId, input.serialNumber);
  }
}

function toAccountId(value: string | AccountId): AccountId {
  return typeof value === "string" ? AccountId.fromString(value) : value;
}
