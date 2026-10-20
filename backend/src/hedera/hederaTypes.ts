import type { Status, TransactionId } from "@hashgraph/sdk";

export type HederaNetwork = "testnet" | "previewnet" | "mainnet";

export interface HederaConfig {
  readonly network: HederaNetwork;
  readonly operatorId: string;
  readonly operatorKey: string;
  readonly topicId?: string;
  readonly deviceTokenId?: string;
  readonly mirrorNodeUrl: string;
  readonly mirrorNodeApiKey?: string;
  readonly transactionTimeoutMs?: number;
  readonly mirrorNodeTimeoutMs?: number;
}

export interface HederaTransactionResult {
  readonly transactionId: string;
  readonly status?: string;
  readonly receiptStatus?: Status;
  readonly consensusTimestamp?: string;
}

export interface ConsensusSubmission extends HederaTransactionResult {
  readonly topicId: string;
  readonly sequenceNumber?: number;
}

export interface HederaTransactionInfo {
  readonly transactionId: string;
  readonly result?: string;
  readonly consensusTimestamp?: string;
  readonly chargedFee?: string;
  readonly entityId?: string;
}

export interface ConsensusInformation {
  readonly transactionId: string;
  readonly consensusTimestamp?: string;
  readonly result?: string;
  readonly chargedFee?: string;
  readonly entityId?: string;
  readonly topicId?: string;
  readonly sequenceNumber?: number;
}

export interface TransactionSubmissionContext {
  readonly transactionId: TransactionId;
}
