import { describe, expect, it } from "vitest";
import { getInspectionValidity, assertInspectionRequestDecision, assertInspectionReviewAction } from "../../src/domain/technicalInspection.js";

describe("technical inspection lifecycle validity", () => {
  it("allows only an admin to decide an unassigned inspection request", () => {
    const inspection = { status: "REQUESTED", assignedRepairer: null };

    expect(assertInspectionRequestDecision({ inspection, action: "ASSIGN", user: { role: "ADMIN" } })).toBe("ASSIGN");
    expect(assertInspectionRequestDecision({ inspection, action: "REJECT", user: { role: "ADMIN" } })).toBe("REJECT");
    expect(() => assertInspectionRequestDecision({ inspection, action: "ASSIGN", user: { role: "OWNER" } }))
      .toThrow("Only admins");
  });

  it("prevents assigning a request twice and rejects decisions after repairer acceptance", () => {
    expect(() => assertInspectionRequestDecision({
      inspection: { status: "REQUESTED", assignedRepairer: "repairer-1" },
      action: "ASSIGN",
      user: { role: "ADMIN" }
    })).toThrow("already assigned");

    expect(() => assertInspectionRequestDecision({
      inspection: { status: "IN_PROGRESS", assignedRepairer: "repairer-1" },
      action: "REJECT",
      user: { role: "ADMIN" }
    })).toThrow("no longer awaiting");
  });

  it("keeps evidence follow-up in the repairer workflow, not the new-request admin queue", () => {
    expect(() => assertInspectionRequestDecision({
      inspection: { status: "REQUESTED", reviewStatus: "ADDITIONAL_EVIDENCE_REQUIRED", assignedRepairer: "repairer-1" },
      action: "REJECT",
      user: { role: "ADMIN" }
    })).toThrow("not a new inspection request");
  });

  it("keeps a fresh inspection current", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "TECHNICALLY_VERIFIED",
        inspectedAt: "2026-09-15T10:00:00.000Z",
        inspectedState: "screen: pass; battery: pass",
        performedBy: { _id: "repairer-1", firstName: "Ana", lastName: "Repairer" }
      }
    };

    expect(getInspectionValidity({ product, events: [] }).isCurrent).toBe(true);
    expect(getInspectionValidity({ product, events: [] }).inspectionDate).toBe("2026-09-15T10:00:00.000Z");
  });

  it("invalidates a technical inspection after a later repair", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "TECHNICALLY_VERIFIED",
        inspectedAt: "2026-09-01T08:00:00.000Z",
        inspectedState: "screen: pass; battery: pass",
        performedBy: { _id: "repairer-1" }
      }
    };

    const result = getInspectionValidity({
      product,
      events: [{ type: "REPAIR", createdAt: "2026-09-10T09:00:00.000Z", description: "Battery replaced" }]
    });

    expect(result.isCurrent).toBe(false);
    expect(result.affectedBy).toContain("REPAIR");
  });

  it("invalidates a technical inspection after a later modification", () => {
    const product = {
      status: "MAINTENANCE",
      technicalInspection: {
        status: "TECHNICALLY_VERIFIED",
        inspectedAt: "2026-09-01T08:00:00.000Z",
        inspectedState: "screen: pass; battery: pass",
        performedBy: { _id: "repairer-1" }
      }
    };

    const result = getInspectionValidity({
      product,
      events: [{ type: "MAINTENANCE", createdAt: "2026-09-12T13:00:00.000Z", description: "Device serviced" }]
    });

    expect(result.isCurrent).toBe(false);
    expect(result.affectedBy).toContain("MAINTENANCE");
  });

  it("does not invalidate a technical inspection solely because ownership changed", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "TECHNICALLY_VERIFIED",
        inspectedAt: "2026-09-01T08:00:00.000Z",
        inspectedState: "screen: pass; battery: pass",
        performedBy: { _id: "repairer-1" }
      }
    };

    const result = getInspectionValidity({
      product,
      events: [{ type: "TRANSFERRED", createdAt: "2026-09-05T10:00:00.000Z", description: "Ownership transferred" }]
    });

    expect(result.isCurrent).toBe(true);
    expect(result.affectedBy).toEqual([]);
  });

  it("invalidates a technical inspection when a later dispute contradicts it", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "TECHNICALLY_VERIFIED",
        inspectedAt: "2026-09-01T08:00:00.000Z",
        inspectedState: "screen: pass; battery: pass",
        performedBy: { _id: "repairer-1" }
      }
    };

    const result = getInspectionValidity({
      product,
      events: [{ type: "EVENT_DISPUTED", createdAt: "2026-09-18T12:00:00.000Z", description: "INFORMATION DISCREPANCY\nContradicted device state" }]
    });

    expect(result.isCurrent).toBe(false);
    expect(result.affectedBy).toContain("EVENT_DISPUTED");
  });

  it("treats an old inspection as a historical snapshot, not a permanent claim", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "TECHNICALLY_VERIFIED",
        inspectedAt: "2025-01-01T00:00:00.000Z",
        inspectedState: "screen: pass; battery: pass",
        performedBy: { _id: "repairer-1" }
      }
    };

    const result = getInspectionValidity({ product, events: [] });
    expect(result.isCurrent).toBe(true);
    expect(result.reason).toContain("recorded state as of");
    expect(result.affectedBy).toEqual([]);
  });

  it("keeps a repairable inspection from changing the lifecycle before review", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "COMPLETED",
        reviewStatus: "PENDING_REVIEW",
        diagnosis: { decision: "REPAIRABLE" },
        pendingLifecycleState: null
      }
    };

    expect(() => assertInspectionReviewAction({
      product,
      inspection: product.technicalInspection,
      action: "APPROVE",
      user: { role: "ADMIN" }
    })).not.toThrow();
  });

  it("requires administrative approval before END_OF_LIFE is entered", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "COMPLETED",
        reviewStatus: "PENDING_REVIEW",
        diagnosis: { decision: "NOT_REPAIRABLE" },
        pendingLifecycleState: { type: "END_OF_LIFE", requestedAt: "2026-09-15T10:00:00.000Z" }
      }
    };

    expect(() => assertInspectionReviewAction({
      product,
      inspection: product.technicalInspection,
      action: "APPROVE",
      user: { role: "ADMIN" }
    })).not.toThrow();

    expect(() => assertInspectionReviewAction({
      product,
      inspection: product.technicalInspection,
      action: "REJECT",
      user: { role: "ADMIN" }
    })).not.toThrow();
  });

  it("rejects a duplicate admin review", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "TECHNICALLY_VERIFIED",
        reviewStatus: "APPROVED",
        diagnosis: { decision: "NOT_REPAIRABLE" }
      }
    };

    expect(() => assertInspectionReviewAction({
      product,
      inspection: product.technicalInspection,
      action: "APPROVE",
      user: { role: "ADMIN" }
    })).toThrow("already been reviewed");
  });

  it("rejects unauthorized review attempts", () => {
    const product = {
      status: "ACTIVE",
      technicalInspection: {
        status: "COMPLETED",
        reviewStatus: "PENDING_REVIEW",
        diagnosis: { decision: "REPAIRABLE" }
      }
    };

    expect(() => assertInspectionReviewAction({
      product,
      inspection: product.technicalInspection,
      action: "APPROVE",
      user: { role: "REPAIRER" }
    })).toThrow("Only admins can review");
  });
});
