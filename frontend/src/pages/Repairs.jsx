import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { get } from "../lib/api";
import { fmtDate, fmtPrice } from "../lib/format";
import { Badge, Empty, Notice, PageHeader, Spinner, useAsync } from "../components/ui";

export default function Repairs() {
  const { data, loading, error } = useAsync(() => get("/repairs"));
  return (
    <div>
      <PageHeader title="My repairs" lead="Every repair you sign adds to the device's history and your reputation."
        actions={null} />
      {loading ? <Spinner /> : error ? <Notice tone="fail">{error}</Notice> : !data.length
        ? <Empty title="No repair recorded">Open a device from My devices to record your first repair.</Empty>
        : (
          <ul className="panel divide-y divide-line-2 overflow-hidden">
            {data.map((r) => (
              <li key={r._id}>
                <Link to={`/passport/${r.product?.passportId}`} className="flex items-center gap-4 px-4 py-3.5 hover:bg-white/70">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.product?.brand} {r.product?.model}</p>
                    <p className="text-sm text-ink-2 truncate">{r.description}</p>
                    <p className="text-sm text-ink-2 mt-0.5">{fmtDate(r.date)}{r.changedParts?.length ? ` · ${r.changedParts.join(", ")}` : ""}{r.price != null ? ` · ${fmtPrice(r.price)}` : ""}</p>
                    <Badge tone={r.verificationDecision === "PROFESSIONALLY_ATTESTED" ? "ok" : r.verificationDecision === "REJECTED" ? "fail" : r.provenance?.verificationStatus === "EVIDENCE_SUBMITTED" ? "info" : "warn"}>{r.verificationDecision === "PROFESSIONALLY_ATTESTED" ? "Certified repairer" : r.verificationDecision === "REJECTED" ? "Rejected / unverified" : r.provenance?.verificationStatus === "EVIDENCE_SUBMITTED" ? "Evidence submitted" : "Owner declared"}</Badge>
                  </div>
                  <ChevronRight size={18} className="text-ink-2" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
