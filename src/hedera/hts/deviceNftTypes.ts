import type { AccountId, TokenId } from "@hashgraph/sdk";
import type { HederaTransactionResult } from "../hederaTypes.js";
import type { MirrorNft } from "../mirror/mirrorNodeTypes.js";

export interface CreateDeviceTokenInput {
  readonly name?: string;
  readonly symbol?: string;
  readonly memo?: string;
}

export interface CreateDeviceTokenResult extends HederaTransactionResult {
  readonly tokenId: TokenId;
}

export interface MintDeviceInput {
  readonly tokenId?: string;
  readonly metadata: DeviceNftMetadata;
}

export interface DeviceNftMetadata {
  readonly deviceId: string;
  readonly passportId?: string;
  readonly publicReference?: string;
  readonly evidenceHash?: string;
}

export interface MintDeviceResult extends HederaTransactionResult {
  readonly tokenId: TokenId;
  readonly serialNumber: number;
}

export interface TransferDeviceInput {
  readonly tokenId?: string;
  readonly serialNumber: number;
  readonly from: string | AccountId;
  readonly to: string | AccountId;
}

export interface AssociateDeviceInput {
  readonly tokenId?: string;
  readonly accountId: string | AccountId;
  readonly accountKey: string;
}

export interface GetDeviceNftInput {
  readonly tokenId?: string;
  readonly serialNumber: number;
}

export type DeviceNftState = MirrorNft;
