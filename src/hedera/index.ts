import { createHederaConfig } from "./config/hederaConfig.js";
import { HederaClient } from "./core/hederaClient.js";
import { DeviceNftService } from "./hts/deviceNftService.js";
import { LifecycleEventService } from "./hcs/lifecycleEventService.js";
import { MirrorNodeClient } from "./mirror/mirrorNodeClient.js";
import { TransactionInfoService } from "./transactions/transactionInfoService.js";
import { RepairerSignatureService } from "./identity/repairerSignatureService.js";
import { HederaVerificationService } from "./verification/hederaVerificationService.js";
import type { HederaConfig } from "./hederaTypes.js";
import type { HederaModule } from "./ports/hederaPorts.js";

export function createHederaModule(config: HederaConfig = createHederaConfig()): HederaModule {
  const client = new HederaClient(config);
  const mirrorNode = new MirrorNodeClient(
    config.mirrorNodeUrl,
    config.mirrorNodeApiKey,
    config.mirrorNodeTimeoutMs,
  );
  return {
    client,
    deviceNft: new DeviceNftService(client, mirrorNode),
    lifecycleEvents: new LifecycleEventService(client, mirrorNode),
    mirrorNode,
    transactions: new TransactionInfoService(client, mirrorNode),
    repairerSignatures: new RepairerSignatureService(mirrorNode),
    verification: new HederaVerificationService(mirrorNode),
  };
}

export { createHederaConfig } from "./config/hederaConfig.js";
export { HederaClient } from "./core/hederaClient.js";
export { DeviceNftService } from "./hts/deviceNftService.js";
export { validateDeviceNftMetadata } from "./hts/deviceNftValidation.js";
export { LifecycleEventService } from "./hcs/lifecycleEventService.js";
export { MirrorNodeClient } from "./mirror/mirrorNodeClient.js";
export { TransactionInfoService } from "./transactions/transactionInfoService.js";
export { RepairerSignatureService } from "./identity/repairerSignatureService.js";
export { HederaVerificationService } from "./verification/hederaVerificationService.js";
export { EvidenceHasher } from "./evidence/evidenceHasher.js";
export { CanonicalSerializer } from "./serialization/canonicalSerializer.js";
export {
  DEVICE_LIFECYCLE_EVENT_TYPES,
  isDeviceLifecycleEventType,
} from "./hcs/lifecycleEventType.js";
export {
  decodeLifecycleMessage,
  validateLifecycleEvent,
} from "./hcs/lifecycleEventValidation.js";
export * from "./hederaErrors.js";
export type * from "./hederaTypes.js";
export type * from "./hts/deviceNftTypes.js";
export type * from "./hcs/lifecycleEventTypes.js";
export type * from "./hcs/lifecycleEventType.js";
export type * from "./mirror/mirrorNodeTypes.js";
export type * from "./identity/repairerSignatureService.js";
export type * from "./verification/hederaVerificationService.js";
export type * from "./ports/hederaPorts.js";
