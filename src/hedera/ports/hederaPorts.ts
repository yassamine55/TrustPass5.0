import type { HederaClient } from "../core/hederaClient.js";
import type { DeviceNftService } from "../hts/deviceNftService.js";
import type { LifecycleEventService } from "../hcs/lifecycleEventService.js";
import type { MirrorNodeClient } from "../mirror/mirrorNodeClient.js";
import type { TransactionInfoService } from "../transactions/transactionInfoService.js";
import type { RepairerSignatureService } from "../identity/repairerSignatureService.js";
import type { HederaVerificationService } from "../verification/hederaVerificationService.js";

export interface HederaModule {
  readonly client: HederaClient;
  readonly deviceNft: DeviceNftService;
  readonly lifecycleEvents: LifecycleEventService;
  readonly mirrorNode: MirrorNodeClient;
  readonly transactions: TransactionInfoService;
  readonly repairerSignatures: RepairerSignatureService;
  readonly verification: HederaVerificationService;
}
