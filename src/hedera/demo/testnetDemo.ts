import "dotenv/config";

import {
  createHederaConfig,
  createHederaModule,
  EvidenceHasher,
  type LifecycleEvent,
} from "../index.js";

const DEVICE_ID = `demo-device-${Date.now()}`;
const DEMO_EVIDENCE = Buffer.from("ReLoop Testnet demo evidence", "utf8");

async function main(): Promise<void> {
  const config = createHederaConfig();
  if (config.network !== "testnet") {
    throw new Error("The demo only runs against Hedera Testnet");
  }

  const hedera = createHederaModule(config);
  const evidenceHasher = new EvidenceHasher();
  const evidenceHash = evidenceHasher.hash(DEMO_EVIDENCE);
  const actorAccountId = hedera.client.operatorId.toString();

  try {
    console.log(`Connected to Hedera ${config.network} as ${actorAccountId}`);

    const topicCreation = config.topicId
      ? undefined
      : await hedera.lifecycleEvents.createTopic({
          memo: "ReLoop Testnet demo lifecycle topic",
        });
    const topicId = config.topicId ?? topicCreation!.topicId;
    if (topicCreation) printTransaction("HCS topic creation", topicCreation.transactionId);
    console.log(`HCS topic: ${topicId}`);

    const tokenCreation = config.deviceTokenId
      ? undefined
      : await hedera.deviceNft.createDeviceToken({
          name: "ReLoop Testnet Device",
          symbol: "RLPD",
          memo: "ReLoop Testnet demo device NFT collection",
        });
    const tokenId = config.deviceTokenId ?? tokenCreation!.tokenId.toString();
    if (tokenCreation) printTransaction("HTS token creation", tokenCreation.transactionId);
    console.log(`HTS device token: ${tokenId}`);

    // HTS NFT metadata is limited to 100 bytes; keep only public references on-chain.
    const metadata = { deviceId: DEVICE_ID, publicReference: "testnet-demo" };
    const mint = await hedera.deviceNft.mintDevice({ tokenId, metadata });
    printTransaction("Device NFT mint", mint.transactionId);
    console.log(`Minted NFT serial: ${mint.serialNumber}`);

    const eventResults = [] as Array<{
      eventType: string;
      transactionId: string;
      sequenceNumber: number;
    }>;
    for (const eventType of ["PRODUCT_CREATED", "REPAIR", "END_OF_LIFE"] as const) {
      const event: LifecycleEvent = {
        eventId: `${DEVICE_ID}-${eventType.toLowerCase()}`,
        eventType,
        deviceId: DEVICE_ID,
        deviceTokenId: tokenId,
        deviceSerialNumber: mint.serialNumber,
        actorAccountId,
        occurredAt: new Date().toISOString(),
        evidenceHash,
        metadata: { publicReference: "testnet-demo" },
      };
      const submission = await hedera.lifecycleEvents.publishEvent({ topicId, event });
      if (submission.sequenceNumber === undefined) {
        throw new Error(`HCS did not return a sequence number for ${eventType}`);
      }
      eventResults.push({
        eventType,
        transactionId: submission.transactionId,
        sequenceNumber: submission.sequenceNumber,
      });
      printTransaction(`${eventType} HCS event`, submission.transactionId);
      console.log(`  HCS sequence: ${submission.sequenceNumber}`);
    }

    const messages = await waitForMessages(hedera.mirrorNode, topicId, eventResults.length);
    console.log(`Mirror Node returned ${messages.length} HCS message(s)`);
    for (const eventResult of eventResults) {
      const message = messages.find(
        (item) =>
          item.messageText.includes(DEVICE_ID) &&
          item.messageText.includes(eventResult.eventType),
      );
      if (!message) throw new Error(`Mirror Node did not return ${eventResult.eventType}`);
      console.log(
        `${eventResult.eventType}: sequence=${message.sequenceNumber}, consensus=${message.consensusTimestamp}`,
      );
    }

    const nft = await waitForNft(hedera.deviceNft, tokenId, mint.serialNumber);
    console.log(`Mirror NFT: ${nft.tokenId}/${nft.serialNumber}, owner=${nft.accountId ?? "unknown"}`);

    const lifecycle = await hedera.lifecycleEvents.getDeviceLifecycle({ topicId, deviceId: DEVICE_ID });
    const firstEvent = await hedera.lifecycleEvents.getEvent({
      topicId,
      sequenceNumber: eventResults[0].sequenceNumber,
    });
    console.log(`Validated lifecycle events: ${lifecycle.length}`);
    console.log(`Validated first event: ${firstEvent.eventType}`);

    const evidenceVerification = await hedera.verification.verifyEvidenceHash({
      data: DEMO_EVIDENCE,
      expectedHash: evidenceHash,
    });
    console.log(`Evidence SHA-256 verified: ${evidenceVerification.valid}`);

    for (const eventResult of eventResults) {
      const transaction = await hedera.transactions.getConsensusInformation(
        eventResult.transactionId,
        { topicId, sequenceNumber: eventResult.sequenceNumber },
      );
      console.log(
        `${eventResult.eventType} transaction=${transaction.transactionId}, consensus=${transaction.consensusTimestamp ?? "pending"}`,
      );
    }
  } finally {
    hedera.client.close();
  }
}

async function waitForMessages(
  mirrorNode: ReturnType<typeof createHederaModule>["mirrorNode"],
  topicId: string,
  expectedCount: number,
) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const messages = await mirrorNode.getTopicMessages(topicId, { limit: 100, order: "asc" });
    if (messages.filter((message) => message.messageText.includes(DEVICE_ID)).length >= expectedCount) {
      return messages;
    }
    await delay(3_000);
  }
  throw new Error("Timed out waiting for HCS messages in Mirror Node");
}

async function waitForNft(
  deviceNft: ReturnType<typeof createHederaModule>["deviceNft"],
  tokenId: string,
  serialNumber: number,
) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await deviceNft.getDeviceNft({ tokenId, serialNumber });
    } catch (error) {
      if (attempt === 39) throw error;
      await delay(3_000);
    }
  }
  throw new Error("Timed out waiting for NFT in Mirror Node");
}

function printTransaction(label: string, transactionId: string): void {
  console.log(`${label} transaction: ${transactionId}`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
