import { Link } from "react-router-dom";
import {
  ArrowRight, BadgeCheck, Boxes, CircleCheck, ClipboardCheck, Fingerprint, Laptop,
  LockKeyhole, Recycle, Route, ShieldCheck, ShoppingBag, Sparkles, Wrench
} from "lucide-react";
import { PublicLayout } from "../components/Shell";

const EXAMPLE_PASSPORT_ID = "RLP-2026-F39BC90";

const RECORD_ITEMS = [
  [ClipboardCheck, "Device identity"],
  [Route, "Ownership history"],
  [CircleCheck, "Repairs & maintenance"],
  [Fingerprint, "Verification records"],
  [Recycle, "End-of-life status"]
];

const TRUST_ROW = [
  [ShieldCheck, "Verifiable history"],
  [Fingerprint, "Independently verifiable"],
  [LockKeyhole, "Privacy by default"]
];

const ROLES = [
  [Boxes, "For owners", "Keep a clear record of care and maintenance, ready to share the moment a device changes hands."],
  [Wrench, "For repairers", "Add documented repair records and supporting evidence directly to the device passport."],
  [ShoppingBag, "For buyers", "Understand condition, previous ownership and end-of-life status before you commit to a purchase."]
];

const GLANCE = [
  [Route, "Recorded history", "Repairs, ownership changes, inspections and other important events are recorded so you can follow the device's journey."],
  [LockKeyhole, "Protected information", "Personal information and private documents stay protected. Only the information needed to verify a device is made publicly traceable."],
  [ShieldCheck, "Evidence you can inspect", "Important records can be checked against their source, evidence fingerprints and inspection status."]
];

export default function Landing() {
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-ink text-white">
        <img src="/images/hero-bg.jpg" alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-45 scale-110 blur-sm" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/95 to-ink/70" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-transparent to-ink/40" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-8 pt-14 sm:pt-20 pb-16 sm:pb-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.05fr] lg:items-center">
            <div className="order-2 lg:order-1">
              <img src="/images/hero-graphic.jpg" alt="TrustPass mobile passport showing identity, repair and ownership records with verification checkmarks" className="w-full rounded-2xl shadow-[0_1px_2px_rgb(0_0_0/0.3),0_32px_64px_-24px_rgb(0_0_0/0.55)] ring-1 ring-white/10" />
            </div>
            <div className="order-1 lg:order-2 max-w-xl">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm font-semibold uppercase tracking-[0.1em] text-[#5eead4]">
                <Sparkles size={14} aria-hidden />TrustPass digital device passport
              </p>
              <h1 className="text-balance mt-5 text-[2.6rem] sm:text-[3.4rem] leading-[1.04] font-extrabold tracking-tight">
                See the record, <span className="text-[#5eead4]">not the promise.</span>
              </h1>
              <p className="mt-5 text-lg text-white/75 leading-relaxed max-w-lg">
                TrustPass brings together a device&apos;s identity, care and ownership history into one verifiable record — so you can make confident decisions at every stage of its life.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/register" className="btn btn-primary btn-lg">Create a free account<ArrowRight size={17} aria-hidden /></Link>
                <a href="#how-it-works" className="btn btn-lg bg-white/10 text-white border border-white/20 hover:bg-white/15">See how it works</a>
              </div>
              <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-3" aria-label="Trust properties">
                {TRUST_ROW.map(([Icon, label]) => (
                  <li key={label} className="flex items-center gap-2 text-sm font-semibold text-white/80">
                    <span className="grid place-items-center w-6 h-6 rounded-full bg-white/10 text-[#5eead4] shrink-0"><Icon size={13} aria-hidden /></span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Example passport, shown right below the hero */}
      <section className="border-b border-line bg-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-14 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol">Example passport</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-balance">Every claim shown with its source.</h2>
              <p className="mt-4 text-ink-2 leading-relaxed max-w-md">Owner-declared information, submitted evidence and independently verified records are never blended into a single score — each is labeled so you know exactly what you&apos;re looking at.</p>
            </div>
            <article className="panel card-lift bg-white p-5 sm:p-7" style={{ boxShadow: "var(--shadow-lift)" }} aria-label="Example TrustPass for MacBook Air M1">
              <div className="flex items-center justify-between gap-4 border-b border-line-2 pb-5">
                <p className="flex items-center gap-2 text-sm font-semibold text-petrol">
                  <span className="grid place-items-center w-6 h-6 rounded-md bg-petrol text-white"><ShieldCheck size={14} aria-hidden /></span>TrustPass
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-petrol-tint px-3 py-1.5 text-sm font-semibold text-petrol"><BadgeCheck size={16} aria-hidden />Claim states shown</span>
              </div>
              <div className="mt-5 flex items-center gap-5 border-b border-line-2 pb-5">
                <span className="grid place-items-center w-16 h-16 rounded-xl bg-petrol-tint text-petrol shrink-0"><Laptop size={34} strokeWidth={1.7} aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-2xl sm:text-3xl font-bold truncate">MacBook Air M1</h3>
                  <p className="mt-1 text-ink-2">Apple · Laptop</p>
                  <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">Passport ID</p>
                      <p className="mt-1 mono text-ink">{EXAMPLE_PASSPORT_ID}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ok"><span className="w-2 h-2 rounded-full bg-ok" aria-hidden />In service</span>
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-lg border border-line-2 bg-board/40 p-4">
                <p className="text-sm font-semibold">Lifecycle history</p>
                <p className="mt-1 text-xs text-ink-2">Track key events in your device&apos;s journey.</p>
                <div className="mt-4 flex items-start w-full" aria-label="Lifecycle history: Created, Repair, Maintenance, Resale">
                  {["Created", "Repair", "Maintenance", "Resale"].map((event, index) => (
                    <div key={event} className="flex min-w-0 flex-1 items-start">
                      <div className="min-w-0 flex-1 text-center">
                        <span className={`mx-auto block w-3 h-3 rounded-full border-2 border-white ring-1 ${index === 3 ? "bg-petrol ring-petrol" : "bg-ok ring-ok"}`} aria-hidden />
                        <p className="mt-2 text-xs text-ink-2 truncate">{event}</p>
                      </div>
                      {index < 3 && <span className="mt-1.5 h-px flex-[0.55] bg-line" aria-hidden />}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* What is a digital device passport */}
      <section id="how-it-works" className="scroll-mt-16 max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-2 items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol">One clear record</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-balance">What is a digital device passport?</h2>
            <p className="mt-4 text-ink-2 leading-relaxed max-w-lg">Your device has a story: where it came from, who owned it, how it was repaired and what happens at the end of its life. TrustPass brings that story together in one place.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {RECORD_ITEMS.map(([Icon, label]) => (
              <div key={label} className="panel bg-white flex items-center gap-3 px-4 py-4 text-[1.02rem] font-semibold">
                <span className="grid place-items-center w-9 h-9 rounded-lg bg-petrol-tint text-petrol shrink-0"><Icon size={18} aria-hidden /></span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="scroll-mt-16 border-y border-line bg-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol">Who it&apos;s for</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-balance max-w-xl">One trusted record, useful to everyone in the device&apos;s life.</h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {ROLES.map(([Icon, t, d]) => (
              <article key={t} className="panel card-lift bg-white p-6 transition-transform hover:-translate-y-0.5">
                <span className="grid place-items-center w-11 h-11 rounded-full bg-petrol-tint text-petrol"><Icon size={20} aria-hidden /></span>
                <h3 className="mt-5 text-xl font-bold">{t}</h3>
                <p className="mt-3 text-ink-2 leading-relaxed">{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Records at a glance */}
      <section className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol">Records at a glance</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-balance">Your device history, explained.</h2>
          <p className="mt-4 text-lg text-ink-2 leading-relaxed">TrustPass gives every device a recorded digital identity, so you can see where it came from, what happened to it, and which records have supporting evidence.</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {GLANCE.map(([Icon, title, text]) => (
            <article key={title} className="panel card-lift bg-white p-6">
              <span className="grid place-items-center w-10 h-10 rounded-full bg-petrol-tint text-petrol"><Icon size={20} aria-hidden /></span>
              <h3 className="mt-5 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-ink-2 leading-relaxed">{text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Circular + privacy */}
      <section className="border-y border-line bg-paper">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20 grid gap-10 lg:grid-cols-2">
          <div>
            <span className="grid place-items-center w-10 h-10 rounded-full bg-gilt-tint text-gilt-ink mb-4"><Recycle size={19} aria-hidden /></span>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol">Circular by design</p>
            <h2 className="mt-3 text-3xl font-bold text-balance">Built for a circular device lifecycle.</h2>
            <p className="mt-4 text-ink-2 leading-relaxed">When a device&apos;s history is easier to understand, it can stay useful for longer. TrustPass helps owners, repairers and buyers make responsible decisions with the same trusted record.</p>
          </div>
          <div>
            <span className="grid place-items-center w-10 h-10 rounded-full bg-petrol-tint text-petrol mb-4"><LockKeyhole size={19} aria-hidden /></span>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-petrol">Privacy by default</p>
            <h2 className="mt-3 text-3xl font-bold text-balance">Privacy without exposing private information.</h2>
            <p className="mt-4 text-ink-2 leading-relaxed">Your personal information and private documents remain protected. The public passport shows the records needed to understand and verify the device, without putting your private details on display.</p>
          </div>
        </div>
      </section>

      {/* Verification details */}
      <section id="verification" className="scroll-mt-16 max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20">
        <details className="panel bg-white p-5 sm:p-6 open:shadow-sm">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-4 text-lg font-semibold">
            <span className="flex items-center gap-3"><ShieldCheck size={20} className="text-petrol" aria-hidden />How verification works</span>
            <span className="text-sm font-medium text-ink-2">Technical details</span>
          </summary>
          <div className="mt-5 border-t border-line-2 pt-5 max-w-3xl text-ink-2 leading-relaxed space-y-3">
            <p>TrustPass keeps a timestamped history of selected passport and lifecycle events.</p>
            <p>Users can review the history, supporting evidence, fingerprints and timestamps for each record.</p>
            <p>This supports a traceable history while personal information and private documents stay protected.</p>
          </div>
        </details>
      </section>

      {/* Final CTA */}
      <section className="surface-mesh border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-16 sm:py-20 text-center">
          <h2 className="text-3xl sm:text-[2.6rem] font-extrabold tracking-tight text-balance max-w-2xl mx-auto">Ready to see a device&apos;s full record?</h2>
          <p className="mt-4 text-lg text-ink-2 max-w-xl mx-auto leading-relaxed">Create a free account to register a device, add repair history, or start verifying a purchase today.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn btn-primary btn-lg">Create a free account<ArrowRight size={17} aria-hidden /></Link>
            <Link to="/login" className="btn btn-secondary btn-lg">Log in</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
