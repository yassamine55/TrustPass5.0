const fs = require("fs");
const crypto = require("crypto");
const Document = require("../models/Document");
const Product = require("../models/Product");
const Repair = require("../models/Repair");
const LifecycleEvent = require("../models/LifecycleEvent");
const User = require("../models/User");
const { DOCUMENT_ANALYSIS_OUTCOMES } = require("../domain/evidence");
const informationDiscrepancyService = require("./informationDiscrepancyService");

const ARABIC_CHARSET = /[\u0600-\u06FF]/;

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/[^a-z0-9]/g, "") : null;
}

function sanitizeFieldValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /^(n\/a|na|unknown|none|not available|not provided)$/i.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function extractFirst(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = sanitizeFieldValue(match[1]);
      if (value) return value;
    }
  }
  return null;
}

function extractFields(text) {
  if (!text || !text.trim()) return {};
  const source = text.replace(/\r/g, " ").replace(/\n+/g, " ");
  return {
    companyOrRepairerName: extractFirst(source, [/(?:company|repairer|shop|seller|atelier|magasin)\s*[:#-]\s*([^,;]+)/i]),
    documentDate: extractFirst(source, [/(?:date|issued|invoice date|date de facture|datefacture)\s*[:#-]\s*([0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})/i]),
    manufacturer: extractFirst(source, [/(?:manufacturer|brand|marque|fabricant)\s*[:#-]\s*([^,;]+)/i]),
    model: extractFirst(source, [/(?:model|mod[eè]le)\s*[:#-]\s*([^,;\n]+?)(?=\s*(?:prix|price|amount|total|date|facture|reference|ref|atelier|entreprise|client|acheteur|serial|imei|montant|garantie|date de|$))/i]),
    imei: extractFirst(source, [/(?:imei)\s*[:#-]?\s*([0-9]{14,16})/i]),
    serialNumber: extractFirst(source, [/(?:serial|serial number|s\/n|num[eé]ro de s[eé]rie|n\.?s\.?\s*)\s*[:#-]\s*([a-z0-9-]+)/i]),
    repairType: extractFirst(source, [/(?:repair|repair type|work performed|r[eé]paration|travaux de r[eé]paration|type de r[eé]paration)\s*[:#-]\s*([^,;]+)/i]),
    replacementPart: extractFirst(source, [/(?:part|replacement part|changed part|pi[eé]ce|pi[eé]ces de remplacement)\s*[:#-]\s*([^,;]+)/i]),
    amount: extractFirst(source, [/(?:total|amount|price|montant|prix)\s*[:#-]\s*([0-9]+(?:[.,][0-9]{2})?)/i]),
    invoiceReference: extractFirst(source, [/(?:invoice|reference|ref(?:erence)? no|facture|r[eé]f(?:e)?r[eé]nce)\s*[:#-]\s*([a-z0-9-]+)/i]),
    warrantyStart: extractFirst(source, [/(?:warranty start|valid from|date de d[eé]but de garantie|validit[eé] du)\s*[:#-]\s*([0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})/i]),
    warrantyEnd: extractFirst(source, [/(?:warranty end|valid until|expires|date de fin de garantie|expiration)\s*[:#-]\s*([0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2})/i]),
    buyerName: extractFirst(source, [/(?:buyer|customer|sold to|acheteur|client)\s*[:#-]\s*([^,;]+)/i])
  };
}

function hasArabicText(value) {
  return Boolean(value && ARABIC_CHARSET.test(value));
}

function classifyDocumentOutcome({
  text,
  extracted = {},
  duplicate = false,
  comparisons = [],
  findings = [],
  confidence = 0,
  hashMismatch = false,
  languageSupport = "eng+fra",
}) {
  if (hashMismatch) return DOCUMENT_ANALYSIS_OUTCOMES.HASH_MISMATCH;
  if (duplicate) return DOCUMENT_ANALYSIS_OUTCOMES.DUPLICATE;
  if (!text || !String(text).trim()) return DOCUMENT_ANALYSIS_OUTCOMES.OCR_FAILED;
  if (languageSupport === "unsupported-arabic" || hasArabicText(String(text))) {
    return DOCUMENT_ANALYSIS_OUTCOMES.MANUAL_REVIEW_REQUIRED;
  }

  const mismatchFound = comparisons.some((item) => item.result === "MISMATCH");
  const missingFound = comparisons.some((item) => item.result === "MISSING");

  if (mismatchFound) {
    return Number(confidence) >= 0.7 ? DOCUMENT_ANALYSIS_OUTCOMES.CONFIRMED_CONTRADICTION : DOCUMENT_ANALYSIS_OUTCOMES.MANUAL_REVIEW_REQUIRED;
  }

  if (Number(confidence) < 0.35) return DOCUMENT_ANALYSIS_OUTCOMES.LOW_CONFIDENCE;
  if (missingFound || (Object.keys(extracted || {}).length === 0 && String(text).trim().length > 0)) {
    return DOCUMENT_ANALYSIS_OUTCOMES.MANUAL_REVIEW_REQUIRED;
  }
  if (findings.some((finding) => /manual review|not enough|cannot read|unreadable|insufficient/i.test(finding))) {
    return DOCUMENT_ANALYSIS_OUTCOMES.MANUAL_REVIEW_REQUIRED;
  }
  return DOCUMENT_ANALYSIS_OUTCOMES.CONSISTENT;
}

async function extractText(document) {
  if (!document.path || !fs.existsSync(document.path)) return null;
  if (document.mimeType === "text/plain") return fs.readFileSync(document.path, "utf8");
  if (document.mimeType === "application/pdf") {
    try {
      const pdfParse = require("pdf-parse");
      const buffer = fs.readFileSync(document.path);
      const result = pdfParse.PDFParse
        ? await new pdfParse.PDFParse({ data: buffer }).getText()
        : await pdfParse(buffer);
      return result.text || null;
    } catch {
      return null;
    }
  }
  if (["image/jpeg", "image/png", "image/webp"].includes(document.mimeType)) {
    try {
      const tesseract = require("tesseract.js");
      for (const language of ["eng+fra", "fra", "eng"]) {
        try {
          const result = await tesseract.recognize(document.path, language);
          if (result?.data?.text && result.data.text.trim()) return result.data.text;
        } catch {
          // continue through the supported language fallbacks
        }
      }
      return null;
    } catch {
      return null;
    }
  }
  return null;
}

function compareField(comparisons, field, expected, actual, label) {
  if (!expected && !actual) return;
  if (!actual) return comparisons.push({ field, result: "MISSING", note: `${label} was not found in the document` });
  if (!expected) return comparisons.push({ field, result: "UNAVAILABLE", note: `TrustPass has no ${label.toLowerCase()} to compare` });
  comparisons.push({ field, result: normalize(expected) === normalize(actual) ? "MATCH" : "MISMATCH", note: label });
}

async function analyzeDocument(documentId) {
  const document = await Document.findById(documentId);
  if (!document) throw new Error("Document not found");
  document.analysisStatus = "ANALYSIS_PENDING";
  await document.save();

  try {
    const text = await extractText(document);
    const extracted = text ? extractFields(text) : {};
    const comparisons = [];
    const findings = [];

    const currentHash = fs.existsSync(document.path) ? crypto.createHash("sha256").update(fs.readFileSync(document.path)).digest("hex") : null;
    const hashMismatch = Boolean(currentHash && currentHash !== document.sha256);
    if (hashMismatch) findings.push("Stored document hash does not match the current file contents");

    const duplicate = await Document.findOne({ sha256: document.sha256, _id: { $ne: document._id } }).select("_id");
    if (duplicate) findings.push("A document with the same SHA-256 hash already exists");

    const product = document.product ? await Product.findById(document.product).select("brand model serialNumberHash imeiHash manufactureDate") : null;
    const repair = document.repair ? await Repair.findById(document.repair).select("product description changedParts price date lifecycleEvent") : null;
    if (product) {
      compareField(comparisons, "manufacturer", product.brand, extracted.manufacturer, "Manufacturer");
      compareField(comparisons, "model", product.model, extracted.model, "Model");
      if (extracted.serialNumber) {
        const serialHash = crypto.createHash("sha256").update(extracted.serialNumber.replace(/\s/g, "").toUpperCase()).digest("hex");
        comparisons.push({ field: "serialNumber", result: serialHash === product.serialNumberHash ? "MATCH" : "MISMATCH", note: "Serial number fingerprint" });
      }
      if (extracted.imei && product.imeiHash) {
        const imeiHash = crypto.createHash("sha256").update(extracted.imei.replace(/\s/g, "")).digest("hex");
        comparisons.push({ field: "imei", result: imeiHash === product.imeiHash ? "MATCH" : "MISMATCH", note: "IMEI fingerprint" });
      } else if (extracted.imei) {
        comparisons.push({ field: "imei", result: "UNAVAILABLE", note: "Document contains an IMEI but the passport has no IMEI fingerprint" });
      }
    }
    if (repair) {
      compareField(comparisons, "repairType", repair.description, extracted.repairType, "Repair description");
      compareField(comparisons, "replacementPart", repair.changedParts?.join(", "), extracted.replacementPart, "Replacement part");
      if (extracted.amount && repair.price != null) compareField(comparisons, "amount", String(repair.price), extracted.amount, "Repair amount");
      if (repair.date && new Date(repair.date) > new Date()) findings.push("Repair date is in the future");
      const firstEvent = await LifecycleEvent.findOne({ product: repair.product }).sort({ createdAt: 1 }).select("createdAt");
      if (firstEvent && repair.date && new Date(repair.date) < new Date(firstEvent.createdAt)) findings.push("Repair date predates the device passport history");
    }

    const languageSupport = hasArabicText(text || "") ? "unsupported-arabic" : "eng+fra";
    const outcome = classifyDocumentOutcome({
      text,
      extracted,
      duplicate: Boolean(duplicate),
      comparisons,
      findings,
      confidence: text ? 0.72 : 0,
      hashMismatch,
      languageSupport,
    });

    document.analysisStatus = outcome === DOCUMENT_ANALYSIS_OUTCOMES.CONSISTENT ? "ANALYZED" : "FLAGGED";
    document.analysisNote = outcome === DOCUMENT_ANALYSIS_OUTCOMES.CONFIRMED_CONTRADICTION
      ? "A hard contradiction was detected between the document and the known device state."
      : outcome === DOCUMENT_ANALYSIS_OUTCOMES.HASH_MISMATCH
        ? "The document hash does not match the stored record."
        : outcome === DOCUMENT_ANALYSIS_OUTCOMES.OCR_FAILED || outcome === DOCUMENT_ANALYSIS_OUTCOMES.LOW_CONFIDENCE
          ? "OCR could not confirm the document reliably."
          : outcome === DOCUMENT_ANALYSIS_OUTCOMES.MANUAL_REVIEW_REQUIRED
            ? "Manual review is required before any contradiction is treated as authoritative."
            : "Advisory analysis only. This does not verify the claim.";

    document.advisoryAnalysis = {
      outcome,
      extracted,
      comparisons,
      findings,
      confidence: text ? 0.72 : 0,
      provider: "local-advisory",
      modelVersion: "eng+fra-v1",
      sourceHash: document.sha256,
      analyzedAt: new Date()
    };
    await document.save();
    const shouldAnchorDiscrepancy = [
      DOCUMENT_ANALYSIS_OUTCOMES.CONFIRMED_CONTRADICTION,
      DOCUMENT_ANALYSIS_OUTCOMES.DUPLICATE,
      DOCUMENT_ANALYSIS_OUTCOMES.HASH_MISMATCH
    ].includes(outcome);

    if (shouldAnchorDiscrepancy) {
      const actor = await User.findOne({ role: "ADMIN", firstName: "System" }) || await User.findOne({ role: "ADMIN" });
      const relatedEvent = document.event || repair?.lifecycleEvent || (document.product
        ? await LifecycleEvent.findOne({ product: document.product }).sort({ createdAt: -1 }).select("_id")
        : null);
      const mismatchDetails = comparisons.filter((item) => item.result === "MISMATCH").map((item) => `${item.field}: MISMATCH`).join("; ");
      const details = [
        `Document: ${document.originalName}`,
        `Analysis: ${outcome.replaceAll("_", " ")}`,
        mismatchDetails,
        ...findings
      ].filter(Boolean).join("\n");
      await informationDiscrepancyService.createInformationDiscrepancy({
        product,
        actor,
        description: details,
        relatedEvent: relatedEvent?._id || relatedEvent,
        sourceRef: `DISCREPANCY:${document._id}:${outcome}`
      });
    }
    return document;
  } catch (error) {
    document.analysisStatus = "FLAGGED";
    document.analysisNote = "Analysis failed and requires manual review.";
    document.advisoryAnalysis = { outcome: DOCUMENT_ANALYSIS_OUTCOMES.MANUAL_REVIEW_REQUIRED, findings: ["Analysis could not be completed"], sourceHash: document.sha256, analyzedAt: new Date() };
    await document.save();
    return document;
  }
}

module.exports = { analyzeDocument, extractFields, classifyDocumentOutcome };