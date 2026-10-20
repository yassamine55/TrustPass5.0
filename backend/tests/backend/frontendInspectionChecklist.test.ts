import { describe, expect, it } from "vitest";
import { initialChecklist } from "../../../frontend/src/pages/TechnicalInspections.jsx";
import { getInspectionChecklistForCategory, validateInspectionChecklist } from "../../src/domain/technicalInspection.js";

describe("technical inspection frontend checklist payload", () => {
  it("submits the item IDs returned by the backend template", () => {
    const template = getInspectionChecklistForCategory("Smartphone");
    const checklist = Object.values(initialChecklist(template));

    expect(checklist.map((item: any) => item.itemId)).toEqual(template.map((item: any) => item.id));
    expect(() => validateInspectionChecklist(checklist, "Smartphone")).not.toThrow();
  });

  it("continues to support legacy array-form checklist templates", () => {
    const checklist = Object.values(initialChecklist([
      ["screen", "Display", "Screen"]
    ]));

    expect(checklist).toMatchObject([
      { itemId: "screen", category: "Display", label: "Screen", status: "NOT_TESTED" }
    ]);
  });
});
