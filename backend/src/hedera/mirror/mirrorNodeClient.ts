import { MirrorNodeError } from "../hederaErrors.js";
import type {
  MirrorNft,
  MirrorAccount,
  MirrorToken,
  MirrorTopicMessage,
  MirrorTopicMessageQuery,
  MirrorTransaction,
} from "./mirrorNodeTypes.js";

interface TopicMessageResponse {
  messages?: Array<{
    topic_id: string;
    sequence_number: number;
    consensus_timestamp: string;
    running_hash?: string;
    running_hash_version?: number;
    message: string;
  }>;
}

interface TokenResponse {
  token_id: string;
  name?: string;
  symbol?: string;
  type?: string;
  supply_type?: string;
  total_supply?: number;
}

interface NftResponse {
  token_id: string;
  serial_number: number;
  account_id?: string;
  metadata?: string;
  created_timestamp?: string;
}

interface TransactionResponse {
  transactions?: Array<{
    transaction_id: string;
    result?: string;
    consensus_timestamp?: string;
    charged_txn_fee?: number;
    entity_id?: string;
  }>;
}

interface AccountResponse {
  account?: string;
  key?: {
    key?: string;
  };
}

export class MirrorNodeClient {
  public constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
    private readonly timeoutMs = 10_000,
  ) {}

  public async getTopicMessages(
    topicId: string,
    query: MirrorTopicMessageQuery = {},
  ): Promise<MirrorTopicMessage[]> {
    const params = new URLSearchParams();
    if (query.sequenceNumber !== undefined) params.set("sequencenumber", String(query.sequenceNumber));
    if (query.limit !== undefined) params.set("limit", String(query.limit));
    if (query.order !== undefined) params.set("order", query.order);
    const response = await this.request<TopicMessageResponse>(
      `/topics/${encodeURIComponent(topicId)}/messages?${params.toString()}`,
    );
    return (response.messages ?? []).map((message) => fromBase64Message(message));
  }

  public async getToken(tokenId: string): Promise<MirrorToken> {
    const response = await this.request<TokenResponse>(`/tokens/${encodeURIComponent(tokenId)}`);
    return {
      tokenId: response.token_id,
      name: response.name,
      symbol: response.symbol,
      type: response.type,
      supplyType: response.supply_type,
      totalSupply: response.total_supply,
    };
  }

  public async getNft(tokenId: string, serialNumber: number): Promise<MirrorNft> {
    const response = await this.request<NftResponse>(
      `/tokens/${encodeURIComponent(tokenId)}/nfts/${serialNumber}`,
    );
    const metadata = response.metadata ? Buffer.from(response.metadata, "base64") : undefined;
    return {
      tokenId: response.token_id,
      serialNumber: response.serial_number,
      accountId: response.account_id,
      metadata,
      metadataText: metadata?.toString("utf8"),
      createdTimestamp: response.created_timestamp,
    };
  }

  public async getTransaction(transactionId: string): Promise<MirrorTransaction> {
    const response = await this.request<TransactionResponse>(
      `/transactions/${encodeURIComponent(toMirrorNodeTransactionId(transactionId))}`,
    );
    const transaction = response.transactions?.[0];
    if (!transaction) throw new MirrorNodeError(`Transaction not found: ${transactionId}`, 404);
    return {
      transactionId: transaction.transaction_id,
      result: transaction.result,
      consensusTimestamp: transaction.consensus_timestamp,
      chargedFee: transaction.charged_txn_fee?.toString(),
      entityId: transaction.entity_id,
    };
  }

  public async getAccountPublicKey(accountId: string): Promise<string> {
    const response = await this.request<AccountResponse>(
      `/accounts/${encodeURIComponent(accountId)}`,
    );
    if (!response.key?.key) {
      throw new MirrorNodeError(`Account has no supported public key: ${accountId}`);
    }
    return response.key.key;
  }

  private async request<T>(path: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}${path}`, {
        headers: this.apiKey ? { "x-api-key": this.apiKey } : undefined,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new MirrorNodeError(
          `Mirror Node request failed: ${response.status} ${response.statusText}`,
          response.status,
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof MirrorNodeError) throw error;
      throw new MirrorNodeError(`Mirror Node request failed: ${path}`, undefined, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function toMirrorNodeTransactionId(transactionId: string): string {
  return transactionId.replace(/^(.+)@(\d+)\.(\d+)$/, "$1-$2-$3");
}

function fromBase64Message(
  message: NonNullable<TopicMessageResponse["messages"]>[number],
): MirrorTopicMessage {
  const bytes = Buffer.from(message.message, "base64");
  return {
    topicId: message.topic_id,
    sequenceNumber: message.sequence_number,
    consensusTimestamp: message.consensus_timestamp,
    runningHash: message.running_hash,
    runningHashVersion: message.running_hash_version,
    message: bytes,
    messageText: bytes.toString("utf8"),
  };
}
