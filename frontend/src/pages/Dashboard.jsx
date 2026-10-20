import { Link } from "react-router-dom";
import { Boxes, ChevronRight, ClipboardCheck, FileCheck2, PackagePlus, Settings2, ShieldCheck, ShoppingBag, Wrench, Building2 } from "lucide-react";
import { get } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { STATUS } from "../lib/labels";
import { Empty, Notice, PageHeader, SectionTitle, Spinner, useAsync } from "../components/ui";
import DeviceRows from "../components/DeviceRows";
import { Columns, HBars } from "../components/Charts";

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export default function Dashboard() {
  const { user } = useAuth();
  const View = { OWNER: Owner, REPAIRER: Repairer, BUYER: Buyer, ADMIN: Admin }[user.role];
  return <View user={user} />;
}

function WorkspaceLinks({ items }) {
  return <section className="mb-8" aria-label="Role workspace">
    <div className="flex items-baseline justify-between gap-3 mb-3"><h2 className="text-xl font-semibold">Workspace</h2><span className="text-sm text-ink-2">Open a focused area</span></div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {items.map(([label, to, Icon]) => <Link key={`${label}-${to}`} to={to} className="group flex items-center gap-3 rounded-lg border border-line-2 bg-white px-3.5 py-3 transition-all hover:border-petrol hover:-translate-y-px hover:shadow-[0_8px_20px_-14px_rgb(15_34_48/0.35)]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-petrol-tint text-petrol"><Icon size={17} aria-hidden /></span><span className="min-w-0 text-sm font-semibold group-hover:text-petrol">{label}</span><ChevronRight size={16} className="ml-auto shrink-0 text-ink-2 transition-transform group-hover:translate-x-0.5" aria-hidden /></Link>)}
    </div>
  </section>;
}

function Owner({ user }) {
  const { data, loading, error } = useAsync(() => Promise.all([get("/passports"), get("/repairs"), get("/transfers/mine")]));
  if (loading) return <Spinner />;
  if (error) return <Notice tone="fail">{error}</Notice>;
  const [devices, repairs, transfers] = data;
  const active = devices.filter((d) => ["ACTIVE", "MAINTENANCE"].includes(d.status)).length;
  const closed = devices.filter((d) => ["RECYCLED", "DECOMMISSIONED"].includes(d.status)).length;
  const incoming = transfers.filter((t) => t.status === "PENDING" && t.toOwner?._id === user.id);
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recentSales = transfers.filter((t) => t.viaMarketplace && t.status === "ACCEPTED" && t.fromOwner?._id === user.id && new Date(t.acceptedAt || t.createdAt).getTime() > dayAgo);
  const inspectionDevices = devices.filter((device) => device.technicalInspection?.status && device.technicalInspection.status !== "NOT_REQUESTED");
  return (
    <div>
      <PageHeader title={`Hello ${user.firstName}`} lead={devices.length ? `You track ${plural(devices.length, "device", "devices")}: ${active} active, ${closed} closed. ${plural(repairs.length, "recorded repair", "recorded repairs")}.` : "Create your first passport to start proving your devices' history."}
        actions={<Link to="/devices/new" className="btn btn-primary"><PackagePlus size={18} />New device</Link>} />
      {inspectionDevices.length > 0 && <section className="panel p-4 mb-6" aria-labelledby="owner-inspections-title">
        <h2 id="owner-inspections-title" className="font-semibold mb-2">Technical inspections</h2>
        <ul className="divide-y divide-line-2">{inspectionDevices.map((device) => <li key={device._id} className="py-2 first:pt-0 last:pb-0">
          <Link to={`/passport/${device.passportId}`} className="flex flex-wrap justify-between gap-2 hover:text-petrol">
            <span>{device.brand} {device.model} · {device.passportId}</span>
            <strong>{device.technicalInspection.status === "REQUESTED" ? (device.technicalInspection.reviewStatus === "ADDITIONAL_EVIDENCE_REQUIRED" ? "Additional evidence requested" : device.technicalInspection.assignedRepairer ? "Assigned to repairer" : "Waiting for admin assignment") : device.technicalInspection.status === "IN_PROGRESS" ? "Inspection in progress" : device.technicalInspection.status === "COMPLETED" ? "Waiting for admin review" : device.technicalInspection.status === "TECHNICALLY_VERIFIED" ? "Approved" : device.technicalInspection.status === "REJECTED" ? "Rejected" : device.technicalInspection.status}</strong>
          </Link>
        </li>)}</ul>
      </section>}
      {incoming.length > 0 && <Notice tone="warn" className="mb-6" title={`${plural(incoming.length, "transfer is", "transfers are")} waiting for your response`}><Link to="/transfers" className="link font-semibold">Open transfers</Link></Notice>}
      {recentSales.map((t) => (
        <Notice key={t._id} tone="ok" className="mb-4">
          Your {t.product?.brand} {t.product?.model} was sold to {t.toOwner?.firstName} {t.toOwner?.lastName}{t.price != null ? ` for ${new Intl.NumberFormat("en-US").format(t.price)} TND` : ""}.
        </Notice>
      ))}
    </div>
  );
}

function Repairer({ user }) {
  const { data, loading, error } = useAsync(() => get("/repairs"));
  if (loading) return <Spinner />;
  if (error) return <Notice tone="fail">{error}</Notice>;
  const repairs = data;
  const month = new Date().getMonth();
  const thisMonth = repairs.filter((r) => new Date(r.date).getMonth() === month).length;
  return (
    <div>
      <PageHeader title={`Hello ${user.firstName}`} lead={repairs.length ? `You have signed ${plural(repairs.length, "repair", "repairs")}, including ${thisMonth} this month.` : "Open a device from My devices to record your first repair."} />
      <WorkspaceLinks items={[["Inspection Requests", "/technical-inspections", ClipboardCheck], ["Repair Requests", "/repair-verification-requests", ShieldCheck], ["Completed Repairs", "/repairs", Wrench], ["Settings", "/profile", Settings2]]} />
      <SectionTitle aside={repairs.length > 5 && <Link to="/repairs" className="link text-sm font-semibold">View all</Link>}>Recent repairs</SectionTitle>
      {repairs.length ? (
        <ul className="panel divide-y divide-line-2 overflow-hidden">
          {repairs.slice(0, 5).map((r) => (
            <li key={r._id}><Link to={`/passport/${r.product?.passportId}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/70">
              <div className="min-w-0 flex-1"><p className="font-semibold">{r.product?.brand} {r.product?.model}</p><p className="text-sm text-ink-2">{fmtDate(r.date)} · {r.description}</p></div>
              <ChevronRight size={18} className="text-ink-2" aria-hidden /></Link></li>
          ))}
        </ul>
      ) : <Empty title="No repairs" />}
    </div>
  );
}

function Buyer({ user }) {
  const { data, loading, error, reload } = useAsync(() => Promise.all([get("/passports"), get("/transfers/mine")]))
  if (loading) return <Spinner />;
  if (error) return <Notice tone="fail">{error}</Notice>;
  const [all, transfers] = data;
  const marketplace = all.filter((p) => p.owner?._id !== user.id && ["ACTIVE", "MAINTENANCE", "LISTED_FOR_PARTS"].includes(p.status) && (p.listingPrice != null || p.status === "LISTED_FOR_PARTS"));
  const incoming = transfers.filter((t) => t.status === "PENDING" && t.toOwner?._id === user.id);
  const recent = [
    ...transfers.filter((t) => t.status === "ACCEPTED").map((t) => ({ date: t.acceptedAt || t.createdAt, title: "Purchase completed", detail: `${t.product?.brand || "Device"} ${t.product?.model || ""}`.trim(), to: t.product?.passportId ? `/passport/${t.product.passportId}` : "/transfers" })),
    ...all.filter((p) => p.owner?._id === user.id).map((p) => ({ date: p.updatedAt || p.createdAt, title: "Device added", detail: `${p.brand} ${p.model}`, to: `/passport/${p.passportId}` }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <PageHeader title={`Good afternoon, ${user.firstName}`} lead="Find devices with transparent history and verified evidence."
        actions={<Link to="/parts" className="btn btn-primary"><ShoppingBag size={18} />Browse marketplace</Link>} />
      {incoming.length > 0 && <Notice tone="warn" className="mb-6" title={`${plural(incoming.length, "purchase is", "purchases are")} waiting for your acceptance`}><Link to="/transfers" className="link font-semibold">Open transfers</Link></Notice>}
      <section aria-labelledby="available-parts-title">
        <div className="flex items-baseline justify-between gap-4 mb-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">{marketplace.length} listings</p><h2 id="available-parts-title" className="text-xl font-semibold">Marketplace</h2></div><Link to="/parts" className="link text-sm font-semibold">View all</Link></div>
        {marketplace.length ? <DeviceRows items={marketplace.slice(0, 4)} me={user} marketplace onChanged={reload} /> : <Empty title="No devices listed yet">New marketplace listings will appear here.</Empty>}
      </section>
      <section aria-labelledby="recent-activity-title">
        <div className="flex items-baseline justify-between gap-4 mb-3"><h2 id="recent-activity-title" className="text-xl font-semibold">Recent activity</h2><Link to="/transfers" className="link text-sm font-semibold">View all</Link></div>
        {recent.length ? <ul className="panel divide-y divide-line-2">{recent.map((item, index) => <li key={`${item.title}-${item.date}-${index}`}><Link to={item.to} className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/70"><div className="min-w-0 flex-1"><p className="font-semibold">{item.title}</p><p className="text-sm text-ink-2">{item.detail} · {fmtDate(item.date)}</p></div><ChevronRight size={18} className="text-ink-2" aria-hidden /></Link></li>)}</ul> : <Empty title="No recent activity">Your purchases and device history will appear here.</Empty>}
      </section>
    </div>
  );
}

const STATUS_COLOR = { ok: "var(--band-repair)", info: "var(--band-maintenance)", fail: "var(--band-eol)", warn: "var(--band-listed)", violet: "var(--band-parts)", grey: "var(--band-recycled)" };
const count = (arr, key) => Object.entries(arr.reduce((m, x) => ({ ...m, [key(x)]: (m[key(x)] || 0) + 1 }), {})).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

function Admin() {
  const { data, loading, error } = useAsync(() => Promise.all([get("/admin/stats"), get("/passports"), get("/admin/users")]));
  if (loading) return <Spinner />;
  if (error) return <Notice tone="fail">{error}</Notice>;
  const [stats, products, users] = data;

  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setMonth(d.getMonth() - (5 - i), 1); return { y: d.getFullYear(), m: d.getMonth(), label: new Intl.DateTimeFormat("en-US", { month: "short" }).format(d) }; });
  const perMonth = months.map(({ y, m, label }) => ({ label, value: products.filter((p) => { const d = new Date(p.createdAt); return d.getFullYear() === y && d.getMonth() === m; }).length }));
  const byStatus = count(products, (p) => p.status).map((d) => ({ label: STATUS[d.label]?.label || d.label, value: d.value, color: STATUS_COLOR[STATUS[d.label]?.tone] }));
  const byCat = count(products, (p) => p.category).slice(0, 6);
  const pending = users.filter((u) => !u.isVerified && ["REPAIRER", "BUYER"].includes(u.role)).length;
  const ledger = [["Users", stats.users], ["Devices", stats.products], ["Recycling", stats.recycled], ["Events", stats.lifecycleEvents]];

  return (
    <div>
      <PageHeader title="Overview" lead="Platform activity." />
      <WorkspaceLinks items={[["Technical Inspections", "/admin/technical-inspections", ClipboardCheck], ["Device Certificates", "/admin/device-certificates", FileCheck2], ["Devices", "/devices", Boxes], ["Companies", "/admin/companies", Building2], ["Settings", "/profile", Settings2]]} />
      {pending > 0 && <Notice tone="warn" className="mb-6" title={`${plural(pending, "professional account is", "professional accounts are")} waiting for verification`}><Link to="/admin/users" className="link font-semibold">Review accounts</Link></Notice>}
      <dl className="panel grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-line-2 mb-8 overflow-hidden">
        {ledger.map(([k, v]) => <div key={k} className="px-5 py-4"><dd className="font-display text-3xl font-bold tabular-nums">{v}</dd><dt className="text-sm text-ink-2 mt-0.5">{k}</dt></div>)}
      </dl>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-5"><h2 className="text-lg font-semibold mb-4">Passports created per month</h2><Columns data={perMonth} /></section>
        <section className="panel p-5"><h2 className="text-lg font-semibold mb-4">Devices by status</h2><HBars data={byStatus} /></section>
        <section className="panel p-5"><h2 className="text-lg font-semibold mb-4">Categories</h2><HBars data={byCat} /></section>
      </div>
    </div>
  );
}
