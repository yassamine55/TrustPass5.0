import { describe, expect, it, vi } from "vitest";

const User = require("../../src/models/User.js");
const authController = require("../../src/controllers/authController.js");

describe("delete account", () => {
  it("exposes a delete account controller for authenticated users", async () => {
    expect(authController.deleteMe).toBeTypeOf("function");

    User.findByIdAndDelete = vi.fn().mockResolvedValue({ _id: "user-1" });

    const req = { user: { _id: "user-1" } };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    await authController.deleteMe(req, res, next);

    expect(User.findByIdAndDelete).toHaveBeenCalledWith("user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: "Account deleted successfully" });
    expect(next).not.toHaveBeenCalled();
  });
});
