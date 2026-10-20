import { beforeEach, describe, expect, it, vi } from "vitest";

const Product = require("../../src/models/Product.js");
const Repair = require("../../src/models/Repair.js");
const hederaModule = require("../../src/services/hederaModule.js");
const { retryPassportProof, verifyPassportProof } = require("../../src/controllers/productController.js");
const { buildPassportHashPayload, computePassportHash, PASSPORT_HASH_SCHEMA_VERSION } = require("../../src/utils/passportHash.js");

const ownerId = "507f1f77bcf86cd799439013";
const passportId = "507f1f77bcf86cd799439011";

function setupPassport(model = "Phone") {
  const passport: any = {
    _id: passportId,
    passportId: "RLP-2026-ABC123",
    brand: "Example",
    model,
    category: "Smartphone",
    owner: ownerId,
    hederaProof: {
      status: "CONFIRMED",
      transactionId: "0.0.123@1234567890.000000001",
      topicId: "0.0.456",
      sequenceNumber: 7,
      consensusTimestamp: "2026-10-20T12:00:00.000Z",
      hash: ""
    },
    save: vi.fn().mockResolvedValue(undefined)
  };
  passport.hederaProof.schemaVersion = PASSPORT_HASH_SCHEMA_VERSION;
  passport.hederaProof.payload = buildPassportHashPayload(passport);
  passport.hederaProof.hash = computePassportHash(passport.hederaProof.payload);
  return passport;
}

function setupResponse() {
  const req: any = { params: { id: passportId }, user: { _id: ownerId, role: "OWNER" } };
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  return { req, res, next: vi.fn() };
}

describe("passport proof verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(Repair, "find").mockReturnValue({
      select: () => ({ lean: async () => [] })
    } as any);
  });

  it("recomputes current passport data and compares it with the decoded Mirror Node message", async () => {
    const passport = setupPassport();
    const onChainHash = computePassportHash(passport);
    passport.hederaProof.hash = onChainHash;
    vi.spyOn(Product, "findById").mockReturnValue({
      select: () => Promise.resolve(passport)
    } as any);
    vi.spyOn(hederaModule, "getHederaModule").mockReturnValue({
      mirrorNode: {
        getTopicMessages: vi.fn().mockResolvedValue([{
          sequenceNumber: 7,
          messageText: onChainHash,
          consensusTimestamp: passport.hederaProof.consensusTimestamp
        }])
      }
    } as any);
    const { req, res, next } = setupResponse();

    await verifyPassportProof(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      matches: true,
      localHash: onChainHash,
      onChainHash
    }));
  });

  it("reports a mismatch when the passport has changed since anchoring", async () => {
    const passport = setupPassport("Changed model");
    const anchoredHash = computePassportHash(setupPassport());
    passport.hederaProof.hash = anchoredHash;
    vi.spyOn(Product, "findById").mockReturnValue({
      select: () => Promise.resolve(passport)
    } as any);
    vi.spyOn(hederaModule, "getHederaModule").mockReturnValue({
      mirrorNode: {
        getTopicMessages: vi.fn().mockResolvedValue([{
          sequenceNumber: 7,
          messageText: anchoredHash,
          consensusTimestamp: passport.hederaProof.consensusTimestamp
        }])
      }
    } as any);
    const { req, res, next } = setupResponse();

    await verifyPassportProof(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      matches: false,
      onChainHash: anchoredHash
    }));
  });

  it("does not publish a duplicate proof when the existing proof is confirmed", async () => {
    const passport = setupPassport();
    vi.spyOn(Product, "findById").mockResolvedValue(passport);
    const { req, res, next } = setupResponse();

    await retryPassportProof(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
