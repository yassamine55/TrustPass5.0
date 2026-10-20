import { describe, expect, it } from "vitest";
import { purchasePriceLabel } from "../../../frontend/src/pages/Transfers.jsx";

describe("purchase price display", () => {
  it("shows the agreed transfer price after the product listing price is cleared", () => {
    expect(purchasePriceLabel({
      price: 900,
      product: { listingPrice: null }
    })).toBe("900 TND");
  });

  it("falls back to the current product listing price for older transfers", () => {
    expect(purchasePriceLabel({
      product: { listingPrice: 900 }
    })).toBe("900 TND");
  });

  it("shows that no price was listed when neither source has a price", () => {
    expect(purchasePriceLabel({
      price: null,
      product: { listingPrice: null }
    })).toBe("Price not listed");
  });
});
