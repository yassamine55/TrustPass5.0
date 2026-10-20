import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Boxes, ShieldCheck, ShoppingBag, Wrench } from "lucide-react";
import { PublicLayout } from "../components/Shell";
import { Btn, Field, Notice } from "../components/ui";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
import { ROLES } from "../lib/labels";

const ROLE_ICONS = { OWNER: Boxes, REPAIRER: Wrench, BUYER: ShoppingBag };

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", password: "", phone: "", address: "", role: "OWNER" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    const body = { ...f };
    try { await register(body); nav("/dashboard"); } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  };

  return (
    <PublicLayout>
      <div className="surface-mesh">
        <div className="max-w-2xl mx-auto px-4 py-12 sm:py-16">
          <span className="grid place-items-center w-12 h-12 rounded-xl bg-petrol text-white mx-auto shadow-[0_10px_20px_-8px_rgb(15_92_107/0.55)]"><ShieldCheck size={22} aria-hidden /></span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-center">Create an account</h1>
          <p className="text-ink-2 mt-2 text-center">Choose the role that matches your use case.</p>
          <form onSubmit={submit} className="panel bg-white p-6 sm:p-8 mt-8 space-y-6">
            {err && <Notice tone="fail">{err}</Notice>}
            <fieldset>
              <legend className="text-sm font-semibold mb-2">I am</legend>
              <div className="grid gap-2.5">
                {["OWNER", "REPAIRER", "BUYER"].map((r) => {
                  const Icon = ROLE_ICONS[r];
                  return (
                    <label key={r} className={`flex gap-3 items-start rounded-lg border p-3.5 cursor-pointer transition-colors ${f.role === r ? "border-petrol bg-petrol-tint/50 ring-1 ring-petrol" : "border-line bg-white hover:border-ink-2"}`}>
                      <input type="radio" name="role" value={r} checked={f.role === r} onChange={set("role")} className="mt-1 accent-[#0f5c6b]" />
                      <span className="grid place-items-center w-8 h-8 rounded-md bg-petrol-tint text-petrol shrink-0"><Icon size={16} aria-hidden /></span>
                      <span><span className="block font-semibold">{ROLES[r].label}</span><span className="block text-sm text-ink-2">{ROLES[r].help}</span></span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="First name"><input className="input" required autoComplete="given-name" value={f.firstName} onChange={set("firstName")} /></Field>
              <Field label="Last name"><input className="input" required autoComplete="family-name" value={f.lastName} onChange={set("lastName")} /></Field>
            </div>
            <Field label="Email address"><input className="input" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></Field>
            <Field label="Password" hint="8 characters minimum."><input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={set("password")} /></Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Phone (optional)"><input className="input" type="tel" autoComplete="tel" value={f.phone} onChange={set("phone")} /></Field>
              <Field label={f.role === "REPAIRER" ? "Address *" : "Address (optional)"} hint={f.role === "REPAIRER" ? "Shown to owners choosing a repairer nearby." : undefined}><input className="input" required={f.role === "REPAIRER"} autoComplete="street-address" value={f.address} onChange={set("address")} /></Field>
            </div>
            <Btn type="submit" busy={busy} className="w-full">Create my account</Btn>
          </form>
          <p className="mt-6 text-ink-2 text-center">Already signed up? <Link to="/login" className="link font-semibold">Log in</Link></p>
        </div>
      </div>
    </PublicLayout>
  );
}
