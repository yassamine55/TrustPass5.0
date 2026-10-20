import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Camera, Wrench } from "lucide-react";
import { get, post } from "../lib/api";
import { parsePassportId } from "../lib/format";
import { Btn, DL, Empty, Field, Notice, PageHeader, Spinner, StatusBadge, useAction, useAsync, useToast } from "../components/ui";

const today = () => new Date().toISOString().slice(0, 10);

export default function RepairClaimNew() {
  const [sp] = useSearchParams();
  const id = parsePassportId(sp.get("passport"));
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, error } = useAsync(() => id ? get(`/public/passport/${id}`) : Promise.resolve(null), [id]);
  const { data: repairers, loading: repairersLoading, error: repairersError } = useAsync(() => get("/repairs/repairers"));
  const [form, setForm] = useState({ description: "", preferredDate: "", targetRepairerId: "" });
  const [file, setFile] = useState(null);
  const [go, busy] = useAction();
  const input = useRef(null);
  if (!id) return <Empty title="Which device needs a repair?">Open a device from My devices first, then request a repair from its history.</Empty>;
  if (loading) return <Spinner />;
  if (error) return <Notice tone="fail">{error}</Notice>;
  if (repairersLoading) return <Spinner />;
  if (repairersError) return <Notice tone="fail">{repairersError}</Notice>;
  const product = data.passport;
  const submit = async (event) => {
    event.preventDefault();
    const result = await go(async () => {
      let documentId;
      if (file) { const fd = new FormData(); fd.append("file", file); fd.append("category", "OTHER_SUPPORTING_DOCUMENT"); fd.append("product", product._id); fd.append("claimType", "REPAIR_REQUEST"); documentId = (await post("/documents", fd)).document._id; }
      if (!form.targetRepairerId) throw new Error("Select the repairer you want to send this request to");
      return post("/repairs/claims", { product: product._id, description: form.description, date: form.preferredDate || undefined, documentId, targetRepairerId: form.targetRepairerId });
    }, "Repair request sent");
    if (result) { toast("Repair request sent"); nav(`/passport/${product.passportId}`); }
  };
  return (
    <div>
      <PageHeader title="Send a repair request" lead="Describe the problem and pick a certified repairer. They'll review it, then accept or decline before doing any work." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <form onSubmit={submit} className="panel p-6 sm:p-8 space-y-5">
          <Notice tone="info"><Wrench size={16} className="inline -mt-0.5 mr-1" />The repairer independently decides whether to accept this request — nothing is recorded as repaired until they do the work and sign off on it.</Notice>
          <Field label="Certified repairer" hint="Verified by an admin. Their address is shown so you can pick someone nearby.">
            <select className="input" required value={form.targetRepairerId} onChange={(e) => setForm({ ...form, targetRepairerId: e.target.value })}>
              <option value="">Select a verified repairer</option>
              {(repairers || []).map((repairer) => (
                <option key={repairer._id} value={repairer._id}>
                  {repairer.firstName} {repairer.lastName}{repairer.company ? ` · ${repairer.company.name}` : ""}{repairer.address ? ` · ${repairer.address}` : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="What's wrong with the device?"><textarea className="input" required minLength={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Cracked screen, battery drains fast, won't turn on…" /></Field>
          <Field label="Preferred date (optional)" hint="A rough idea of when you'd like this done."><input className="input" type="date" min={today()} value={form.preferredDate} onChange={(e) => setForm({ ...form, preferredDate: e.target.value })} /></Field>
          <div>
            <p className="text-sm font-semibold mb-1.5">Photo of the issue (optional)</p>
            <input ref={input} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Btn type="button" variant="secondary" onClick={() => input.current?.click()}><Camera size={17} />{file ? "Change photo" : "Add a photo"}</Btn>
            {file && <p className="mt-2 text-sm text-ink-2">{file.name}</p>}
          </div>
          <Btn type="submit" busy={busy}><Wrench size={17} />Send repair request</Btn>
        </form>
        <aside className="panel p-5">
          <h2 className="font-semibold mb-2">Device</h2>
          <DL items={[["Model", `${product.brand} ${product.model}`], ["Device ID", <span className="mono">{product.passportId}</span>], ["Status", <StatusBadge status={product.status} />]]} />
        </aside>
      </div>
    </div>
  );
}
