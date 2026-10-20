import { describe, expect, it } from "vitest";
import { assertLifecycleAuthorization, assertLifecycleTransition } from "../../src/services/lifecycleState.js";

describe("backend lifecycle transitions", () => {
  it("allows the required end-of-life path", () => {
    expect(assertLifecycleTransition("ACTIVE", "END_OF_LIFE")).toBe("END_OF_LIFE");
    expect(assertLifecycleTransition("END_OF_LIFE", "LISTED_FOR_PARTS")).toBe("LISTED_FOR_PARTS");
    expect(assertLifecycleTransition("LISTED_FOR_PARTS", "SOLD_FOR_PARTS")).toBe("SOLD_FOR_PARTS");
    expect(assertLifecycleTransition("SOLD_FOR_PARTS", "RECYCLED")).toBe("RECYCLED");
    expect(assertLifecycleTransition("SOLD_FOR_PARTS", "DECOMMISSIONED")).toBe("DECOMMISSIONED");
  });

  it("rejects skipping required marketplace states", () => {
    expect(() => assertLifecycleTransition("END_OF_LIFE", "SOLD_FOR_PARTS"))
      .toThrow("SOLD_FOR_PARTS is not allowed from product status END_OF_LIFE");
    expect(() => assertLifecycleTransition("ACTIVE", "RECYCLED"))
      .toThrow("RECYCLED is not allowed from product status ACTIVE");
  });

  it("requires a verified repairer and an associated repair request for end-of-life", () => {
    expect(() => assertLifecycleAuthorization({
      eventType: "END_OF_LIFE",
      user: { role: "BUYER", isVerified: true },
      product: { owner: { toString: () => "owner" } }
    })).toThrow("through a repair request");
    expect(() => assertLifecycleAuthorization({
      eventType: "END_OF_LIFE",
      user: { role: "OWNER", isVerified: true },
      product: { owner: { toString: () => "owner" } },
      repairRequest: "inspection-request-event"
    })).toThrow("through a repair request");
    expect(() => assertLifecycleAuthorization({
      eventType: "END_OF_LIFE",
      user: { role: "REPAIRER", isVerified: true },
      product: { owner: { toString: () => "owner" } },
      repairRequest: "inspection-request-event"
    })).not.toThrow();
  });

  it("allows only the owner to list an end-of-life device for parts", () => {
    const product = { owner: { toString: () => "owner" } };
    expect(() => assertLifecycleAuthorization({
      eventType: "LISTED_FOR_PARTS",
      user: { role: "REPAIRER", isVerified: true, _id: { toString: () => "repairer" } },
      product
    })).toThrow("Only the owner");
    expect(() => assertLifecycleAuthorization({
      eventType: "LISTED_FOR_PARTS",
      user: { role: "OWNER", isVerified: true, _id: { toString: () => "owner" } },
      product
    })).not.toThrow();
  });
});