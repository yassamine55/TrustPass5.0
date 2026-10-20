import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PackagePlus } from "lucide-react";
import { get } from "../lib/api";
import { useAuth } from "../lib/auth";
import { STATUS } from "../lib/labels";
import { Empty, PageHeader, Spinner, Notice, useAsync } from "../components/ui";
import DeviceRows from "../components/DeviceRows";

export default function Devices() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => get("/passports"));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const items = useMemo(() => {
    let l = Array.isArray(data) ? data : [];
    if (user.role !== "ADMIN") l = l.filter((p) => p.owner?._id === user.id);
    if (status) l = l.filter((p) => p.status === status);
    const s = q.trim().toLowerCase();
    return s ? l.filter((p) => `${p.brand} ${p.model} ${p.passportId} ${p.category}`.toLowerCase().includes(s)) : l;
  }, [data, q, status, user]);
  const hasOwnerDevices = user.role === "OWNER" && (Array.isArray(data) ? data : []).some((p) => p.owner?._id === user.id);

  return (
    <div>
      <PageHeader title={user.role === "ADMIN" ? "All devices" : "My devices"} lead={user.role === "ADMIN" ? "Monitoring of passports created on the platform." : undefined}
        actions={user.role === "OWNER" && <Link to="/devices/new" className="btn btn-primary"><PackagePlus size={18} />New device</Link>} />
      <div className="flex flex-wrap gap-3 mb-4">
        <input className="input max-w-xs" type="search" placeholder={user.role === "OWNER" ? "Search devices" : "Search a device or identifier"} aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input max-w-52" aria-label="Filter by state" value={status} onChange={(e) => setStatus(e.target.value)}>
          {Object.entries(STATUS).filter(([k]) => !["MAINTENANCE", "SOLD_FOR_PARTS", "DECOMMISSIONED"].includes(k)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {loading ? <Spinner /> : error ? <Notice tone="fail">{error}<button type="button" className="btn btn-secondary btn-sm mt-3" onClick={reload}>Retry</button></Notice>
        : data !== null && !Array.isArray(data) ? <Notice tone="fail">The device list response was invalid. Please retry.<button type="button" className="btn btn-secondary btn-sm mt-3" onClick={reload}>Retry</button></Notice>
        : items.length ? <DeviceRows items={items} me={user} showOwner={user.role === "ADMIN"} simple={user.role === "OWNER"} />
        : user.role === "OWNER"
          ? <Empty title={hasOwnerDevices ? "No results" : "No devices yet"} action={!hasOwnerDevices && <Link to="/devices/new" className="btn btn-primary">New device</Link>} />
          : <Empty title={q || status ? "No results" : "No devices yet"}>
              {q || status ? "Try adjusting your search or filter." : "Devices you buy will appear here."}</Empty>}
    </div>
  );
}
