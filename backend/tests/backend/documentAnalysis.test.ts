import { describe, expect, it } from "vitest";
import { classifyDocumentOutcome, extractFields } from "../../src/services/documentAnalysis.js";
import { DOCUMENT_ANALYSIS_OUTCOMES } from "../../src/domain/evidence";

describe("document analysis classification", () => {
  it("accepts a valid French document as consistent", () => {
    const text = "Facture de réparation\nEntreprise: Atelier de Réparation\nModèle: iPhone 13\nPrix: 149,99 €\nDate: 2026-09-18";
    const extracted = extractFields(text);
    const outcome = classifyDocumentOutcome({
      text,
      extracted,
      duplicate: false,
      comparisons: [
        { field: "model", result: "MATCH" },
        { field: "amount", result: "MATCH" },
      ],
      findings: [],
      confidence: 0.88,
      languageSupport: "eng+fra",
    });

    expect(extracted.model).toBe("iphone 13");
    expect(outcome).toBe(DOCUMENT_ANALYSIS_OUTCOMES.CONSISTENT);
  });

  it("classifies OCR failure without creating a contradiction", () => {
    expect(classifyDocumentOutcome({
      text: null,
      extracted: {},
      duplicate: false,
      comparisons: [],
      findings: [],
      confidence: 0,
      languageSupport: "eng+fra",
    })).toBe(DOCUMENT_ANALYSIS_OUTCOMES.OCR_FAILED);
  });

  it("marks incomplete OCR as low confidence", () => {
    const text = "Facture\nEntreprise:\nModèle: iPhone";
    expect(classifyDocumentOutcome({
      text,
      extracted: extractFields(text),
      duplicate: false,
      comparisons: [],
      findings: [],
      confidence: 0.24,
      languageSupport: "eng+fra",
    })).toBe(DOCUMENT_ANALYSIS_OUTCOMES.LOW_CONFIDENCE);
  });

  it("requires a confirmed contradiction for an on-chain dispute", () => {
    expect(classifyDocumentOutcome({
      text: "Modèle: iPhone 14",
      extracted: extractFields("Modèle: iPhone 14"),
      duplicate: false,
      comparisons: [{ field: "model", result: "MISMATCH" }],
      findings: [],
      confidence: 0.8,
      languageSupport: "eng+fra",
    })).toBe(DOCUMENT_ANALYSIS_OUTCOMES.CONFIRMED_CONTRADICTION);
  });

  it("flags duplicates separately from contradictions", () => {
    expect(classifyDocumentOutcome({
      text: "Facture de réparation",
      extracted: extractFields("Facture de réparation"),
      duplicate: true,
      comparisons: [],
      findings: ["A document with the same SHA-256 hash already exists"],
      confidence: 0.72,
      languageSupport: "eng+fra",
    })).toBe(DOCUMENT_ANALYSIS_OUTCOMES.DUPLICATE);
  });

  it("flags a hash mismatch separately from OCR issues", () => {
    expect(classifyDocumentOutcome({
      text: "Facture de réparation",
      extracted: extractFields("Facture de réparation"),
      duplicate: false,
      comparisons: [{ field: "serialNumber", result: "MISMATCH" }],
      findings: [],
      confidence: 0.75,
      languageSupport: "eng+fra",
      hashMismatch: true,
    })).toBe(DOCUMENT_ANALYSIS_OUTCOMES.HASH_MISMATCH);
  });

  it("routes unsupported Arabic OCR to manual review", () => {
    expect(classifyDocumentOutcome({
      text: "فاتورة إصلاح",
      extracted: extractFields("فاتورة إصلاح"),
      duplicate: false,
      comparisons: [],
      findings: [],
      confidence: 0.15,
      languageSupport: "unsupported-arabic",
    })).toBe(DOCUMENT_ANALYSIS_OUTCOMES.MANUAL_REVIEW_REQUIRED);
  });
});
