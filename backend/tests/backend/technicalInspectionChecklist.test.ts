import { describe, expect, it } from "vitest";
import { getInspectionChecklistForCategory, validateInspectionChecklist } from "../../src/domain/technicalInspection.js";

describe("technical inspection checklist categories", () => {
  it("keeps phone-specific checks only for smartphones", () => {
    const smartphone = getInspectionChecklistForCategory("Smartphone");
    const television = getInspectionChecklistForCategory("Television");

    expect(smartphone.some((item) => item.id === "imei")).toBe(true);
    expect(smartphone.some((item) => item.id === "biometrics")).toBe(true);
    expect(television.some((item) => item.id === "imei")).toBe(false);
    expect(television.some((item) => item.id === "biometrics")).toBe(false);
  });

  it("supports TV and appliance checks without storing irrelevant phone fields", () => {
    const television = getInspectionChecklistForCategory("Television");
    const appliance = getInspectionChecklistForCategory("Appliance");

    expect(television.some((item) => item.id === "screen")).toBe(true);
    expect(television.some((item) => item.id === "remoteControl")).toBe(true);
    expect(television.some((item) => item.id === "bodyCondition")).toBe(true);

    expect(appliance.some((item) => item.id === "powerSupply")).toBe(true);
    expect(appliance.some((item) => item.id === "motor" || item.id === "compressor")).toBe(true);
    expect(appliance.some((item) => item.id === "imei")).toBe(false);
  });

  it("validates the checklist against the chosen category and rejects mismatched fields", () => {
    const phoneChecklist = getInspectionChecklistForCategory("Smartphone").map((item) => ({
      itemId: item.id,
      category: item.category,
      label: item.label,
      status: "PASS",
      notes: "",
      evidenceReferences: []
    }));

    expect(() => validateInspectionChecklist(phoneChecklist, "Smartphone")).not.toThrow();
    expect(() => validateInspectionChecklist(phoneChecklist, "Television")).toThrow();
  });
});
