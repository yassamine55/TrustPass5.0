import { describe, expect, it } from "vitest";
import { getDevicePhotoUrl } from "../../frontend/src/lib/devicePhoto.js";

describe("frontend device photo URL handling", () => {
  it("returns a backend endpoint for a valid photo reference", () => {
    const product = { _id: "p-123", brand: "Apple", model: "MacBook Air", photo: "device-photos/file.jpg" };
    expect(getDevicePhotoUrl(product, "http://192.168.0.172:5000")).toBe("http://192.168.0.172:5000/api/public/devices/p-123/photo");
    expect(getDevicePhotoUrl(product)).toBe("/api/public/devices/p-123/photo");
  });

  it("ignores unsafe filesystem paths and returns no URL when there is no photo", () => {
    expect(getDevicePhotoUrl({ _id: "p-123", brand: "Apple", model: "MacBook Air", photo: "C:/Windows/System32/drivers/etc/hosts" }, "http://localhost:5000")).toBe(null);
    expect(getDevicePhotoUrl({ _id: "p-123", brand: "Apple", model: "MacBook Air" }, "http://localhost:5000")).toBe(null);
  });
});
