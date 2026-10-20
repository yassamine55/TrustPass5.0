import fs from "fs";
import os from "os";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const Product = require("../../src/models/Product.js");
const Document = require("../../src/models/Document.js");
const infoDiscrepancy = require("../../src/services/informationDiscrepancyService.js");
const { sanitizePublicProduct } = require("../../src/routes/publicRoutes.js");
const { verifyEvidence, createEvidenceDispute } = require("../../src/controllers/verificationController.js");

const publicPassport = {
  _id: "product-1",
  passportId: "RLP-2026-TEST01",
  brand: "Apple",
  model: "iPhone 14",
  category: "Smartphone",
  status: "ACTIVE",
  serialNumberHash: "deadbeef",
  imeiHash: "feedface",
  owner: { _id: "owner-1", firstName: "Jane", lastName: "Doe", role: "OWNER", isVerified: true },
  documentId: { _id: "doc-1", category: "PURCHASE_INVOICE", sha256: "abc123", originalName: "Jane_Doe_Invoice.pdf", verificationStatus: "VERIFIED" },
  provenance: { verificationStatus: "OWNER_DECLARED" }
};

describe("public and verification privacy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(infoDiscrepancy, "createInformationDiscrepancy").mockResolvedValue({ _id: "evt-1" });
  });

  it("does not expose private owner information in the public passport response", async () => {
    const payload = sanitizePublicProduct(publicPassport);

    expect(payload.owner).toMatchObject({ _id: "owner-1", role: "OWNER", isVerified: true });
    expect(payload.owner.firstName).toBeUndefined();
    expect(payload.owner.lastName).toBeUndefined();
    expect(payload.owner.email).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("Jane");
    expect(JSON.stringify(payload)).not.toContain("Doe");
    expect(JSON.stringify(payload)).not.toContain("deadbeef");
    expect(JSON.stringify(payload)).not.toContain("feedface");
    expect(JSON.stringify(payload)).not.toContain("Jane_Doe_Invoice.pdf");
  });

  it("does not trigger a discrepancy when a GET verification checks evidence integrity", async () => {
    const documentPath = path.join(os.tmpdir(), "reloop-verify-evidence.txt");
    const document = {
      _id: "doc-1",
      path: documentPath,
      sha256: "expected-hash",
      product: "product-1",
      uploadedBy: "owner-1",
      originalName: "invoice.pdf"
    };
    fs.writeFileSync(documentPath, "different content");
    vi.spyOn(Document, "findById").mockReturnValue({ select: vi.fn().mockResolvedValue(document) });

    const req = { params: { documentId: "doc-1" } };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await verifyEvidence(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      valid: false,
      documentId: "doc-1",
      status: "HASH_MISMATCH"
    }));
    expect(infoDiscrepancy.createInformationDiscrepancy).not.toHaveBeenCalled();

    fs.unlinkSync(documentPath);
  });

  it("allows authorized dispute creation when the user is allowed to amend the event", async () => {
    const documentPath = path.join(os.tmpdir(), "reloop-dispute-evidence.txt");
    const document = {
      _id: "doc-1",
      path: documentPath,
      sha256: "expected-hash",
      product: "product-1",
      uploadedBy: "owner-1",
      originalName: "invoice.pdf",
      event: "evt-1"
    };
    fs.writeFileSync(documentPath, "different content");
    vi.spyOn(Document, "findById").mockResolvedValue(document);
    vi.spyOn(Product, "findById").mockResolvedValue({ _id: "product-1", owner: { toString: () => "owner-1" } });

    const req = {
      params: { documentId: "doc-1" },
      body: { description: "There is a mismatch" },
      user: { _id: "owner-1", role: "OWNER" }
    } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await createEvidenceDispute(req, res, next);

    expect(infoDiscrepancy.createInformationDiscrepancy).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "Evidence dispute recorded",
      documentId: "doc-1"
    }));

    fs.unlinkSync(documentPath);
  });
});
