import { useMemo, useState } from "react";
import { BadgeCheck, UserCheck, UserX } from "lucide-react";
import { get, patch } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { ROLES } from "../../lib/labels";
import { Badge, Btn, Notice, PageHeader, Spinner, useAction, useAsync } from "../../components/ui";

const FILTERS = [["all", "All"], ["pending", "To validate"], ["REPAIRER", "Repairers"], ["BUYER", "Buyers"], ["OWNER", "Owners"]];

export default function Users() {
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useAsync(() => get("/admin/users"));
  const [filter, setFilter] = useState("all");
  const [go, busy] = useAction();

  const list = useMemo(() => (data || []).filter((u) => filter === "all" ? true : filter === "pending" ? !u.isVerified && u.role !== "OWNER" && u.role !== "ADMIN" : u.role === filter), [data, filter]);
  const pending = (data || []).filter((u) => !u.isVerified && ["REPAIRER", "BUYER"].includes(u.role)).length;
  const verify = async (u) => { if (await go(() => patch(`/admin/users/${u._id}/verify`), `${u.firstName} ${u.lastName} is verified`)) reload(); };
  const toggle = async (u) => { if (await go(() => patch(`/admin/users/${u._id}/status`, { isActive: !u.isActive }), u.isActive ? "Account deactivated" : "Account reactivated")) reload(); };

  return (
    <div>
      <PageHeader title="Users" lead="Validate repairers and buyers before they can use professional workflows." />
      {pending > 0 && <Notice tone="warn" className="mb-5">{pending} professional account{pending > 1 ? "s" : ""} awaiting verification.</Notice>}
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Filter users">
        {FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} aria-pressed={filter === k} className={`btn btn-sm ${filter === k ? "btn-primary" : "btn-secondary"}`}>{l}</button>)}
      </div>
      {loading ? <Spinner /> : error ? <Notice tone="fail">{error}</Notice> : (
        <ul className="panel divide-y divide-line-2">
          {list.map((u) => (
            <li key={u._id} className="px-4 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="min-w-0 flex-1 basis-60">
                <p className="font-semibold">{u.firstName} {u.lastName} {!u.isActive && <Badge tone="fail">Disabled</Badge>}</p>
                <p className="text-sm text-ink-2 truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2 basis-44">
                <span className="text-sm">{ROLES[u.role].label}</span>
                {u.role !== "ADMIN" && (u.isVerified ? <Badge tone="ok" icon={BadgeCheck}>Verified</Badge> : u.role === "OWNER" ? null : <Badge tone="warn">To validate</Badge>)}
              </div>
              <div className="flex gap-2">
                {!u.isVerified && u.role !== "ADMIN" && <Btn size="sm" busy={busy} onClick={() => verify(u)}><UserCheck size={15} />Verify</Btn>}
                {u.role !== "ADMIN" && u._id !== me.id && <Btn size="sm" variant="secondary" busy={busy} onClick={() => toggle(u)}>{u.isActive ? <><UserX size={15} />Disable</> : "Reactivate"}</Btn>}
              </div>
            </li>
          ))}
          {!list.length && <li className="px-4 py-8 text-center text-ink-2">No users in this category.</li>}
        </ul>
      )}
    </div>
  );
}
