import { describe, expect, it, vi, beforeEach } from "vitest";

const User = require("../../src/models/User.js");
const authController = require("../../src/controllers/authController.js");

describe("owner password change", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exposes a password change controller and allows a valid owner password update", async () => {
    expect(authController.updatePassword).toBeTypeOf("function");

    const userRecord = {
      role: "OWNER",
      password: "OldPass123",
      comparePassword: vi.fn().mockResolvedValue(true),
      save: vi.fn().mockImplementation(async function () {
        return this;
      })
    };

    User.findById = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue(userRecord)
    });

    const req = {
      user: { _id: "owner-1", role: "OWNER" },
      body: {
        currentPassword: "OldPass123",
        newPassword: "NewPass456"
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    const next = vi.fn();

    await authController.updatePassword(req, res, next);

    expect(User.findById).toHaveBeenCalledWith("owner-1");
    expect(userRecord.comparePassword).toHaveBeenCalledWith("OldPass123");
    expect(userRecord.password).toBe("NewPass456");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Password updated successfully" });
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an incorrect current password", async () => {
    const userRecord = {
      role: "OWNER",
      password: "OldPass123",
      comparePassword: vi.fn().mockResolvedValue(false),
      save: vi.fn()
    };

    User.findById = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue(userRecord)
    });

    const req = {
      user: { _id: "owner-1", role: "OWNER" },
      body: {
        currentPassword: "WrongPass",
        newPassword: "NewPass456"
      }
    };

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    const next = vi.fn();

    await authController.updatePassword(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Current password is incorrect" });
    expect(next).not.toHaveBeenCalled();
  });
});
