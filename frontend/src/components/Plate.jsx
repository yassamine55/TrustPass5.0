import { STATUS, statusLabel } from "../lib/labels";
import { CopyButton } from "./ui";

const DOT = { ok: "#5ccf8d", info: "#7ea6ff", fail: "#ff8a80", warn: "#f0cd55", violet: "#b99bea", grey: "#b4bcc2" };

/* La « plaque signalétique » du passeport : seule grande surface sombre de l'interface. */
export default function Plate({ title, subtitle, passportId, status, aside, sample }) {
  const tone = STATUS[status]?.tone || "grey";
  return (
    <section className="rounded-[1.4rem] bg-ink text-white p-6 sm:p-8 relative overflow-hidden shadow-[0_1px_2px_rgb(15_34_48/0.2),0_24px_48px_-24px_rgb(15_34_48/0.6)]" aria-label={`Passeport ${title}`}>
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-petrol/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 -left-20 w-64 h-64 rounded-full bg-gilt/10 blur-3xl" aria-hidden />
      <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] items-start">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[0.85rem] font-semibold text-white/90">
            <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white/20" style={{ background: DOT[tone] }} aria-hidden />{statusLabel(status)}
            {sample && <span className="ml-1 rounded bg-white/15 px-1.5 py-0.5 text-xs">Exemple</span>}
          </p>
          <h1 className="mt-3 text-[2.1rem] sm:text-[2.9rem] leading-[1.04] font-bold break-words">{title}</h1>
          {subtitle && <p className="mt-1 text-white/70 text-[1.02rem]">{subtitle}</p>}
          <p className="mt-3 flex items-center gap-1 text-white/85">
            <span className="mono text-[0.95rem]">{passportId}</span>
            {!sample && <span className="[&_button]:text-white [&_button:hover]:bg-white/10"><CopyButton text={passportId} label="Copier l'identifiant" /></span>}
          </p>
        </div>
        {aside && <div className="lg:pt-1">{aside}</div>}
      </div>
    </section>
  );
}
