import { TransactionId, TransactionReceiptQuery } from "@hashgraph/sdk";
import { HederaClient } from "../core/hederaClient.js";
import type {
  ConsensusInformation,
  HederaTransactionInfo,
} from "../hederaTypes.js";
import type { MirrorNodeClient } from "../mirror/mirrorNodeClient.js";

export class TransactionInfoService {
  public constructor(
    private readonly hedera: HederaClient,
    private readonly mirrorNode: MirrorNodeClient,
  ) {}

  public async getTransactionStatus(transactionId: string): Promise<HederaTransactionInfo> {
    const transaction = await this.mirrorNode.getTransaction(transactionId);
    return transaction;
  }

  public async getConsensusInformation(
    transactionId: string,
    hcsReference?: { readonly topicId: string; readonly sequenceNumber: number },
  ): Promise<ConsensusInformation> {
    const transaction = await this.mirrorNode.getTransaction(transactionId);
    return {
      transactionId: transaction.transactionId,
      consensusTimestamp: transaction.consensusTimestamp,
      result: transaction.result,
      chargedFee: transaction.chargedFee,
      entityId: transaction.entityId,
      topicId: hcsReference?.topicId,
      sequenceNumber: hcsReference?.sequenceNumber,
    };
  }

  public async getReceiptStatus(transactionId: string): Promise<string> {
    const receipt = await new TransactionReceiptQuery()
      .setTransactionId(TransactionId.fromString(transactionId))
      .execute(this.hedera.sdkClient);
    return receipt.status.toString();
  }
}
