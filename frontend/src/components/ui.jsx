import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle, Copy, Check, ExternalLink } from "lucide-react";
import { STATUS, statusLabel } from "../lib/labels";
import { errorMessage } from "../lib/api";

export function Btn({ variant = "primary", size, busy, className = "", children, ...p }) {
  return (
    <button {...p} disabled={p.disabled || busy} className={`btn btn-${variant} ${size === "sm" ? "btn-sm" : ""} ${className}`}>
      {busy && <Loader2 size={16} className="spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-sm font-semibold mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-[0.82rem] text-ink-2 mt-1.5">{hint}</span>}
      {error && <span className="block text-[0.82rem] text-fail mt-1.5" role="alert">{error}</span>}
    </label>
  );
}

const TONES = {
  ok: "bg-ok-tint text-ok ring-1 ring-inset ring-ok/15", info: "bg-[#dbe5f7] text-[#24478f] ring-1 ring-inset ring-[#24478f]/12", warn: "bg-gilt-tint text-gilt-ink ring-1 ring-inset ring-gilt-ink/15",
  fail: "bg-fail-tint text-fail ring-1 ring-inset ring-fail/15", violet: "bg-[#e6def3] text-[#5a3d8f] ring-1 ring-inset ring-[#5a3d8f]/12", grey: "bg-[#dfe3e6] text-ink-2 ring-1 ring-inset ring-ink-2/10", gilt: "bg-gilt-tint text-gilt-ink ring-1 ring-inset ring-gilt-ink/15"
};
export function Badge({ tone = "grey", children, icon: Icon }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[0.8rem] font-semibold whitespace-nowrap ${TONES[tone]}`}>
      {Icon && <Icon size={13} aria-hidden />}{children}
    </span>
  );
}
export const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.tone || "grey"}>{statusLabel(status)}</Badge>;

const NOTICE = { info: [Info, "bg-[#dbe5f7]/70 border-[#b6c8ec]"], warn: [AlertTriangle, "bg-gilt-tint/70 border-gilt"], fail: [XCircle, "bg-fail-tint border-fail/40"], ok: [CheckCircle2, "bg-ok-tint border-ok/30"] };
export function Notice({ tone = "info", title, children, className = "" }) {
  const [Icon, cls] = NOTICE[tone];
  return (
    <div role={tone === "fail" ? "alert" : "status"} className={`flex gap-3 rounded-lg border px-4 py-3 text-[0.92rem] ${cls} ${className}`}>
      <Icon size={18} className="shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">{title && <p className="font-semibold">{title}</p>}<div className="text-ink/90">{children}</div></div>
    </div>
  );
}

export const Spinner = ({ label = "Chargement" }) => (
  <div className="flex items-center gap-2 text-ink-2 py-10 justify-center" role="status"><Loader2 className="spin" size={20} /><span>{label}…</span></div>
);

export function Empty({ title, children, action }) {
  return (
    <div className="panel border-dashed shadow-none bg-white/40 px-6 py-12 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-petrol-tint text-petrol"><Info size={20} aria-hidden /></span>
      <p className="font-display text-xl font-semibold mt-4">{title}</p>
      {children && <p className="text-ink-2 mt-1.5 max-w-md mx-auto leading-relaxed">{children}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, lead, actions }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 mb-7 pb-6 border-b border-line-2">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-[2rem] sm:text-[2.4rem] leading-[1.05] font-bold tracking-tight">{title}</h1>
        {lead && <p className="text-ink-2 mt-2.5 text-[1.02rem] leading-relaxed">{lead}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export const SectionTitle = ({ children, aside }) => (
  <div className="flex items-baseline justify-between gap-3 mb-3"><h2 className="text-xl font-semibold">{children}</h2>{aside}</div>
);

/* Boîte de dialogue native : focus piégé et Échap gérés par le navigateur. */
export function Modal({ open, onClose, title, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-paper text-ink p-0 shadow-2xl border border-line`}>
      {open && (
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-4 mb-5">
            <h2 className="text-2xl font-bold">{title}</h2>
            <button onClick={onClose} className="btn btn-ghost btn-sm -mr-2 -mt-1" aria-label="Fermer"><X size={18} /></button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/* Notifications */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, message, tone }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 5000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed z-[60] bottom-24 lg:bottom-6 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`rounded-lg px-4 py-3 text-[0.92rem] font-medium shadow-lg border ${t.tone === "ok" ? "bg-ink text-white border-ink" : "bg-fail text-white border-fail"}`}>{t.message}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* Chargement asynchrone avec rechargement manuel */
export function useAsync(fn, deps = []) {
  const [state, set] = useState({ data: null, error: null, loading: true });
  const run = useCallback(() => {
    set((s) => ({ ...s, loading: true, error: null }));
    return fn().then((data) => set({ data, error: null, loading: false })).catch((e) => set({ data: null, error: errorMessage(e), loading: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}

/* Exécute une action avec état "occupé" + toast d'erreur/succès */
export function useAction() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn, success) => {
    setBusy(true);
    try { const r = await fn(); if (success) toast(success); return r; }
    catch (e) { toast(errorMessage(e), "fail"); return undefined; }
    finally { setBusy(false); }
  }, [toast]);
  return [run, busy];
}

export function CopyButton({ text, label = "Copier" }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn btn-ghost btn-sm" aria-label={label}
      onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1600); })}>
      {ok ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

export const ExtLink = ({ href, children }) => (
  <a href={href} target="_blank" rel="noreferrer noopener" className="link inline-flex items-center gap-1">{children}<ExternalLink size={13} aria-hidden /></a>
);

/* Ligne libellé / valeur pour les fiches */
export const DL = ({ items }) => (
  <dl className="divide-y divide-line-2">
    {items.filter(Boolean).map(([k, v]) => (
      <div key={k} className="flex flex-wrap justify-between gap-x-6 gap-y-0.5 py-2.5 text-[0.93rem]">
        <dt className="text-ink-2">{k}</dt><dd className="font-medium text-right min-w-0 break-words">{v}</dd>
      </div>
    ))}
  </dl>
);
