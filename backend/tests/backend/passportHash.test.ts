import { describe, expect, it } from "vitest";

const Product = require("../../src/models/Product.js");
const { buildPassportHashPayload, computePassportHash } = require("../../src/utils/passportHash.js");

describe("passport hash", () => {
  it("sorts nested keys and ignores technical Hedera metadata", () => {
    const first = {
      model: "Phone",
      details: { serial: "abc", brand: "Example" },
      hederaProof: { hash: "old", transactionId: "tx-a" },
      createdAt: "2026-01-01T00:00:00.000Z"
    };
    const reordered = {
      createdAt: "2027-01-01T00:00:00.000Z",
      hederaProof: { hash: "new", transactionId: "tx-b" },
      details: { brand: "Example", serial: "abc" },
      model: "Phone"
    };

    expect(computePassportHash(first)).toBe(computePassportHash(reordered));
    expect(computePassportHash({ ...first, model: "Different phone" })).not.toBe(computePassportHash(first));
    expect(computePassportHash(first)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("ignores changing status and inspection workflow metadata", () => {
    const passport = new Product({
      passportId: "RLP-2026-ABC123",
      brand: "Example",
      model: "Phone",
      serialNumberHash: "serial-hash",
      category: "Smartphone",
      owner: "507f1f77bcf86cd799439013"
    });
    const anchoredHash = computePassportHash(passport);
    const changedWorkflow = passport.toObject({ depopulate: true, getters: false, virtuals: false });
    changedWorkflow.status = "MAINTENANCE";
    changedWorkflow.updatedAt = new Date("2026-10-20T12:00:00.000Z");
    changedWorkflow.__v = 12;
    changedWorkflow.technicalInspection.status = "IN_PROGRESS";
    changedWorkflow.technicalInspection.requestedAt = new Date("2026-10-20T12:00:00.000Z");

    expect(computePassportHash(changedWorkflow)).toBe(anchoredHash);
  });

  it("includes approved technical results and repair records in the versioned payload", () => {
    const passport = new Product({
      passportId: "RLP-2026-ABC123",
      brand: "Example",
      model: "Phone",
      serialNumberHash: "serial-hash",
      category: "Smartphone",
      owner: "507f1f77bcf86cd799439013"
    });
    const initialHash = computePassportHash(passport);
    const verified = passport.toObject({ depopulate: true, getters: false, virtuals: false });
    verified.technicalInspection.status = "TECHNICALLY_VERIFIED";
    verified.technicalInspection.reviewStatus = "APPROVED";
    verified.technicalInspection.inspectedAt = new Date("2026-10-20T12:00:00.000Z");
    verified.technicalInspection.checklist = [{
      itemId: "screen",
      status: "PASS",
      notes: "Original screen",
      evidenceReferences: []
    }];
    const verifiedHash = computePassportHash(verified);
    const withRepairHash = computePassportHash(buildPassportHashPayload(verified, [{
      repairId: "REP-1",
      date: new Date("2026-10-20T12:00:00.000Z"),
      description: "Screen replacement",
      changedParts: ["Screen"],
      claimant: "507f1f77bcf86cd799439013",
      repairer: "507f1f77bcf86cd799439014",
      verificationDecision: "PROFESSIONALLY_ATTESTED",
      ownerConfirmation: { status: "CONFIRMED" }
    }]));

    expect(verifiedHash).not.toBe(initialHash);
    expect(withRepairHash).not.toBe(verifiedHash);
    expect(buildPassportHashPayload(verified).technicalVerification.inspectedAt).toBe("2026-10-20T12:00:00.000Z");
    const payload = buildPassportHashPayload(verified, [{
      repairId: "REP-1",
      date: new Date("2026-10-20T12:00:00.000Z"),
      description: "Screen replacement",
      changedParts: ["Screen"],
      claimant: "507f1f77bcf86cd799439013"
    }]);
    expect(payload.repairs[0].date).toBe("2026-10-20T12:00:00.000Z");
    expect(payload.repairs[0].claimant).toBe("507f1f77bcf86cd799439013");
  });
});
