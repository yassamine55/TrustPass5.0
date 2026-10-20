import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { Btn, Empty, Field, Notice, PageHeader, Spinner, useAction, useAsync } from "../components/ui";

const today = () => new Date().toISOString().slice(0, 10);

export default function Recycling() {
  const { user } = useAuth();
  const [sp] = useSearchParams();
  const devices = useAsync(() => get("/passports"));
  const history = useAsync(() => get("/recycling"));
  const [go, busy] = useAction();
  const [f, setF] = useState({ product: "", condition: "", components: "", proof: "", date: today() });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const ready = (devices.data || []).filter((p) => p.owner?._id === user.id && p.status === "SOLD_FOR_PARTS");
  useEffect(() => {
    if (f.product || !ready.length) return;
    const wanted = ready.find((p) => p.passportId === sp.get("passport"));
    setF((s) => ({ ...s, product: (wanted || ready[0])._id }));
  }, [ready, sp, f.product]);

  const submit = async (e) => {
    e.preventDefault();
    const body = { product: f.product, condition: f.condition, recoveredComponents: f.components.split(",").map((s) => s.trim()).filter(Boolean), proof: f.proof || undefined, date: f.date };
    if (await go(() => post("/recycling", body), "Recycling recorded")) {
      setF({ product: "", condition: "", components: "", proof: "", date: today() }); devices.reload(); history.reload();
    }
  };

  return (
    <div>
      <PageHeader title="Recycling" lead="Report the recycling of a device bought for its parts. Its passport is then closed, with a timestamped proof." />
      {!user.isVerified && <Notice tone="warn" className="mb-5">Your account must be validated by an administrator before declaring recycling.</Notice>}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr] items-start">
        <section className="panel p-6">
          <h2 className="text-xl font-semibold mb-4">Declare recycling</h2>
          {devices.loading ? <Spinner /> : !ready.length ? (
            <Empty title="No devices to recycle">Buy a device for parts first from <Link to="/parts" className="link">Parts available</Link>.</Empty>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Device"><select className="input" required value={f.product} onChange={set("product")}>{ready.map((p) => <option key={p._id} value={p._id}>{p.brand} {p.model} · {p.passportId}</option>)}</select></Field>
              <Field label="Condition upon receipt"><input className="input" required value={f.condition} onChange={set("condition")} placeholder="Dead motherboard, cracked screen" /></Field>
              <Field label="Recovered components" hint="Separated by commas."><input className="input" value={f.components} onChange={set("components")} placeholder="Battery, screen, connectors" /></Field>
              <Field label="Proof reference (optional)" hint="Waybill or destruction certificate number."><input className="input" value={f.proof} onChange={set("proof")} /></Field>
              <Field label="Date"><input className="input" type="date" max={today()} required value={f.date} onChange={set("date")} /></Field>
              <Btn type="submit" busy={busy} disabled={!user.isVerified} className="w-full">{busy ? "Saving…" : "Save recycling"}</Btn>
            </form>
          )}
        </section>
        <section>
          <h2 className="text-xl font-semibold mb-3">Recycling performed</h2>
          {history.loading ? <Spinner /> : !history.data?.length ? <p className="text-ink-2">No recycling recorded.</p> : (
            <ul className="panel divide-y divide-line-2">
              {history.data.map((r) => (
                <li key={r._id} className="px-4 py-3.5 flex flex-wrap gap-3 items-center justify-between">
                  <div className="min-w-0"><Link to={`/passport/${r.product?.passportId}`} className="font-semibold hover:underline">{r.product?.brand} {r.product?.model}</Link>
                    <p className="text-sm text-ink-2">{fmtDate(r.date)}{r.recoveredComponents?.length ? ` · ${r.recoveredComponents.join(", ")}` : ""}</p></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
