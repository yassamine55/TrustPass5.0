import { describe, expect, it } from "vitest";
import RepairVerificationRequest from "../../src/models/RepairVerificationRequest.js";
import { assertRepairVerificationAssignedToUser } from "../../src/domain/repairVerification.js";

describe("repair verification assignment enforcement", () => {
  it("requires a target repairer on a verification request", async () => {
    const request = new RepairVerificationRequest({
      repair: "507f1f77bcf86cd799439011",
      product: "507f1f77bcf86cd799439012",
      requester: "507f1f77bcf86cd799439013",
      status: "PENDING",
    });

    await expect(request.validate()).rejects.toThrow(/targetRepairerId/i);
  });

  it("allows only the assigned repairer to access a pending request", () => {
    const request = {
      targetRepairerId: { toString: () => "repairer-1" },
      status: "PENDING",
    } as any;

    expect(() => assertRepairVerificationAssignedToUser({
      user: { _id: "repairer-1" },
      request,
    })).not.toThrow();

    expect(() => assertRepairVerificationAssignedToUser({
      user: { _id: "repairer-2" },
      request,
    })).toThrow("not assigned");
  });
});
