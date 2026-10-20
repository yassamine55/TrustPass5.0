import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogIn, ShieldCheck } from "lucide-react";
import { PublicLayout } from "../components/Shell";
import { Btn, Field, Notice } from "../components/ui";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await login(f.email, f.password); nav("/dashboard"); } catch (x) { setErr(errorMessage(x)); } finally { setBusy(false); }
  };
  return (
    <PublicLayout>
      <div className="surface-mesh min-h-[calc(100dvh-4rem)] flex items-center">
        <div className="max-w-md w-full mx-auto px-4 py-12 sm:py-16">
          <span className="grid place-items-center w-12 h-12 rounded-xl bg-petrol text-white mx-auto shadow-[0_10px_20px_-8px_rgb(15_92_107/0.55)]"><ShieldCheck size={22} aria-hidden /></span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-center">Log in</h1>
          <p className="text-ink-2 mt-2 text-center">View your devices, repairs, and provenance.</p>
          <form onSubmit={submit} className="panel bg-white p-6 sm:p-7 mt-8 space-y-4">
            {err && <Notice tone="fail">{err}</Notice>}
            <Field label="Email address"><input className="input" type="email" required autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Password"><input className="input" type="password" required autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
            <Btn type="submit" busy={busy} className="w-full"><LogIn size={17} aria-hidden />Log in</Btn>
          </form>
          <p className="mt-6 text-ink-2 text-center">No account yet? <Link to="/register" className="link font-semibold">Create an account</Link></p>
        </div>
      </div>
    </PublicLayout>
  );
}
