export interface MirrorTopicMessage {
  readonly topicId: string;
  readonly sequenceNumber: number;
  readonly consensusTimestamp: string;
  readonly runningHash?: string;
  readonly runningHashVersion?: number;
  readonly message: Uint8Array;
  readonly messageText: string;
}

export interface MirrorTopicMessageQuery {
  readonly sequenceNumber?: number;
  readonly limit?: number;
  readonly order?: "asc" | "desc";
}

export interface MirrorToken {
  readonly tokenId: string;
  readonly name?: string;
  readonly symbol?: string;
  readonly type?: string;
  readonly supplyType?: string;
  readonly totalSupply?: number;
}

export interface MirrorNft {
  readonly tokenId: string;
  readonly serialNumber: number;
  readonly accountId?: string;
  readonly metadata?: Uint8Array;
  readonly metadataText?: string;
  readonly createdTimestamp?: string;
}

export interface MirrorTransaction {
  readonly transactionId: string;
  readonly result?: string;
  readonly consensusTimestamp?: string;
  readonly chargedFee?: string;
  readonly entityId?: string;
}

export interface MirrorAccount {
  readonly accountId: string;
  readonly publicKey: string;
}
