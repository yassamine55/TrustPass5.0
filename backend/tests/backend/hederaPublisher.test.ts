import { describe, expect, it, vi } from "vitest";

let hederaModule: any = null;
vi.mock("../../src/services/hederaModule", () => ({
  getHederaModule: () => hederaModule
}));

import {
  mintProductDevice,
  publishLifecycleEvent,
  transferProductDevice
} from "../../src/services/hederaLifecyclePublisher.js";

const product: any = {
  passportId: "RLP-2026-TEST",
  brand: "ReLoop",
  model: "Phone",
  category: "ELECTRONICS",
  hederaTokenId: "0.0.100",
  hederaSerialNumber: 1
};

describe("application Hedera publisher", () => {
  it("records a failed state when integration is disabled", async () => {
    const result = await publishLifecycleEvent({
      product,
      lifecycleEvent: { eventId: "evt-1", type: "REPAIR" },
      actor: {},
      hedera: null
    });
    expect(result.status).toBe("FAILED");
  });

  it("maps NFT, HCS, and HTS confirmations without exposing credentials", async () => {
    const hedera: any = {
      client: { operatorId: { toString: () => "0.0.123" } },
      deviceNft: {
        mintDevice: vi.fn().mockResolvedValue({ tokenId: { toString: () => "0.0.100" }, serialNumber: 2, transactionId: "tx-mint" }),
        transferDevice: vi.fn().mockResolvedValue({ transactionId: "tx-transfer" })
      },
      lifecycleEvents: {
        publishEvent: vi.fn().mockResolvedValue({ topicId: "0.0.200", sequenceNumber: 4, transactionId: "tx-hcs" })
      },
      verification: {
        verifyLifecycleEvent: vi.fn().mockResolvedValue({ valid: true, message: { consensusTimestamp: "2026-09-18T00:00:00Z" } })
      }
    };

    const mint = await mintProductDevice({ passportId: "RLP-NEW" }, hedera);
    const lifecycle = await publishLifecycleEvent({
      product,
      lifecycleEvent: { eventId: "evt-2", type: "END_OF_LIFE", createdAt: new Date() },
      actor: {},
      hedera
    });
    const transfer = await transferProductDevice({ product, fromAccountId: "0.0.1", toAccountId: "0.0.2", hedera });

    expect(mint.status).toBe("CONFIRMED");
    expect(lifecycle.status).toBe("CONFIRMED");
    expect(hedera.lifecycleEvents.publishEvent).toHaveBeenCalledWith(expect.objectContaining({ event: expect.objectContaining({ eventType: "END_OF_LIFE" }) }));
    expect(transfer.status).toBe("CONFIRMED");
    expect(JSON.stringify(lifecycle)).not.toContain("operatorKey");
  });
});

