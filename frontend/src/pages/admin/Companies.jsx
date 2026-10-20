import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { get, patch, post } from "../../lib/api";
import { Badge, Btn, Empty, Field, PageHeader, Spinner, Notice, useAction, useAsync } from "../../components/ui";

const TYPES = {
  MANUFACTURER: "Manufacturer",
  AUTHORIZED_SERVICE_CENTER: "Authorized service center",
  CERTIFIED_RECYCLER: "Certified recycling center"
};

export default function Companies() {
  const { data, loading, error, reload } = useAsync(() => get("/admin/companies"));
  const [go, busy] = useAction();
  const initialForm = { name: "", type: "AUTHORIZED_SERVICE_CENTER", email: "", phone: "", address: "" };
  const [f, setF] = useState(initialForm);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const create = async (e) => { e.preventDefault(); if (await go(() => post("/admin/companies", f), "Company created")) { setF(initialForm); reload(); } };
  const verify = async (c) => { if (await go(() => patch(`/admin/companies/${c._id}/verify`), `${c.name} is verified`)) reload(); };

  return (
    <div>
      <PageHeader title="Companies" lead="Repair workshops and recycling centers referenced on the platform." />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] items-start">
        <section>
          {loading ? <Spinner /> : error ? <Notice tone="fail">{error}</Notice> : !data.length ? <Empty title="No companies">Add the first one with the form.</Empty> : (
            <ul className="panel divide-y divide-line-2">
              {data.map((c) => (
                <li key={c._id} className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0"><p className="font-semibold">{c.name}</p><p className="text-sm text-ink-2">{TYPES[c.type]}{c.email ? ` · ${c.email}` : ""}{c.phone ? ` · ${c.phone}` : ""}</p></div>
                  {c.status === "VERIFIED" || c.isVerified ? <Badge tone="ok" icon={BadgeCheck}>Verified</Badge> : <Btn size="sm" busy={busy} onClick={() => verify(c)}>Verify</Btn>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <form onSubmit={create} className="panel p-5 space-y-4">
          <h2 className="text-lg font-semibold">Add a company</h2>
          <Field label="Name"><input className="input" required value={f.name} onChange={set("name")} /></Field>
          <Field label="Activity"><select className="input" value={f.type} onChange={set("type")}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="E-mail"><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
          <Field label="Phone"><input className="input" type="tel" value={f.phone} onChange={set("phone")} /></Field>
          <Field label="Address"><input className="input" value={f.address} onChange={set("address")} /></Field>
          <Btn type="submit" busy={busy} className="w-full">Create company</Btn>
        </form>
      </div>
    </div>
  );
}
