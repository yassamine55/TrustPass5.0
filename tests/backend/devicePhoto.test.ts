import { describe, expect, it } from "vitest";
import { isAllowedPublicPhotoRef, normalizeDevicePhotoRef, resolvePublicDevicePhotoPath } from "../../src/utils/devicePhoto.js";

describe("device photo storage and path validation", () => {
  it("normalizes uploaded photo references to a safe server-side path", () => {
    expect(normalizeDevicePhotoRef("/uploads/1720000000000-apple.jpg")).toBe("device-photos/1720000000000-apple.jpg");
    expect(normalizeDevicePhotoRef("/devicePhoto/1720000000000-apple.jpg")).toBe("device-photos/1720000000000-apple.jpg");
    expect(normalizeDevicePhotoRef("device-photos/1720000000000-apple.jpg")).toBe("device-photos/1720000000000-apple.jpg");
    expect(normalizeDevicePhotoRef("../private/invoice.pdf")).toBe(null);
  });

  it("allows only safe photo references and blocks traversal", () => {
    expect(isAllowedPublicPhotoRef("device-photos/abc.png")).toBe(true);
    expect(isAllowedPublicPhotoRef("../device-photos/abc.png")).toBe(false);
    expect(isAllowedPublicPhotoRef("device-photos/../../etc/passwd")).toBe(false);
    expect(isAllowedPublicPhotoRef("documents/invoice.pdf")).toBe(false);
  });

  it("resolves a public device photo path safely inside the photo directory", () => {
    const resolved = resolvePublicDevicePhotoPath("device-photos/test-photo.png");
    expect(resolved.endsWith("device-photos\\test-photo.png")).toBe(true);
    expect(() => resolvePublicDevicePhotoPath("../../../../Windows/System32/drivers/etc/hosts")).toThrow();
  });
});
