import { Link } from "react-router-dom";
import { get } from "../lib/api";
import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { Empty, Notice, PageHeader, Spinner, useAsync } from "../components/ui";
import DeviceRows from "../components/DeviceRows";

export default function Parts() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => get("/passports"));
  const [saleType, setSaleType] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const categories = [...new Set((data || []).map((p) => p.category).filter(Boolean))].sort();
  const items = useMemo(() => (data || []).filter((p) => {
    if (p.owner?._id === user.id || !["ACTIVE", "MAINTENANCE", "LISTED_FOR_PARTS"].includes(p.status)) return false;
    if (p.listingPrice == null && p.status !== "LISTED_FOR_PARTS") return false;
    if (saleType === "USED" && p.status === "LISTED_FOR_PARTS") return false;
    if (saleType === "PARTS" && p.status !== "LISTED_FOR_PARTS") return false;
    if (category !== "ALL" && p.category !== category) return false;
    return `${p.brand} ${p.model} ${p.passportId}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [data, user.id, saleType, category, query]);
  return (
    <div>
      <PageHeader title="Marketplace" lead="Compare used devices and parts-only listings with transparent history." />
      {!user.isVerified && <Notice tone="warn" className="mb-5">Your account must be validated by an administrator before any purchase.</Notice>}
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input className="input" type="search" placeholder="Search phones, laptops, or device IDs" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input" aria-label="Sale type" value={saleType} onChange={(e) => setSaleType(e.target.value)}><option value="ALL">All devices</option><option value="USED">Used devices</option><option value="PARTS">For parts</option></select>
        <select className="input" aria-label="Device type" value={category} onChange={(e) => setCategory(e.target.value)}><option value="ALL">All types</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
      </div>
      {loading ? <Spinner /> : error ? <Notice tone="fail">{error}</Notice> : items.length ? <DeviceRows items={items} me={user} marketplace onChanged={reload} />
        : <Empty title="No matching devices">Try another search or marketplace filter.</Empty>}
    </div>
  );
}
