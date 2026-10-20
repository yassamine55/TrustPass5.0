import { useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FileCheck2 } from "lucide-react";
import { get, post } from "../lib/api";
import { sha256File } from "../lib/hash";
import { parsePassportId, shortHash } from "../lib/format";
import { DOCUMENT_CATEGORIES } from "../lib/labels";
import { Btn, DL, Empty, Field, Notice, PageHeader, Spinner, StatusBadge, useAction, useAsync, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";

const today = () => new Date().toISOString().slice(0, 10);

export default function RepairNew() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const id = parsePassportId(sp.get("passport"));
  const { data, loading, error } = useAsync(() => (id ? get(`/public/passport/${id}`) : Promise.resolve(null)), [id]);
  const [f, setF] = useState({ description: "", parts: "", price: "", date: today(), signature: "", documentCategory: "REPAIR_INVOICE" });
  const [file, setFile] = useState(null);
  const [hash, setHash] = useState("");
  const [go, busy] = useAction();
  const inp = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  if (!id) return <Empty title="Which device are you repairing?">Open the device passport from My devices, then choose “Record a repair”.</Empty>;
  if (loading) return <Spinner />;
  if (error) return <Notice tone="fail">{error}</Notice>;
  const p = data.passport;
  const blocked = !["ACTIVE", "MAINTENANCE"].includes(p.status);

  const pick = async (e) => { const x = e.target.files?.[0]; if (!x) return; setFile(x); setHash(await sha256File(x)); };
  const submit = async (e) => {
    e.preventDefault();
    const r = await go(async () => {
      let documentId;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("category", f.documentCategory);
        fd.append("product", p._id);
        fd.append("claimType", "REPAIR");
        documentId = (await post("/documents", fd)).document._id;
      }
      const body = { product: p._id, description: f.description, changedParts: f.parts.split(",").map((s) => s.trim()).filter(Boolean), date: f.date, documentId };
      if (f.price !== "") body.price = Number(f.price);
      if (f.signature.trim()) body.signature = f.signature.trim();
      return post("/repairs", body);
    });
    if (!r) return;
    toast("Repair recorded");
    nav(`/passport/${p.passportId}`);
  };

  return (
    <div>
      <PageHeader title="Record a repair" lead="Add a repair to the device history and link it to your repairer account." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <form onSubmit={submit} className="panel p-6 sm:p-8 space-y-5">
          {blocked && <Notice tone="fail" title="Repair impossible">This device is in the “{p.status}” state: only repairs on devices in service or maintenance are accepted.</Notice>}
          <Field label="Work performed"><textarea className="input" required minLength={3} value={f.description} onChange={set("description")} placeholder="Battery replacement, fan cleaning…" /></Field>
          <Field label="Replacement parts" hint="Separated by commas."><input className="input" value={f.parts} onChange={set("parts")} placeholder="Battery, fan" /></Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Billed amount (€)"><input className="input" type="number" min="0" step="0.01" value={f.price} onChange={set("price")} /></Field>
            <Field label="Repair date"><input className="input" type="date" max={today()} required value={f.date} onChange={set("date")} /></Field>
          </div>
          <div>
            <p className="text-sm font-semibold mb-1.5">Invoice or supporting document (optional)</p>
            <select className="input mb-2" value={f.documentCategory} onChange={set("documentCategory")}>
              {DOCUMENT_CATEGORIES.filter(([value]) => ["REPAIR_INVOICE", "REPAIR_DIAGNOSTIC_REPORT", "REPLACEMENT_PART_DOCUMENT", "OTHER_SUPPORTING_DOCUMENT"].includes(value)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input ref={inp} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={pick} />
            <Btn type="button" variant="secondary" onClick={() => inp.current?.click()}><FileCheck2 size={17} />{file ? "Change file" : "Add a file"}</Btn>
            {file && <p className="mt-2 text-sm text-ink-2">{file.name} · SHA-256 fingerprint <span className="mono text-ink">{shortHash(hash, 10)}</span>. The fingerprint is stored instead of the file contents.</p>}
            <p className="text-[0.82rem] text-ink-2 mt-1.5">PDF, JPG, PNG, or WEBP, max 5 MB.</p>
          </div>
          <Field label="Repairer signature (optional)" hint="Paste the base64 signature for this repair payload. A valid signature marks the repairer as verified.">
            <textarea className="input mono min-h-20" value={f.signature} onChange={set("signature")} placeholder="Base64 signature" />
          </Field>
          <Btn type="submit" busy={busy} disabled={blocked} className="w-full sm:w-auto">{busy ? "Saving…" : "Sign and record"}</Btn>
        </form>
        <aside className="panel p-5">
          <h2 className="text-lg font-semibold mb-1">Device</h2>
          <DL items={[["Model", `${p.brand} ${p.model}`], ["Category", p.category], ["Identifier", <span className="mono">{p.passportId}</span>], ["Status", <StatusBadge status={p.status} />], ["Previous repairs", data.repairs.length]]} />
          <Link to={`/passport/${p.passportId}`} className="link text-sm font-semibold mt-3 inline-block">View full passport</Link>
        </aside>
      </div>
    </div>
  );
}
