import { CheckCircle2, CircleDashed } from "lucide-react";
import { EVENTS } from "../lib/labels";
import { displayName, fmtDate, fmtDateTime, fmtPrice, shortHash } from "../lib/format";
import { Badge, CopyButton } from "./ui";

// Backend-generated descriptions are in English and may contain technical identifiers.
function describe(e, me) {
  const d = e.description || "";
  if (/^Product passport created/i.test(d)) return "Passport created";
  if (/^Ownership transferred:/i.test(d)) return d;
  if (/^Ownership transferred/i.test(d)) return e.type === "SOLD_FOR_PARTS" ? "Device sold for parts" : "Ownership transferred to the new buyer";
  if (/^Product recycled/i.test(d)) return "Device recycled";
  return d;
}

function institutionVerificationLabel(event) {
  const source = event.provenance?.verificationSource || event.verificationSource || (event.provenance?.externalSystemConnected ? "EXTERNAL_VERIFICATION" : "DEMO_TEST");
  if (source === "EXTERNAL_VERIFICATION") return "EXTERNAL VERIFICATION";
  return "DEMO VERIFICATION";
}

function provenanceLabel(event) {
  if (event.type === "REPAIR_OWNER_CONFIRMED") return "Owner confirmed";
  if (event.type === "REPAIR_OWNER_DISPUTED" || event.type === "REPAIR_OWNER_REJECTED") return "Owner disputed";
  if (event.type === "INSTITUTION_VERIFIED") return institutionVerificationLabel(event);
  return {
    OWNER_REPORTED: "Owner reported",
    EVIDENCE_PROVIDED: "Evidence provided",
    REPAIRER_VERIFIED: "Repairer verified",
    INSTITUTION_VERIFIED: institutionVerificationLabel(event)
  }[event.provenance?.verificationLevel] || "Owner reported";
}

function eventTitle(event, fallbackLabel) {
  if (event.type === "INSTITUTION_VERIFIED") {
    return institutionVerificationLabel(event);
  }
  return fallbackLabel;
}

function trustStatusLabel(event) {
  if (event.provenance?.verificationStatus === "BLOCKCHAIN_RECORDED") return provenanceLabel(event);
  return {
    OWNER_DECLARED: "Owner declared",
    EVIDENCE_SUBMITTED: "Evidence submitted",
    PROFESSIONALLY_ATTESTED: "Professionally attested",
    TECHNICALLY_VERIFIED: "Technically verified"
  }[event.provenance?.verificationStatus] || provenanceLabel(event);
}

function analysisLabel(document) {
  return {
    CONSISTENT: "AI analysis: consistent signals",
    CONFIRMED_CONTRADICTION: "AI analysis: contradiction detected",
    OCR_FAILED: "AI analysis: could not verify document",
    LOW_CONFIDENCE: "AI analysis: could not verify document",
    MANUAL_REVIEW_REQUIRED: "AI analysis: manual review required",
    DUPLICATE: "AI analysis: duplicate document",
    HASH_MISMATCH: "AI analysis: hash mismatch",
    INCONSISTENT: "AI analysis: inconsistent signals",
    MISSING_INFORMATION: "AI analysis: missing information",
    MANUAL_REVIEW: "AI analysis: manual review needed",
    DUPLICATE_DOCUMENT: "AI analysis: duplicate document",
    DOCUMENT_DEVICE_MISMATCH: "AI analysis: contradiction detected",
    HISTORY_INCONSISTENCY: "AI analysis: history inconsistency",
    SUSPICIOUS_PATTERN: "AI analysis: suspicious pattern"
  }[document?.advisoryAnalysis?.outcome];
}

function sourceLabel(event, repair) {
  if (event.provenance?.source?.type === "INSTITUTION") return "Institution source";
  if (event.provenance?.source?.type === "REPAIRER") return "Repairer source";
  if (event.provenance?.verificationStatus === "EVIDENCE_SUBMITTED" || repair?.evidenceHash) return "Owner source with evidence";
  return "Owner source";
}

function hasEvidence(event, repair) {
  return Boolean(event.provenance?.evidence?.available || event.document || event.hash || repair?.evidenceDocument || repair?.evidenceHash || repair?.invoiceHash);
}

export default function Timeline({ events, repairs = [], me }) {
  const visibleEvents = events.filter((event) => !(
    event.type === "EVENT_DISPUTED" &&
    /^INFORMATION DISCREPANCY\b/i.test(event.description || "")
  ));
  if (!visibleEvents.length) return <p className="text-ink-2">No events recorded.</p>;
  return (
    <ol className="relative">
      {visibleEvents.map((e, i) => {
        const meta = EVENTS[e.type] || { label: e.type, band: "#8a949c" };
        const repair = repairs.find((r) => r.repairId && r.repairId === e.sourceRef);
        const last = i === visibleEvents.length - 1;
        const visibleLabel = eventTitle(e, meta.label);
        const description = describe(e, me);
        return (
          <li key={e._id || e.eventId} className="grid grid-cols-[1.75rem_1fr] gap-x-4">
            <div className="flex flex-col items-center">
              <span className="mt-1.5 block w-2.5 h-7 rounded-[3px] border border-ink/25" style={{ background: meta.band }} aria-hidden />
              {!last && <span className="flex-1 w-px bg-line my-1" aria-hidden />}
            </div>
            <div className={`min-w-0 ${last ? "" : "pb-7"}`}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-[1.12rem] font-semibold">{visibleLabel}</h3>
                <time className="text-sm text-ink-2" dateTime={e.createdAt}>{fmtDateTime(e.createdAt)}</time>
              </div>
              <p className="text-[0.9rem] text-ink-2 mt-0.5 flex flex-wrap items-center gap-2"><span>{displayName(e.actor, me)}</span><span>Source role: {e.provenance?.source?.role || e.actor?.role || "Unknown"}</span></p>
              {description && <p className="mt-2 text-[0.95rem] max-w-prose">{description}</p>}
              {e.type === "END_OF_LIFE" ? <EndOfLifeDetails event={e} me={me} /> : <>
                <p className="mt-2 text-[0.85rem] text-ink-2">{sourceLabel(e, repair)} · {e.provenance?.source?.role || e.actor?.role || "Unknown source role"}</p>
                {repair && (
                  <div className="mt-2.5 rounded-lg bg-white border border-line-2 px-3.5 py-2.5 text-[0.9rem] max-w-prose">
                    {repair.evidenceDocument?.originalName && <p><span className="text-ink-2">Evidence: </span>{repair.evidenceDocument.originalName} · {repair.evidenceDocument.category}</p>}
                    {analysisLabel(repair.evidenceDocument) && <p className="text-ink-2">{analysisLabel(repair.evidenceDocument)}. Advisory only; this is not professional verification.</p>}
                    {repair.changedParts?.length > 0 && <p><span className="text-ink-2">Replacement parts: </span>{repair.changedParts.join(", ")}</p>}
                    {repair.price != null && <p><span className="text-ink-2">Amount: </span>{fmtPrice(repair.price)}</p>}
                    {repair.signatureValid != null && <p><span className="text-ink-2">Repairer signature: </span>{repair.signatureValid ? "valid" : "invalid"}</p>}
                  </div>
                )}
                {e.hash && (
                  <p className="mt-2 text-[0.85rem] text-ink-2 flex items-center gap-1 flex-wrap">
                    Evidence fingerprint <span className="mono text-ink" title={e.hash}>{shortHash(e.hash)}</span><CopyButton text={e.hash} label="Copy fingerprint" />
                  </p>
                )}
                {e.document?.originalName && <p className="mt-2 text-[0.85rem] text-ink-2">Evidence: {e.document.originalName} · {e.document.category}</p>}
                {analysisLabel(e.document) && <p className="mt-1 text-[0.85rem] text-ink-2">{analysisLabel(e.document)}. Advisory only; this is not professional verification.</p>}
                <EventBadges event={e} repair={repair} me={me} />
              </>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function EventBadges({ event, repair, me }) {
  const isOwner = me?.role === "OWNER";
  return <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.85rem]">
    <Badge tone={event.provenance?.verificationStatus === "OWNER_DECLARED" ? "warn" : "ok"} icon={event.provenance?.verificationStatus === "OWNER_DECLARED" ? CircleDashed : CheckCircle2}>{trustStatusLabel(event)}</Badge>
    {hasEvidence(event, repair) ? <Badge tone="ok" icon={CheckCircle2}>Evidence available</Badge> : !isOwner && <span className="text-ink-2">No supporting evidence</span>}
  </div>;
}

function EndOfLifeDetails({ event, me }) {
  const isOwner = me?.role === "OWNER";
  const repairer = event.actor ? `${event.actor.firstName || ""} ${event.actor.lastName || ""}`.trim() : "Unknown repairer";
  const request = event.relatedEvent;
  const signature = event.provenance?.signature?.status;
  return <div className="mt-3 rounded-lg border border-gilt/70 bg-gilt-tint/35 px-4 py-4 max-w-prose">
    <h4 className="font-semibold">Device marked end of life</h4>
    <dl className="mt-3 grid gap-2 text-[0.92rem] sm:grid-cols-[auto_1fr] sm:gap-x-4">
      <dt className="text-ink-2">Date</dt><dd>{fmtDate(event.createdAt)}</dd>
      <dt className="text-ink-2">Repairer</dt><dd>{repairer}</dd>
      <dt className="text-ink-2">Reason</dt><dd>{event.description || "Not provided"}</dd>
      <dt className="text-ink-2">Decision</dt><dd>No longer reasonably repairable</dd>
      <dt className="text-ink-2">Commercial status</dt><dd>Parts only</dd>
      <dt className="text-ink-2">Repair/diagnostic request</dt><dd>{request?.eventId || "Associated repair request recorded"}</dd>
      <dt className="text-ink-2">Verification</dt><dd>{trustStatusLabel(event)}{signature ? ` · Signature ${signature.toLowerCase()}` : ""}</dd>
      {event.document?.originalName && <><dt className="text-ink-2">Supporting evidence</dt><dd>{event.document.originalName}{event.document.category ? ` · ${event.document.category}` : ""}</dd></>}
      {event.hash && <><dt className="text-ink-2">Evidence fingerprint</dt><dd className="mono break-all">{shortHash(event.hash)}</dd></>}
    </dl>
    <EventBadges event={event} me={me} />
  </div>;
}
