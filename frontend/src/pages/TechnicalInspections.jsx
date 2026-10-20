import { useEffect, useRef, useState } from "react";
import { ClipboardCheck, FileCheck2 } from "lucide-react";
import { get, post } from "../lib/api";
import { Link } from "react-router-dom";
import { Btn, Empty, Field, Modal, Notice, PageHeader, Spinner, useAction, useAsync } from "../components/ui";

const STATUSES = ["PASS", "WARNING", "FAIL", "NOT_TESTED"];
const DIAGNOSIS_REASONS = [
  "Severe physical damage",
  "Critical motherboard/component failure",
  "Repair cost not economically reasonable",
  "Parts unavailable",
  "Other"
];

export function initialChecklist(items) {
  return Object.fromEntries((items || []).map((item) => {
    const entry = Array.isArray(item) ? { id: item[0], category: item[1], label: item[2] } : item;
    const itemId = entry.itemId || entry.id;
    return [itemId, { itemId, category: entry.category, label: entry.label, status: "NOT_TESTED", notes: "", evidenceReferences: [] }];
  }).filter(([itemId]) => itemId));
}

export default function TechnicalInspections() {
  const { data, loading, error, reload } = useAsync(() => get("/technical-inspections/available"));
  const [selected, setSelected] = useState(null);
  const [go, busy] = useAction();
  const [accept, accepting] = useAction();
  const inspection = selected || data?.[0];
  const { data: detail, loading: detailLoading, reload: reloadDetail } = useAsync(() => inspection ? get(`/technical-inspections/${inspection._id}`) : Promise.resolve(null), [inspection?._id]);
  const [form, setForm] = useState({ summary: "", decision: "REPAIRABLE", reason: "", evidence: "" });
  const [checklist, setChecklist] = useState({});
  const [evidenceFile, setEvidenceFile] = useState(null);
  const [confirmEndOfLife, setConfirmEndOfLife] = useState(false);
  const [completed, setCompleted] = useState(null);
  const evidenceInput = useRef(null);

  const template = detail?.checklistTemplate || [];
  useEffect(() => {
    if (detail?.checklistTemplate?.length) {
      const previousInspection = detail.product?.technicalInspection;
      const previousChecklist = new Map((previousInspection?.checklist || []).map((item) => [item.itemId, item]));
      const initial = initialChecklist(detail.checklistTemplate);
      for (const [itemId, item] of Object.entries(initial)) {
        const saved = previousChecklist.get(itemId);
        if (saved) initial[itemId] = { ...item, status: saved.status, notes: saved.notes || "", evidenceReferences: saved.evidenceReferences || [] };
      }
      setChecklist(initial);
      setForm({ summary: "", decision: "REPAIRABLE", reason: "", evidence: "" });
      if (previousInspection?.reviewStatus === "ADDITIONAL_EVIDENCE_REQUIRED") {
        setForm((current) => ({
          ...current,
          summary: previousInspection.report?.summary || current.summary,
          decision: previousInspection.diagnosis?.decision || current.decision,
          reason: previousInspection.diagnosis?.reason || current.reason,
          evidence: (previousInspection.report?.evidenceDocuments || []).map(String).join(", ")
        }));
      }
    }
  }, [detail?.product?._id]);

  if (loading) return <Spinner />;
  if (error) return <Notice tone="fail">{error}</Notice>;
  const product = detail?.product;

  const update = (id, key, value) => setChecklist((current) => ({ ...current, [id]: { ...current[id], [key]: value } }));
  const acceptRequest = async () => {
    const result = await accept(() => post(`/technical-inspections/${product._id}/accept`), "Inspection accepted");
    if (result) { setSelected(result.product); await reloadDetail(); }
  };
  const submitDiagnosis = async () => {
    const result = await go(async () => {
      const evidenceDocuments = form.evidence.split(",").map((value) => value.trim()).filter(Boolean);
      let evidenceHash;
      if (evidenceFile) {
        const body = new FormData();
        body.append("file", evidenceFile);
        body.append("category", "OTHER_SUPPORTING_DOCUMENT");
        body.append("product", product._id);
        body.append("claimType", "TECHNICAL_INSPECTION");
        const uploaded = await post("/documents", body);
        evidenceDocuments.push(uploaded.document._id);
        evidenceHash = uploaded.document.sha256;
      }
      return post(`/technical-inspections/${product._id}/complete`, {
        checklist: Object.values(checklist),
        summary: form.summary,
        decision: form.decision,
        reason: form.reason,
        evidenceDocuments,
        evidenceHash: evidenceHash || product.technicalInspection?.report?.evidenceHash
      });
    }, "Signed inspection report submitted for admin review");
    if (result) {
      setConfirmEndOfLife(false);
      setCompleted(result.product);
      setChecklist({});
      setSelected(null);
      reload();
    }
  };
  const submit = (event) => {
    event.preventDefault();
    if (form.decision === "NOT_REPAIRABLE") setConfirmEndOfLife(true);
    else submitDiagnosis();
  };

  return <div>
    <PageHeader title="Technical inspections" lead="Physically inspect the device and complete every checklist item. Your verified TrustPass account attests the report, which is then sent to an admin for review." />
    {completed && <Notice tone="info" className="mb-5">The report was submitted to an admin for review and is attested to your verified TrustPass account. The device remains <strong>{completed.status}</strong> until the admin approves any lifecycle change. <Link className="link font-semibold" to={`/passport/${completed.passportId}`}>View the device history</Link></Notice>}
    {!data?.length && !product ? <Empty title="No inspection requests">Owner-requested inspections will appear here.</Empty> : <div className="grid gap-6 lg:grid-cols-[18rem_1fr] items-start">
      <ul className="panel divide-y divide-line-2">{data.map((item) => <li key={item._id}><button className={`w-full text-left p-4 hover:bg-ink/5 ${inspection?._id === item._id ? "bg-petrol-tint/50" : ""}`} onClick={() => { setSelected(item); setChecklist({}); }}><p className="font-semibold">{item.brand} {item.model}</p><p className="text-sm text-ink-2">{item.passportId} · {item.category}</p></button></li>)}</ul>
      {detailLoading || !product ? <Spinner /> : <form onSubmit={submit} className="panel p-5 sm:p-7 space-y-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-ink-2">{product.passportId} · Owner request</p><h2 className="text-2xl font-bold mt-1">{product.brand} {product.model}</h2></div>{product.technicalInspection?.status === "REQUESTED" && <Btn type="button" onClick={acceptRequest} busy={accepting}>{product.technicalInspection.reviewStatus === "ADDITIONAL_EVIDENCE_REQUIRED" ? "Continue report" : "Accept inspection"}</Btn>}</div>
        {product.technicalInspection?.reviewStatus === "ADDITIONAL_EVIDENCE_REQUIRED" && <Notice tone="warn"><strong>Admin requested additional evidence.</strong> {product.technicalInspection.reviewNote}</Notice>}
        <div className="space-y-4">{[...new Set(template.map((item) => item.category))].map((category) => <section key={category}><h3 className="font-semibold mb-2">{category}</h3><div className="space-y-2">{template.filter((item) => item.category === category).map((item) => <div key={item.id} className="border border-line-2 rounded-lg p-3"><div className="grid sm:grid-cols-[1fr_10rem] gap-2 items-center"><span className="font-medium">{item.label}</span><select className="input" value={checklist[item.id]?.status || "NOT_TESTED"} onChange={(e) => update(item.id, "status", e.target.value)}>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></div><input className="input mt-2" placeholder="Notes (optional)" value={checklist[item.id]?.notes || ""} onChange={(e) => update(item.id, "notes", e.target.value)} /></div>)}</div></section>)}</div>
        <section className="border-t border-line-2 pt-5" aria-labelledby="diagnosis-title"><h3 id="diagnosis-title" className="text-xl font-semibold">Diagnosis</h3><div className="mt-3 space-y-2"><label className="flex items-center gap-3 rounded-lg border border-line-2 p-3"><input type="radio" name="decision" value="REPAIRABLE" checked={form.decision === "REPAIRABLE"} onChange={(e) => setForm({ ...form, decision: e.target.value, reason: "" })} />Repairable</label><label className="flex items-center gap-3 rounded-lg border border-line-2 p-3"><input type="radio" name="decision" value="NOT_REPAIRABLE" checked={form.decision === "NOT_REPAIRABLE"} onChange={(e) => setForm({ ...form, decision: e.target.value })} />Cannot reasonably be repaired</label></div></section>
        {form.decision === "NOT_REPAIRABLE" && <><Field label="Reason"><select className="input" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })}><option value="">Select a reason</option>{DIAGNOSIS_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></Field></>}
        <Field label="Additional notes"><textarea className="input" required minLength={3} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Describe the observed condition and any limitations." /></Field>
        <div><p className="text-sm font-semibold mb-1.5">Supporting evidence, photos, or report (optional)</p><input ref={evidenceInput} type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setEvidenceFile(e.target.files?.[0] || null)} /><Btn type="button" variant="secondary" onClick={() => evidenceInput.current?.click()}><FileCheck2 size={17} />{evidenceFile ? "Change evidence" : "Add evidence"}</Btn>{evidenceFile && <p className="mt-2 text-sm text-ink-2">{evidenceFile.name}</p>}<Field label="Existing evidence document IDs (optional)" hint="Comma-separated TrustPass document IDs already attached to this device."><input className="input mono" value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })} /></Field></div>
        <Notice tone="info">Submitting this report records your verified TrustPass account as the attesting repairer. No Hedera account ID or wallet signature is required. An admin must review the report before any lifecycle change.</Notice>
        <Notice tone="info">Technical verification means a qualified repairer inspected this device and an admin approved the report. It does not mean the device has no defects.</Notice>
        <Btn type="submit" busy={busy} disabled={product.technicalInspection?.status === "REQUESTED"}><ClipboardCheck size={17} />{form.decision === "NOT_REPAIRABLE" ? "Continue" : "Submit diagnosis"}</Btn>
      </form>}
    </div>}
    <Modal open={confirmEndOfLife} onClose={() => setConfirmEndOfLife(false)} title="Mark device as end of life?">
      <p className="text-ink-2">After this decision, the device can only be listed for parts.</p>
      <div className="mt-6 flex justify-end gap-3"><Btn type="button" variant="secondary" onClick={() => setConfirmEndOfLife(false)}>Cancel</Btn><Btn type="button" variant="danger" busy={busy} onClick={submitDiagnosis}>Mark as end of life</Btn></div>
    </Modal>
  </div>;
}