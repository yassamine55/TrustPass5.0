import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { get, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { fmtDate } from "../lib/format";
import { Badge, Btn, Empty, Notice, PageHeader, Spinner, useAction, useAsync } from "../components/ui";
import { isPartsOnlyStatus } from "../lib/labels";

const ST = { PENDING: ["warn", "Pending"], ACCEPTED: ["ok", "Accepted"], REJECTED: ["fail", "Rejected"] };
const who = (u, me) => (u?._id === me.id ? "You" : `${u?.firstName} ${u?.lastName}`);

export function purchasePriceLabel(purchase) {
  const price = purchase?.price ?? purchase?.product?.listingPrice;
  return price != null
    ? `${new Intl.NumberFormat("en-US").format(price)} TND`
    : "Price not listed";
}

export default function Transfers() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => get("/transfers/mine"));
  const [go, busy] = useAction();
  const accept = async (t) => { if (await go(() => post(`/transfers/${t._id}/accept`), "Purchase completed. Ownership confirmed.")) reload(); };

  const incoming = (data || []).filter((t) => t.status === "PENDING" && t.toOwner?._id === user.id);
  const rest = (data || []).filter((t) => !incoming.includes(t));

  if (user.role === "BUYER") {
    return <BuyerPurchases incoming={incoming} purchases={rest} accept={accept} busy={busy} />;
  }

  const row = (t, acceptable) => (
    <li key={t._id} className="px-4 py-4 flex flex-wrap items-center gap-x-6 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <Link to={`/passport/${t.product?.passportId}`} className="font-semibold hover:underline">{t.product?.brand} {t.product?.model}</Link>
        <p className="text-sm text-ink-2 flex items-center gap-1.5 flex-wrap mt-0.5">{who(t.fromOwner, user)}<ArrowRight size={14} aria-hidden />{who(t.toOwner, user)}<span>· {fmtDate(t.requestedAt || t.createdAt)}</span></p>
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={ST[t.status][0]}>{ST[t.status][1]}</Badge>
        {acceptable && <Btn size="sm" busy={busy} onClick={() => accept(t)}>Accept</Btn>}
      </div>
    </li>
  );

  return (
    <div>
      <PageHeader title={user.role === "BUYER" ? "Purchases and transfers" : "Transfers"} lead="A transfer takes place only if both parties agree." />
      {loading ? <Spinner /> : error ? <Notice tone="fail">{error}</Notice> : (
        <div className="space-y-8">
          {incoming.length > 0 && <section><h2 className="text-xl font-semibold mb-3">To accept</h2><ul className="panel divide-y divide-line-2 border-gilt">{incoming.map((t) => row(t, true))}</ul></section>}
          <section>
            <h2 className="text-xl font-semibold mb-3">History</h2>
            {rest.length ? <ul className="panel divide-y divide-line-2">{rest.map((t) => row(t, false))}</ul>
              : <Empty title="No transfers">{user.role === "OWNER" ? "To sell a device, open its passport and choose Sell or transfer." : "The purchases you make will appear here."}</Empty>}
          </section>
        </div>
      )}
    </div>
  );
}

function BuyerPurchases({ incoming, purchases, accept, busy }) {
  return <div className="mx-auto max-w-4xl space-y-7">
    <PageHeader title="Purchases" lead="View the devices you've bought and their ownership history." />
    {incoming.length > 0 && <section aria-labelledby="pending-purchases-title"><h2 id="pending-purchases-title" className="mb-3 text-xl font-semibold">Purchases to accept</h2><ul className="space-y-3">{incoming.map((purchase) => <PurchaseRow key={purchase._id} purchase={purchase} pending accept={accept} busy={busy} />)}</ul></section>}
    <section aria-labelledby="purchase-history-title"><div className="flex items-baseline justify-between gap-4 mb-3"><h2 id="purchase-history-title" className="text-xl font-semibold">Purchase history</h2><span className="text-sm text-ink-2">{purchases.length} purchase{purchases.length === 1 ? "" : "s"}</span></div>{purchases.length ? <ul className="space-y-3">{purchases.map((purchase) => <PurchaseRow key={purchase._id} purchase={purchase} />)}</ul> : <Empty title="No purchases yet" action={<Link to="/parts" className="btn btn-primary">Browse marketplace</Link>}>Devices you buy will appear here.</Empty>}</section>
  </div>;
}

function PurchaseRow({ purchase, pending, accept, busy }) {
  const product = purchase.product || {};
  const parts = isPartsOnlyStatus(product.status);
  const price = purchasePriceLabel(purchase);
  const date = purchase.acceptedAt || purchase.createdAt;
  return <article className="rounded-xl border border-line-2 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><Link to={`/passport/${product.passportId}`} className="text-lg font-semibold hover:text-petrol">{product.brand} {product.model}</Link><p className="mt-1 text-sm text-ink-2">{product.category || "Device"}{product.currentCondition ? ` · ${product.currentCondition}` : ""}</p></div><p className="font-display text-xl font-bold tabular-nums">{price}</p></div><div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-2"><span>{pending ? "Purchase pending" : `Purchased ${fmtDate(date)}`}</span><Badge tone={parts ? "warn" : "info"}>{parts ? "Parts purchase" : "Used device"}</Badge>{pending ? <Badge tone="warn">Awaiting acceptance</Badge> : <Badge tone="ok">Ownership confirmed</Badge>}</div><div className="mt-4 flex flex-wrap justify-end gap-2">{pending && <Btn size="sm" busy={busy} onClick={() => accept(purchase)}>Accept purchase</Btn>}<Link to={`/passport/${product.passportId}`} className="btn btn-secondary btn-sm">View passport</Link></div></article>;
}
