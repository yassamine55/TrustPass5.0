import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const Product = require("../../src/models/Product.js");
const Document = require("../../src/models/Document.js");
const { completeInspection, adminList } = require("../../src/controllers/technicalInspectionController.js");
const { errorHandler } = require("../../src/middleware/errorHandler.js");

const repairerId = "507f1f77bcf86cd799439013";
const productId = "507f1f77bcf86cd799439011";
const checklist = ["model", "serialNumber", "bodyCondition", "boots"].map((itemId) => ({
  itemId,
  status: "PASS",
  notes: "",
  evidenceReferences: []
}));

function setupRequest() {
  const product: any = {
    _id: { toString: () => productId },
    passportId: "RLP-2026-TEST",
    category: "Other",
    status: "ACTIVE",
    technicalInspection: {
      status: "IN_PROGRESS",
      assignedRepairer: repairerId,
      requestEvent: null
    },
    save: vi.fn().mockResolvedValue(undefined)
  };
  const query: any = {
    populate: vi.fn().mockReturnThis(),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(product).then(resolve, reject)
  };
  vi.spyOn(Product, "findById").mockReturnValue(query);
  vi.spyOn(Document, "find").mockResolvedValue([]);
  const req: any = {
    params: { id: productId },
    body: {
      checklist,
      summary: "Inspection completed",
      decision: "REPAIRABLE",
      reason: "",
      evidenceDocuments: []
    },
    user: {
      _id: repairerId,
      role: "REPAIRER",
      isVerified: true
    }
  };
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis()
  };
  const next = vi.fn((error?: Error) => {
    if (error) errorHandler(error, req, res, vi.fn());
  });
  return { product, req, res, next };
}

describe("technical inspection submission", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits a diagnosis without a Hedera account and attests it to the authenticated repairer", async () => {
    const { product, req, res, next } = setupRequest();

    await completeInspection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(product.save).toHaveBeenCalledOnce();
    expect(product.technicalInspection.status).toBe("COMPLETED");
    expect(product.technicalInspection.reviewStatus).toBe("PENDING_REVIEW");
    expect(product.technicalInspection.performedBy).toBe(repairerId);
    expect(product.technicalInspection.attestation).toMatchObject({
      verified: true,
      method: "TRUSTPASS_AUTHENTICATED_SESSION",
      actor: repairerId
    });
    expect(product.technicalInspection.diagnosis.signatureValid).toBeNull();
    expect(product.technicalInspection.diagnosis.attestationVerified).toBe(true);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("makes the submitted report visible in the admin review queue", async () => {
    const { product, req, res, next } = setupRequest();
    await completeInspection(req, res, next);
    expect(next).not.toHaveBeenCalled();

    const adminQuery: any = {
      populate: vi.fn().mockReturnThis(),
      sort: vi.fn().mockResolvedValue([product])
    };
    const find = vi.spyOn(Product, "find").mockReturnValue(adminQuery);
    await adminList({ user: { role: "ADMIN" } } as any, res, next);

    expect(find).toHaveBeenCalledWith(expect.objectContaining({
      $or: expect.arrayContaining([
        { "technicalInspection.reviewStatus": { $in: ["PENDING_REVIEW", "ADDITIONAL_EVIDENCE_REQUIRED"] } }
      ])
    }));
    expect(res.json).toHaveBeenCalledWith([product]);
  });
});
