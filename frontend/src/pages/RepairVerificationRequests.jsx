import { useState } from "react";
import { Check, X } from "lucide-react";
import { get, post } from "../lib/api";
import { Badge, Btn, Empty, Field, Notice, PageHeader, Spinner, useAction, useAsync } from "../components/ui";

export default function RepairVerificationRequests() {
  const { data, loading, error, reload } = useAsync(() => get("/repair-verification-requests"));
  const [form, setForm] = useState({});
  const [go, busy] = useAction();
  const respond = async (request, action) => {
    const value = form[request._id] || {};
    const result = await go(() => post(`/repair-verification-requests/${request._id}/respond`, { action, note: value.note || "", signature: value.signature || "" }), action === "ACCEPT" ? "Repair professionally attested" : "Repair claim rejected");
    if (result) reload();
  };
  return <div><PageHeader title="Repair requests" lead="Review repair requests sent to you. Accept only when you're ready to take on the work, and sign the acceptance — declining requires a reason." />{loading ? <Spinner /> : error ? <Notice tone="fail">{error}</Notice> : !data?.length ? <Empty title="No pending repair requests" /> : <ul className="space-y-5">{data.map((request) => { const repair = request.repair; const value = form[request._id] || {}; const targetRepairer = request.targetRepairerId; return <li key={request._id} className="panel p-5"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-bold">{repair?.product?.brand} {repair?.product?.model}</h2><p className="text-sm text-ink-2">Assigned to {targetRepairer ? `${targetRepairer.firstName} ${targetRepairer.lastName}` : "this repairer"} · Requested by {repair?.claimant?.firstName} {repair?.claimant?.lastName} · {repair?.description}</p></div><Badge tone="warn">{request.status}</Badge></div>{repair?.evidenceDocument && <p className="mt-3 text-sm text-ink-2">Photo attached: {repair.evidenceDocument.originalName}</p>}<Field label="Review note"><textarea className="input mt-2" value={value.note || ""} onChange={(e) => setForm({ ...form, [request._id]: { ...value, note: e.target.value } })} placeholder="Explain your decision." /></Field><Field label="Digital signature (required to accept)"><textarea className="input mono mt-2 min-h-20" value={value.signature || ""} onChange={(e) => setForm({ ...form, [request._id]: { ...value, signature: e.target.value } })} /></Field><div className="flex flex-wrap gap-2 mt-4"><Btn busy={busy} onClick={() => respond(request, "ACCEPT")}><Check size={16} />Accept and sign</Btn><Btn variant="danger" busy={busy} onClick={() => respond(request, "REJECT")}><X size={16} />Decline request</Btn></div></li>;})}</ul>}</div>;
}