import { useState } from "react";
import { Check, FileWarning, UserCheck, X } from "lucide-react";
import { get, patch, post } from "../../lib/api";
import { Badge, Btn, Empty, Field, Notice, PageHeader, Spinner, useAction, useAsync } from "../../components/ui";

export default function TechnicalInspections() {
  const { data, loading, error, reload } = useAsync(() => get("/admin/technical-inspections"));
  const { data: repairers, loading: repairersLoading, error: repairersError } = useAsync(() => get("/admin/repairers/verified"));
  const [note, setNote] = useState({});
  const [repairerId, setRepairerId] = useState({});
  const [go, busy] = useAction();
  const review = async (product, action) => {
    const result = await go(() => post(`/admin/technical-inspections/${product._id}/review`, { action, note: note[product._id] || "" }), action === "APPROVE" ? "Inspection approved" : action === "REJECT" ? "Inspection rejected" : "Additional evidence requested");
    if (result) reload();
  };
  const decideRequest = async (product, action) => {
    const result = await go(() => patch(`/admin/technical-inspections/${product._id}/request`, {
      action,
      repairerId: action === "ASSIGN" ? repairerId[product._id] : undefined,
      note: note[product._id] || ""
    }), action === "ASSIGN" ? "Inspection assigned" : "Inspection request rejected");
    if (result) reload();
  };
  return <div><PageHeader title="Inspection requests and reviews" lead="Owner requests are listed here. Review reports submitted by verified, assigned repairers." />
    {loading ? <Spinner /> : error ? <Notice tone="fail">{error}</Notice> : !data?.length ? <Empty title="No inspection requests or reports" /> : <ul className="space-y-5">{data.map((product) => {
      const inspection = product.technicalInspection;
      const evidenceRequested = inspection.status === "REQUESTED" && inspection.reviewStatus === "ADDITIONAL_EVIDENCE_REQUIRED";
      const pendingAssignment = inspection.status === "REQUESTED" && !inspection.assignedRepairer;
      const awaitingRepairer = inspection.status === "REQUESTED" && Boolean(inspection.assignedRepairer);
      const inProgress = inspection.status === "IN_PROGRESS";
      return <li key={product._id} className="panel p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">{product.brand} {product.model}</h2><p className="text-sm text-ink-2">{product.passportId} · owner {product.owner?.firstName} {product.owner?.lastName}</p><p className="text-sm text-ink-2">{inspection.requestedBy ? `Requested by ${inspection.requestedBy.firstName} ${inspection.requestedBy.lastName}` : ""} · {inspection.requestedAt ? new Date(inspection.requestedAt).toLocaleString() : ""}</p>{inspection.assignedRepairer && <p className="text-sm text-ink-2">Assigned to {inspection.assignedRepairer.firstName} {inspection.assignedRepairer.lastName}</p>}{inspection.performedBy && <p className="text-sm text-ink-2">Inspected by {inspection.performedBy.firstName} {inspection.performedBy.lastName}</p>}</div><Badge tone="warn">{pendingAssignment ? "ADMIN ASSIGNMENT REQUIRED" : awaitingRepairer ? "AWAITING REPAIRER" : inProgress ? "INSPECTION IN PROGRESS" : inspection.reviewStatus}</Badge></div>
        {pendingAssignment && <>
          {repairersError ? <Notice tone="fail" className="mt-4">{repairersError}</Notice> : repairersLoading ? <Spinner label="Loading verified repairers" /> : !repairers?.length ? <Notice tone="warn" className="mt-4">No active verified repairers are available. Verify a repairer account before assigning this request.</Notice> : <div className="mt-4 flex flex-wrap gap-2">
            <select className="input min-w-64 flex-1" aria-label={`Repairer for ${product.passportId}`} value={repairerId[product._id] || ""} onChange={(event) => setRepairerId({ ...repairerId, [product._id]: event.target.value })}>
              <option value="">Select a verified repairer</option>
              {repairers.map((repairer) => <option key={repairer._id} value={repairer._id}>{repairer.firstName} {repairer.lastName}{repairer.company?.name ? ` · ${repairer.company.name}` : ""}</option>)}
            </select>
            <Btn busy={busy} disabled={!repairerId[product._id]} onClick={() => decideRequest(product, "ASSIGN")}><UserCheck size={16} />Assign</Btn>
          </div>}
          <Field label="Reason for rejecting (required)"><textarea className="input mt-2" value={note[product._id] || ""} onChange={(event) => setNote({ ...note, [product._id]: event.target.value })} placeholder="Explain why the request cannot be accepted." /></Field>
          <Btn variant="danger" busy={busy} disabled={(note[product._id] || "").trim().length < 3} onClick={() => decideRequest(product, "REJECT")}><X size={16} />Reject request</Btn>
        </>}
        {awaitingRepairer && <Notice tone="info" className="mt-4">{evidenceRequested ? `Additional evidence requested: ${inspection.reviewNote || "The repairer must update the report."}` : "Waiting for the assigned repairer to accept this inspection."}</Notice>}
        {inProgress && <Notice tone="info" className="mt-4">The assigned repairer has accepted this request. It will return here for admin review after the report is submitted.</Notice>}
        {!pendingAssignment && !awaitingRepairer && !inProgress && <>
          {inspection.reviewStatus === "PENDING_REVIEW" && <Notice tone="info" className="mt-4">This report is attested to the verified TrustPass account of the assigned repairer. Review the diagnosis and evidence before approving or rejecting it.</Notice>}
          {inspection.report && <div className="mt-4 rounded-lg border border-line-2 bg-white p-4">
            <h3 className="font-semibold">Repairer diagnosis</h3>
            <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
              <dt className="text-ink-2">Decision</dt><dd>{inspection.diagnosis?.decision === "NOT_REPAIRABLE" ? "Cannot reasonably be repaired" : inspection.diagnosis?.decision || "Not provided"}</dd>
              {inspection.diagnosis?.reason && <><dt className="text-ink-2">Reason</dt><dd>{inspection.diagnosis.reason}</dd></>}
              <dt className="text-ink-2">Summary</dt><dd className="whitespace-pre-wrap">{inspection.report.summary || "Not provided"}</dd>
              <dt className="text-ink-2">Attestation</dt><dd>Authenticated TrustPass repairer account</dd>
              {inspection.report.evidenceDocuments?.length > 0 && <><dt className="text-ink-2">Evidence</dt><dd>{inspection.report.evidenceDocuments.map((document) => document.originalName || `${document.category || "Document"} (${document._id || document})`).join(", ")}</dd></>}
            </dl>
          </div>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-4">{inspection.checklist?.map((item) => <div key={item.itemId} className="text-sm border border-line-2 rounded p-2"><span className="text-ink-2">{item.label}</span><strong className="block">{item.status}</strong>{item.notes && <span className="text-ink-2">{item.notes}</span>}</div>)}</div>
          <Field label="Review note"><textarea className="input mt-2" value={note[product._id] || ""} onChange={(e) => setNote({ ...note, [product._id]: e.target.value })} placeholder="Required for rejection or additional evidence." /></Field><div className="flex flex-wrap gap-2 mt-4"><Btn busy={busy} onClick={() => review(product, "APPROVE")}><Check size={16} />Approve</Btn><Btn variant="secondary" busy={busy} onClick={() => review(product, "REQUEST_EVIDENCE")}><FileWarning size={16} />Request evidence</Btn><Btn variant="danger" busy={busy} onClick={() => review(product, "REJECT")}><X size={16} />Reject</Btn></div>
        </>}</li>;
    })}</ul>}
  </div>;
}