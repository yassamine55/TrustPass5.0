import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { Badge, Btn, Modal, Notice, StatusBadge, useAction } from "./ui";
import { post } from "../lib/api";
import { displayName, fmtDate } from "../lib/format";
import { isPartsOnlyStatus } from "../lib/labels";

/* Liste d'appareils : lignes séparées par des filets, pas de cartes. */
export default function DeviceRows({ items, me, showOwner, action, marketplace = false, onChanged, simple = false }) {
  // Rows purchased in this session are hidden immediately, without waiting on the parent
  // page's own data refetch (onChanged, if given, still runs to keep server data in sync).
  const [purchasedIds, setPurchasedIds] = useState(() => new Set());
  const [buyTarget, setBuyTarget] = useState(null);
  const visibleItems = items.filter((p) => !purchasedIds.has(p._id));
  const canBuy = (p) => marketplace && me?.role === "BUYER" && me?.isVerified && p.owner?._id !== me?.id;

  return (
    <>
      <ul className="panel divide-y divide-line-2 overflow-hidden">
        {visibleItems.map((p) => (
          <li key={p._id} className="flex items-center gap-2 pr-3 hover:bg-white/70">
            <Link to={`/passport/${p.passportId}`} className={`relative flex-1 min-w-0 px-4 pr-10 py-3.5 ${simple ? "flex flex-col items-start gap-1.5" : "flex flex-wrap items-center gap-x-5 gap-y-1.5"}`}>
              <div className={simple ? "min-w-0 w-full" : "min-w-0 basis-56 grow"}>
                <p className="font-semibold text-[1.02rem] truncate">{p.brand} {p.model}</p>
                {simple
                  ? <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink-2"><span>{p.category}</span><StatusBadge status={p.status} /><StolenBadge report={p.stolenReport} /></div>
                  : <p className="text-sm text-ink-2"><span className="mono">{p.passportId}</span> · {p.category}</p>}
              </div>
              {!simple && showOwner && <p className="text-sm text-ink-2 basis-32">{displayName(p.owner, me)}</p>}
              {!simple && <p className="text-sm text-ink-2 hidden md:block basis-28">{fmtDate(p.createdAt)}</p>}
              {!simple && (marketplace ? <MarketplaceTrust product={p} /> : <div className="flex flex-wrap gap-1.5"><StolenBadge report={p.stolenReport} /><StatusBadge status={p.status} /></div>)}
              {!action && !canBuy(p) && <ChevronRight size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-2" aria-hidden />}
            </Link>
            {action
              ? action(p)
              : canBuy(p)
                ? <Btn size="sm" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setBuyTarget(p); }}>
                    <ShoppingBag size={15} />{p.status === "LISTED_FOR_PARTS" ? "Buy for parts" : "Buy"}
                  </Btn>
                : null}
          </li>
        ))}
      </ul>
      <BuyRowModal
        product={buyTarget}
        me={me}
        onClose={() => setBuyTarget(null)}
        onPurchased={(id) => {
          setPurchasedIds((current) => new Set(current).add(id));
          setBuyTarget(null);
          onChanged?.();
        }}
      />
    </>
  );
}

function BuyRowModal({ product, me, onClose, onPurchased }) {
  const [go, busy] = useAction();
  if (!product) return null;
  const partsOnly = isPartsOnlyStatus(product.status);
  const price = product.listingPrice != null ? new Intl.NumberFormat("en-US").format(product.listingPrice) : null;
  const send = async () => {
    const r = await go(() => post("/transfers", { product: product._id, toOwner: me.id }), "Purchase complete. This device is now yours.");
    if (r) onPurchased(product._id);
  };
  return (
    <Modal open={Boolean(product)} onClose={onClose} title={partsOnly ? "Buy for parts" : "Buy this device"}>
      {partsOnly
        ? <p className="font-semibold">This device is sold for parts and is not represented as a working device.</p>
        : <p className="font-semibold">Buy {product.brand} {product.model}{price ? ` for ${price} TND` : ""}?</p>}
      <p className="mt-3 text-ink-2 text-[0.95rem]">This completes immediately — ownership transfers to your account.</p>
      <div className="flex justify-end gap-2 mt-6"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn busy={busy} onClick={send}>Confirm purchase</Btn></div>
    </Modal>
  );
}

function MarketplaceTrust({ product }) {
  const partsOnly = isPartsOnlyStatus(product.status);
  const technicallyVerified = !partsOnly && product.technicalInspection?.status === "TECHNICALLY_VERIFIED";
  const certifiedRepairs = product.certifiedRepairCount || 0;
  const diagnosisReason = product.technicalInspection?.diagnosis?.reason;
  const evidenceAvailable = Boolean(product.documentId || product.technicalInspection?.report?.evidenceDocuments?.length || product.technicalInspection?.report?.evidenceHash);
  const condition = product.currentCondition || (partsOnly ? null : "Condition details in passport");
  const price = product.listingPrice != null ? new Intl.NumberFormat("en-US").format(product.listingPrice) : null;
  return <div className="flex min-w-44 flex-wrap items-center justify-end gap-1.5">
    {price && <p className="mr-2 font-display text-lg font-bold tabular-nums">{price} TND</p>}
    <StolenBadge report={product.stolenReport} />
    {partsOnly ? <><Badge tone="warn">END OF LIFE</Badge><Badge tone="warn">FOR PARTS ONLY</Badge></> : <Badge tone="info">USED DEVICE</Badge>}
    <div className="w-full text-right text-xs leading-relaxed text-ink-2">
      {condition && <p>Condition: {condition}</p>}
      {diagnosisReason && <p>Known issue: {diagnosisReason}</p>}
      {technicallyVerified && <p>Technical inspection verified</p>}
      {certifiedRepairs > 0 && <p>{certifiedRepairs} certified repair{certifiedRepairs === 1 ? "" : "s"}</p>}
      {evidenceAvailable && <p>Evidence available</p>}
      <p>TrustPass history available</p>
    </div>
  </div>;
}

function StolenBadge({ report }) {
  if (!report?.status || report.status === "NONE") return null;
  return <Badge tone="fail">{report.status === "AUTHORITY_VERIFIED" ? "AUTHORITY VERIFIED STOLEN" : "OWNER REPORTED STOLEN"}</Badge>;
}
