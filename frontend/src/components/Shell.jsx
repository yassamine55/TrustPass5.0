import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Boxes, Building2, ClipboardCheck, FileCheck2, Gauge, LogOut, Settings2, ShieldCheck, Users, Wrench, ArrowLeftRight, ShoppingBag } from "lucide-react";
import { useAuth } from "../lib/auth";
import { ROLES } from "../lib/labels";
import { initials } from "../lib/format";
import { Badge } from "./ui";

export function Wordmark({ light = false }) {
  return (
    <Link to="/" className="inline-flex items-center gap-2.5" aria-label="TrustPass, home">
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden>
        <defs>
          <linearGradient id="trustpass-shield" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#063d72" />
            <stop offset="55%" stopColor="#00a98f" />
            <stop offset="100%" stopColor="#22b879" />
          </linearGradient>
        </defs>
        <path d="M32 4 55 12v20c0 14-9.2 23.2-23 28C18.2 55.2 9 46 9 32V12L32 4Z" fill="url(#trustpass-shield)" />
        <path d="M20 26h24v9H20zM27.5 26v25h9V26z" fill="white" />
        <path d="M11 32c2.5 10 12 15 28 15 9 0 16-2.5 21-7" fill="none" stroke="#19c28a" strokeWidth="5" strokeLinecap="round" />
        <circle cx="51" cy="13" r="3" fill="#18b994" />
        <circle cx="57" cy="20" r="3" fill="#18b994" />
        <circle cx="51" cy="27" r="3" fill="#18b994" />
      </svg>
      <span className={`font-display text-[1.3rem] font-bold tracking-tight ${light ? "text-white" : "text-ink"}`}><span>Trust</span><span className="text-[#079d83]">Pass</span></span>
    </Link>
  );
}

const NAV = {
  OWNER: [["/dashboard", "My activity", Gauge], ["/devices", "My devices", Boxes]],
  REPAIRER: [["/dashboard", "Repair workspace", Gauge], ["/technical-inspections", "Inspection requests", ClipboardCheck], ["/repair-verification-requests", "Repair requests", ShieldCheck], ["/repairs", "Completed repairs", Wrench]],
  BUYER: [["/dashboard", "My activity", Gauge], ["/parts", "Marketplace", ShoppingBag], ["/transfers", "Purchases", ArrowLeftRight]],
  ADMIN: [["/dashboard", "Overview", Gauge], ["/admin/technical-inspections", "Inspections", ClipboardCheck], ["/admin/device-certificates", "Certificates", FileCheck2], ["/admin/companies", "Companies", Building2], ["/devices", "Devices", Boxes], ["/admin/users", "Users", Users]]
};
const MOBILE = { OWNER: ["/dashboard", "/devices", "/profile"], REPAIRER: ["/dashboard", "/technical-inspections", "/repair-verification-requests", "/repairs", "/profile"], BUYER: ["/dashboard", "/parts", "/transfers", "/profile"], ADMIN: ["/dashboard", "/admin/technical-inspections", "/admin/device-certificates", "/devices", "/profile"] };

const link = ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 min-h-11 text-[0.95rem] font-medium transition-colors ${isActive ? "bg-petrol text-white shadow-[0_1px_2px_rgb(15_34_48/0.08),0_8px_16px_-10px_rgb(15_92_107/0.65)]" : "text-ink hover:bg-ink/5"}`;

export default function Shell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[user.role];
  const profileItem = ["/profile", "My profile", Settings2];
  const orderedItems = items.some(([to]) => to === "/devices")
    ? items.flatMap((item) => item[0] === "/devices" ? [item, profileItem] : [item])
    : [...items, profileItem];
  const all = orderedItems;
  const mobile = MOBILE[user.role].map((to) => all.find((i) => i[0] === to)).filter(Boolean);
  const needsReview = !user.isVerified && user.role !== "OWNER";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="hidden lg:flex flex-col sticky top-0 h-dvh border-r border-line bg-paper p-5">
        <div className="flex items-center justify-between gap-2">
          <Wordmark />
        </div>
        <nav className="mt-8 flex-1 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {orderedItems.map(([to, label, Icon]) => <NavLink key={to} to={to} end className={link}><Icon size={19} aria-hidden />{label}</NavLink>)}
        </nav>
        <div className="border-t border-line pt-4">
          <div className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-white transition-colors">
            <span className="grid place-items-center w-9 h-9 rounded-full bg-petrol text-white font-bold text-sm shrink-0 ring-2 ring-petrol-tint">{initials(user)}</span>
            <div className="min-w-0 flex-1"><p className="font-semibold truncate text-sm">{user.firstName} {user.lastName}</p><p className="text-xs text-ink-2">{ROLES[user.role].label}</p></div>
            <button onClick={() => { logout(); nav("/"); }} className="btn btn-ghost btn-sm" aria-label="Log out"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-paper/95 backdrop-blur-md border-b border-line px-4 h-14 shadow-sm">
          <Wordmark />
          <button onClick={() => { logout(); nav("/"); }} className="btn btn-ghost btn-sm" aria-label="Log out"><LogOut size={18} /></button>
        </header>
        <main className="px-4 sm:px-8 lg:px-12 py-7 lg:py-10 max-w-6xl">
          {needsReview && (
            <div className="mb-6 rounded-lg border border-gilt bg-gilt-tint/70 px-4 py-3 text-[0.92rem] flex gap-3 items-start shadow-sm">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" />
              <p><strong>Account pending verification.</strong> {user.role === "BUYER" ? "You can browse marketplace listings and passports. Purchases will be available after your account is approved." : "Your professional actions will be available after your account is approved."} <Link to="/profile" className="link font-semibold">View account status</Link></p>
            </div>
          )}
          {children ?? <Outlet />}
        </main>
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper/95 backdrop-blur-md border-t border-line grid pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_20px_-16px_rgb(15_34_48/0.3)]" style={{ gridTemplateColumns: `repeat(${mobile.length}, 1fr)` }} aria-label="Mobile navigation">
        {mobile.map(([to, label, Icon]) => {
          return (
            <NavLink key={to} to={to} end className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-2 text-[0.7rem] font-semibold transition-colors ${isActive ? "text-petrol" : "text-ink-2"}`}>
              <Icon size={21} aria-hidden />
              <span className="truncate max-w-full px-1">{label.split(" ")[0]}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

/* Public page header */
export function PublicLayout({ children }) {
  const { user } = useAuth();
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6 min-w-0">
            <Wordmark />
          </div>
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-semibold text-ink-2" aria-label="Public navigation">
            <a href="/#how-it-works" className="rounded-lg px-3 py-2 hover:text-ink hover:bg-ink/5 transition-colors">How it works</a>
            <a href="/#roles" className="rounded-lg px-3 py-2 hover:text-ink hover:bg-ink/5 transition-colors">Who it&apos;s for</a>
            <a href="/#verification" className="rounded-lg px-3 py-2 hover:text-ink hover:bg-ink/5 transition-colors">Verification</a>
          </nav>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {user ? <Link to="/dashboard" className="btn btn-primary btn-sm">My space</Link>
              : <><Link to="/login" className="btn btn-ghost btn-sm">Log in</Link><Link to="/register" className="btn btn-primary btn-sm">Create account</Link></>}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line bg-ink text-white/70 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Wordmark light />
            <p className="mt-4 max-w-sm text-[0.95rem] leading-relaxed">A digital passport for electronic devices — identity, care and ownership history in one verifiable record.</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Product</p>
            <ul className="mt-3 space-y-2.5 text-[0.92rem]">
              <li><a href="/#how-it-works" className="hover:text-white transition-colors">How it works</a></li>
              <li><a href="/#roles" className="hover:text-white transition-colors">Owners, repairers &amp; buyers</a></li>
              <li><a href="/#verification" className="hover:text-white transition-colors">How verification works</a></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">Account</p>
            <ul className="mt-3 space-y-2.5 text-[0.92rem]">
              <li><Link to="/login" className="hover:text-white transition-colors">Log in</Link></li>
              <li><Link to="/register" className="hover:text-white transition-colors">Create an account</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-3 text-[0.82rem] text-white/45">
            <p>&copy; {new Date().getFullYear()} TrustPass. Built for the 4Hacks Campus Edition — Université de Gabès.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Choose the shell based on the session: passport pages integrate with the connected space. */
export function AdaptiveLayout({ children }) {
  const { user } = useAuth();
  return user ? <Shell>{children}</Shell> : <PublicLayout><div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-12">{children}</div></PublicLayout>;
}

export { Badge };
