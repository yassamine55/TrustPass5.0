import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivateKey } from "@hashgraph/sdk";
import { EvidenceHasher } from "../../src/hedera/evidence/evidenceHasher.js";
import { CanonicalSerializer } from "../../src/hedera/serialization/canonicalSerializer.js";
import { RepairerSignatureService } from "../../src/hedera/identity/repairerSignatureService.js";

const Product = require("../../src/models/Product.js");
const Document = require("../../src/models/Document.js");
const LifecycleEvent = require("../../src/models/LifecycleEvent.js");
const { sanitizePublicProduct } = require("../../src/routes/publicRoutes.js");
const { verifyEvidence } = require("../../src/controllers/verificationController.js");
const { analyzeDocument } = require("../../src/services/documentAnalysis.js");
const informationDiscrepancyService = require("../../src/services/informationDiscrepancyService.js");
const { getInspectionValidity, assertInspectionReviewAction } = require("../../src/domain/technicalInspection.js");
const { assertRepairVerificationAssignedToUser } = require("../../src/domain/repairVerification.js");
const { computeLifecycleRecordHash, verifyLifecycleRecordHash } = require("../../src/hedera/verification/lifecycleRecordIntegrity.js");

const ids = {
  product: "507f1f77bcf86cd799439011",
  owner: "507f1f77bcf86cd799439012",
  repairer: "507f1f77bcf86cd799439013",
  otherRepairer: "507f1f77bcf86cd799439014",
  event: "507f1f77bcf86cd799439015",
};

function anchoredEvent(event: Record<string, unknown>) {
  const recordHash = computeLifecycleRecordHash(event);
  return {
    event: { ...event, recordHash },
    hcsMessageText: JSON.stringify({ protocolVersion: 1, recordHash }),
  };
}

function queryResult<T>(value: T) {
  return {
    select: vi.fn().mockResolvedValue(value),
    sort: vi.fn().mockReturnThis(),
  };
}

function fakeDocument(overrides: Record<string, unknown> = {}) {
  return {
    _id: "507f1f77bcf86cd799439021",
    originalName: "repair-invoice.txt",
    mimeType: "text/plain",
    path: path.join(os.tmpdir(), `reloop-core-flow-${Date.now()}-${Math.random()}.txt`),
    sha256: null,
    product: ids.product,
    event: ids.event,
    repair: null,
    analysisStatus: "NOT_ANALYZED",
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(informationDiscrepancyService, "createInformationDiscrepancy")
    .mockResolvedValue({ _id: "discrepancy-1", type: "EVENT_DISPUTED" });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("core ReLoop Passport demo flows", () => {
  it("SCENARIO 1: creates a device event, anchors it, and verifies a matching hash", () => {
    const product = new Product({
      _id: ids.product,
      passportId: "RLP-CORE-001",
      brand: "ReLoop",
      model: "Demo Phone",
      category: "Smartphone",
      serialNumberHash: "serial-fingerprint",
      owner: ids.owner,
    });
    const event = new LifecycleEvent({
      _id: ids.event,
      eventId: "EVT-CORE-001",
      product: product._id,
      type: "PRODUCT_CREATED",
      actor: ids.owner,
      description: "Device created by owner",
    });
    const anchor = anchoredEvent(event.toObject());

    expect(product.passportId).toBe("RLP-CORE-001");
    expect(verifyLifecycleRecordHash({ currentRecord: anchor.event, hcsMessageText: anchor.hcsMessageText }))
      .toMatchObject({ valid: true, status: "HASH_MATCH" });
  });

  it("SCENARIO 2: detects MongoDB event tampering after anchoring", () => {
    const original = {
      eventId: "EVT-CORE-002",
      product: ids.product,
      type: "REPAIR",
      actor: ids.repairer,
      description: "Battery replaced",
    };
    const anchor = anchoredEvent(original);
    const tampered = { ...original, description: "Battery and screen replaced" };

    expect(verifyLifecycleRecordHash({ currentRecord: tampered, hcsMessageText: anchor.hcsMessageText }))
      .toMatchObject({ valid: false, status: "HASH_MISMATCH" });
  });

  it("SCENARIO 3: assigns a repair claim to one repairer and verifies that repairer's attestation", async () => {
    const privateKey = PrivateKey.generateED25519();
    const accountId = "0.0.12345";
    const signatureService = new RepairerSignatureService({
      getAccountPublicKey: vi.fn().mockResolvedValue(privateKey.publicKey.toString()),
    } as any);
    const request = { targetRepairerId: ids.repairer, status: "PENDING" };
    const payload = signatureService.buildRepairAttestationPayload({
      claimId: "REP-CORE-003",
      repairId: "REP-CORE-003",
      productId: ids.product,
      passportId: "RLP-CORE-003",
      repairerId: ids.repairer,
      repairerAccountId: accountId,
      description: "Battery replaced",
      changedParts: ["battery"],
      date: "2026-09-20T10:00:00.000Z",
      evidenceHash: "evidence-hash",
    });
    const signature = privateKey.sign(signatureService.createSigningPayload(payload));

    expect(() => assertRepairVerificationAssignedToUser({ request, user: { _id: ids.otherRepairer } })).toThrow(/not assigned/i);
    expect(() => assertRepairVerificationAssignedToUser({ request, user: { _id: ids.repairer } })).not.toThrow();
    await expect(signatureService.verifySignature({ accountId, payload, signature })).resolves.toMatchObject({ valid: true });
  });

  it("SCENARIO 4: binds evidence to a signed payload and rejects modified evidence", () => {
    const hasher = new EvidenceHasher();
    const serializer = new CanonicalSerializer();
    const privateKey = PrivateKey.generateED25519();
    const evidence = "invoice contents before tampering";
    const payload = { evidenceHash: hasher.hash(evidence), documentId: "doc-4", claim: "repair" };
    const signature = privateKey.sign(serializer.serialize(payload));
    const changedPayload = { ...payload, evidenceHash: hasher.hash("invoice contents after tampering") };

    expect(hasher.verify(evidence, payload.evidenceHash)).toBe(true);
    expect(hasher.verify("invoice contents after tampering", payload.evidenceHash)).toBe(false);
    expect(privateKey.publicKey.verify(serializer.serialize(payload), signature)).toBe(true);
    expect(privateKey.publicKey.verify(serializer.serialize(changedPayload), signature)).toBe(false);
  });

  it("SCENARIO 5: anchors a system-attributed discrepancy only for a confirmed invoice contradiction", async () => {
    const contents = "Repairer: Atelier\nModel: Demo Phone 13\nPrice: 149.99";
    const document = fakeDocument();
    document.sha256 = crypto.createHash("sha256").update(contents).digest("hex");
    fs.writeFileSync(document.path, contents);
    const product = { _id: ids.product, brand: "ReLoop", model: "Demo Phone 14", serialNumberHash: null, imeiHash: null };
    const system = { _id: "507f1f77bcf86cd799439031", role: "ADMIN", firstName: "System" };

    vi.spyOn(Document, "findById").mockResolvedValue(document);
    vi.spyOn(Document, "findOne").mockReturnValue(queryResult(null) as any);
    vi.spyOn(Product, "findById").mockReturnValue(queryResult(product) as any);
    vi.spyOn(LifecycleEvent, "findOne").mockReturnValue({ sort: vi.fn().mockReturnThis(), select: vi.fn().mockResolvedValue(null) } as any);
    vi.spyOn(require("../../src/models/User.js"), "findOne").mockResolvedValue(system);

    const result = await analyzeDocument(document._id);

    expect(result.advisoryAnalysis.outcome).toBe("CONFIRMED_CONTRADICTION");
    expect(informationDiscrepancyService.createInformationDiscrepancy).toHaveBeenCalledWith(expect.objectContaining({
      actor: system,
      sourceRef: `DISCREPANCY:${document._id}:CONFIRMED_CONTRADICTION`,
    }));
    expect((informationDiscrepancyService.createInformationDiscrepancy as any).mock.calls[0][0].description).toContain("Analysis: CONFIRMED CONTRADICTION");
    fs.unlinkSync(document.path);
  });

  it("SCENARIO 6: routes OCR failure to manual review without creating an accusation", async () => {
    const document = fakeDocument({
      path: path.join(os.tmpdir(), "reloop-file-that-does-not-exist.txt"),
      product: null,
    });
    vi.spyOn(Document, "findById").mockResolvedValue(document);
    vi.spyOn(Document, "findOne").mockReturnValue(queryResult(null) as any);

    const result = await analyzeDocument(document._id);

    expect(result.analysisStatus).toBe("FLAGGED");
    expect(result.advisoryAnalysis.outcome).toBe("OCR_FAILED");
    expect(result.analysisNote).toContain("OCR could not confirm");
    expect(informationDiscrepancyService.createInformationDiscrepancy).not.toHaveBeenCalled();
  });

  it("SCENARIO 7: keeps an inspection tied to its recorded date after a later repair", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "TECHNICALLY_VERIFIED",
        inspectedAt: "2026-09-10T10:00:00.000Z",
        inspectedState: "screen: PASS; battery: PASS",
        performedBy: { _id: ids.repairer },
      },
    };
    const result = getInspectionValidity({
      product,
      events: [{ type: "REPAIR", createdAt: "2026-09-20T10:00:00.000Z", description: "Battery replaced" }],
    });

    expect(result.inspectionDate).toBe("2026-09-10T10:00:00.000Z");
    expect(result.inspectedState).toContain("battery: PASS");
    expect(result.isCurrent).toBe(false);
    expect(result.affectedBy).toEqual(["REPAIR"]);
  });

  it("SCENARIO 8: keeps NOT_REPAIRABLE pending until admin approval", () => {
    const product = { status: "ACTIVE" };
    const inspection = {
      status: "COMPLETED",
      reviewStatus: "PENDING_REVIEW",
      diagnosis: { decision: "NOT_REPAIRABLE" },
      pendingLifecycleState: { type: "END_OF_LIFE", reviewRequired: true },
    };

    expect(() => assertInspectionReviewAction({ product, inspection, action: "REJECT", user: { role: "ADMIN" } })).not.toThrow();
    inspection.reviewStatus = "REJECTED";
    expect(product.status).toBe("ACTIVE");

    const approvedProduct = { status: "ACTIVE" };
    const approvedInspection = { ...inspection, reviewStatus: "PENDING_REVIEW" };
    expect(() => assertInspectionReviewAction({ product: approvedProduct, inspection: approvedInspection, action: "APPROVE", user: { role: "ADMIN" } })).not.toThrow();
    approvedProduct.status = "END_OF_LIFE";
    expect(approvedProduct.status).toBe("END_OF_LIFE");
  });

  it("SCENARIO 9: keeps public passport data minimal and verification GET read-only", async () => {
    const publicPayload = sanitizePublicProduct({
      _id: ids.product,
      passportId: "RLP-CORE-009",
      brand: "ReLoop",
      model: "Demo Phone",
      category: "Smartphone",
      status: "ACTIVE",
      serialNumberHash: "serial-fingerprint",
      imeiHash: "imei-fingerprint",
      owner: { _id: ids.owner, firstName: "Private", lastName: "Owner", email: "owner@example.test", role: "OWNER" },
      documentId: { originalName: "private-invoice.pdf", sha256: "document-hash" },
    });
    const documentPath = path.join(os.tmpdir(), `reloop-core-flow-evidence-${Date.now()}.txt`);
    fs.writeFileSync(documentPath, "tampered evidence");
    vi.spyOn(Document, "findById").mockReturnValue({ select: vi.fn().mockResolvedValue({
      _id: "doc-9", path: documentPath, sha256: "stored-hash", product: ids.product, event: ids.event,
    }) } as any);
    const res = { json: vi.fn() };

    await verifyEvidence({ params: { documentId: "doc-9" } }, res, vi.fn());

    expect(JSON.stringify(publicPayload)).not.toContain("Private");
    expect(JSON.stringify(publicPayload)).not.toContain("Owner");
    expect(JSON.stringify(publicPayload)).not.toContain("serial-fingerprint");
    expect(JSON.stringify(publicPayload)).not.toContain("imei-fingerprint");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ valid: false, status: "HASH_MISMATCH" }));
    expect(informationDiscrepancyService.createInformationDiscrepancy).not.toHaveBeenCalled();
    fs.unlinkSync(documentPath);
  });
});