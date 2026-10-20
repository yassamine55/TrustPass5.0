import { describe, expect, it } from "vitest";
import { errorMessage } from "../../../frontend/src/lib/api.js";

describe("frontend API error messages", () => {
  it("shows local validation errors instead of reporting a network failure", () => {
    expect(errorMessage(new Error("Inspection summary is required")))
      .toBe("Inspection summary is required");
  });

  it("keeps network failures distinguishable from local errors", () => {
    expect(errorMessage({ isAxiosError: true, message: "Network Error" }))
      .toBe("Server unreachable. Please check that the backend is started.");
  });
});
