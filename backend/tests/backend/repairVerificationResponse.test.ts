import { beforeEach, describe, expect, it, vi } from "vitest";

const Repair = require("../../src/models/Repair.js");
const RepairVerificationRequest = require("../../src/models/RepairVerificationRequest.js");
const LifecycleEvent = require("../../src/models/LifecycleEvent.js");
const publisher = require("../../src/services/hederaLifecyclePublisher.js");
const publishSpy = vi.spyOn(publisher, "publishAndPersistLifecycleEvent");
const { respond } = require("../../src/controllers/repairVerificationController.js");

const repairerId = "507f1f77bcf86cd799439013";
const repairId = "507f1f77bcf86cd799439014";
const requestId = "507f1f77bcf86cd799439015";

function setup(action: string, body: Record<string, unknown> = {}) {
  const repair = {
    _id: repairId,
    repairId: "REP-2026-ABC123",
    product: { _id: "507f1f77bcf86cd799439016", passportId: "RLP-2026-ABC123" },
    claimant: "507f1f77bcf86cd799439017",
    description: "Screen repair",
    changedParts: ["Screen"],
    provenance: {},
    save: vi.fn().mockResolvedValue(undefined)
  };
  const request = {
    _id: requestId,
    repair,
    targetRepairerId: repairerId,
    status: "PENDING",
    save: vi.fn().mockResolvedValue(undefined),
    toObject: () => ({ repair: { signature: repair.signature } })
  };
  const requestQuery = { populate: vi.fn() };
  requestQuery.populate.mockReturnValueOnce(requestQuery).mockResolvedValueOnce(request);
  vi.spyOn(RepairVerificationRequest, "findById").mockReturnValue({
    ...requestQuery
  } as any);
  vi.spyOn(Repair, "findById").mockReturnValue({
    populate: vi.fn().mockResolvedValue(repair)
  } as any);
  vi.spyOn(LifecycleEvent, "create").mockResolvedValue({
    eventId: "EVT-2026-ABC123",
    _id: "507f1f77bcf86cd799439018",
    type: action === "ACCEPT" ? "REPAIR_PROFESSIONALLY_ATTESTED" : "REPAIR_CLAIM_REJECTED",
    save: vi.fn().mockResolvedValue(undefined)
  } as any);

  const req: any = {
    params: { id: requestId },
    body: { action, ...body },
    user: { _id: repairerId, role: "REPAIRER", isVerified: true }
  };
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  return { req, res, next: vi.fn(), repair, request };
}

describe("repair verification responses without Hedera signature verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    publishSpy.mockResolvedValue({ status: "FAILED" } as any);
  });

  it("accepts a non-empty text signature and records the authenticated signer and date", async () => {
    const { req, res, next, repair, request } = setup("ACCEPT", { signature: "Repairer signature text" });
    await respond(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(repair.signature).toBe("Repairer signature text");
    expect(repair.signatureSigner).toBe(repairerId);
    expect(repair.signatureSignedAt).toBeInstanceOf(Date);
    expect(repair.repairer).toBe(repairerId);
    expect(repair.signatureValid).toBeNull();
    expect(request.status).toBe("ACCEPTED");
    expect(publishSpy).toHaveBeenCalledOnce();
  });

  it("returns a clear 400 when acceptance has no text signature", async () => {
    const { req, res, next } = setup("ACCEPT", { signature: "  " });

    await respond(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "La signature est obligatoire" });
  });

  it("rejects with any non-empty note and does not require a signature", async () => {
    const { req, res, next, repair, request } = setup("REJECT", { note: "x" });
    await respond(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(request.status).toBe("REJECTED");
    expect(request.responseNote).toBe("x");
    expect(repair.signature).toBeUndefined();
  });

  it("returns a clear 400 when a rejection note is empty", async () => {
    const { req, res, next } = setup("REJECT", { note: " " });

    await respond(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Une note de refus est obligatoire" });
  });
});
