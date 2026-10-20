import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftRight, Hammer, Laptop, ShieldCheck, ShoppingBag, ShieldAlert, Store, Wrench } from "lucide-react";
import { errorMessage, get, patch, post } from "../lib/api";
import { useAuth } from "../lib/auth";
import { displayName, fmtDate, fmtDateTime, shortHash } from "../lib/format";
import { getDevicePhotoPlaceholderLabel, getDevicePhotoUrl } from "../lib/devicePhoto";
import { isPartsOnlyStatus, statusLabel } from "../lib/labels";
import { Badge, Btn, CopyButton, DL, Empty, Field, Modal, Notice, Spinner, StatusBadge, useAction, useAsync } from "../components/ui";
import Plate from "../components/Plate";
import Timeline from "../components/Timeline";
import RouteErrorBoundary from "../components/RouteErrorBoundary";

const today = () => new Date().toISOString().slice(0, 10);

export default function Passport() {
  const { passportId } = useParams();
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => get(`/public/passport/${passportId}`), [passportId]);
  const [modal, setModal] = useState(null);
  const [confirmationRepair, setConfirmationRepair] = useState(null);
  const [attestationRepair, setAttestationRepair] = useState(null);
  const [requestInspection, requestBusy] = useAction();
  const [unlist, unlistBusy] = useAction();
  const [photoFailed, setPhotoFailed] = useState(false);

  const photoUrl = data?.passport ? getDevicePhotoUrl(data.passport) : null;

  if (loading && !data) return <Spinner label="Loading passport" />;
  if (error) return <Empty title="Passport could not be loaded">
    <span role="alert">{error}</span>
    <span className="mt-2 block">Check your connection and try loading the passport again.</span>
    <Btn className="mt-4" variant="secondary" onClick={reload}>Retry</Btn>
  </Empty>;
  if (!data?.passport) return <Spinner label="Loading passport" />;

  const p = data.passport;
  const events = Array.isArray(data.events) ? data.events : [];
  const repairs = Array.isArray(data.repairs) ? data.repairs : [];
  const mine = user && p.owner?._id === user.id;
  const verified = user?.isVerified;
  const active = ["ACTIVE", "MAINTENANCE"].includes(p.status);
  const listed = p.listingPrice != null;
  const endOfLifeEvent = events.find((event) => event.type === "END_OF_LIFE");
  const ownerEndOfLife = user?.role === "OWNER" && mine && ["END_OF_LIFE", "LISTED_FOR_PARTS"].includes(p.status) && endOfLifeEvent;
  const ownershipTransfers = events.filter((event) => ["PURCHASED", "TRANSFERRED", "RESALE", "SOLD_FOR_PARTS"].includes(event.type)).length;

  const actions = [];
  if (user) {
    if (user.role === "REPAIRER" && verified && active) {
      actions.push(<Link key="rep" to={`/repairs/new?passport=${p.passportId}`} className="btn btn-primary"><Wrench size={17} />Record a repair</Link>);
      actions.push(<Btn key="mnt" variant="secondary" onClick={() => setModal("maintenance")}><Hammer size={17} />Maintenance</Btn>);
    }
    if (user.role === "OWNER" && mine && active) {
      actions.push(<Btn key="trf" onClick={() => setModal("transfer")}><ArrowLeftRight size={17} />Sell or transfer</Btn>);
      if (listed) actions.push(<Btn key="unlist" variant="secondary" busy={unlistBusy} onClick={async () => { const r = await unlist(() => patch(`/passports/${p._id}/listing`, { action: "UNLIST" }), "Device removed from the marketplace"); if (r) reload(); }}><Store size={17} />Remove from marketplace</Btn>);
      else actions.push(<Btn key="list" variant="secondary" onClick={() => setModal("list-sale")}><Store size={17} />List on marketplace</Btn>);
      if (!p.stolenReport?.status || p.stolenReport.status === "NONE") actions.push(<Btn key="stolen" variant="danger" onClick={() => setModal("stolen")}><ShieldAlert size={17} />Report stolen</Btn>);
      actions.push(<Link key="claim" to={`/repairs/claim?passport=${p.passportId}`} className="btn btn-secondary"><Wrench size={17} />Send repair request</Link>);
      actions.push(<Btn key="mnt" variant="secondary" onClick={() => setModal("maintenance")}><Hammer size={17} />Record maintenance</Btn>);
      repairs.filter((repair) => repair.ownerConfirmation?.status === "PENDING").forEach((repair) => {
        actions.push(<Btn key={`confirm-${repair._id}`} variant="secondary" onClick={() => setConfirmationRepair(repair)}>Review repair</Btn>);
      });
    }
    if (user.role === "REPAIRER" && verified) {
      repairs.filter((repair) => repair.repairer?._id === user.id && repair.provenance?.verificationStatus !== "PROFESSIONALLY_ATTESTED").forEach((repair) => {
        actions.push(<Btn key={`attest-${repair._id}`} variant="secondary" onClick={() => setAttestationRepair(repair)}>Professionally attest repair</Btn>);
      });
    }
    if (p.status === "END_OF_LIFE" && user.role === "REPAIRER" && verified) {
      actions.push(<span key="eol-repairer" className="text-sm text-ink-2">End-of-life decision recorded</span>);
    }
    if (user.role === "BUYER" && verified && !mine && (p.status === "LISTED_FOR_PARTS" || (active && listed)))
      actions.push(<Btn key="buy" onClick={() => setModal("buy")}><ShoppingBag size={17} />{p.status === "LISTED_FOR_PARTS" ? "Buy for parts" : "Buy this device"}</Btn>);
  }
  const close = () => setModal(null);
  const done = () => { close(); reload(); };
  const inspection = p.technicalInspection;
  const canRequestInspection = user?.role === "OWNER" && mine && (
    inspection?.status === "NOT_REQUESTED" ||
    (inspection?.status === "REJECTED" && inspection.requestDecision?.action === "REJECT")
  );
  const inspectionStatusLabel = {
    REQUESTED: inspection?.reviewStatus === "ADDITIONAL_EVIDENCE_REQUIRED" ? "Additional evidence requested from repairer" : inspection?.assignedRepairer ? "Assigned to a repairer" : "Waiting for admin assignment",
    IN_PROGRESS: "Inspection in progress",
    COMPLETED: "Report waiting for admin review",
    TECHNICALLY_VERIFIED: "Inspection approved",
    REJECTED: inspection?.requestDecision?.action === "REJECT" ? "Request rejected" : "Report rejected"
  }[inspection?.status];
  const askForInspection = async () => {
    const result = await requestInspection(() => post(`/passports/${p._id}/technical-inspection-request`), "Technical inspection requested");
    if (result) reload();
  };

  return (
    <div className="space-y-6">
      <Plate title={p.model} subtitle={`${p.brand} · ${p.category}`} passportId={p.passportId} status={p.status} />
      <StolenWarning report={p.stolenReport} />
      {ownerEndOfLife && <EndOfLifeOwnerNotice event={endOfLifeEvent} canList={p.status === "END_OF_LIFE"} onList={() => setModal("list")} />}

      {(inspectionStatusLabel || canRequestInspection) && <section className="panel p-5 border-petrol" aria-labelledby="inspection-request-title">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">Independent review</p><h2 id="inspection-request-title" className="mt-1 text-xl font-bold">{inspectionStatusLabel || "Request Technical Inspection"}</h2><p className="mt-1 text-ink-2">A verified repairer performs the physical inspection. The administrator assigns the request and reviews the report submitted from the repairer's authenticated account.</p>
            {inspection?.requestedAt && <p className="mt-1 text-sm text-ink-2">Requested {fmtDate(inspection.requestedAt)}</p>}
            {inspection?.requestDecision?.action === "REJECT" && inspection.requestDecision.note && <p className="mt-2 text-sm"><strong>Admin reason:</strong> {inspection.requestDecision.note}</p>}
            {inspection?.reviewNote && inspection.reviewStatus === "REJECTED" && <p className="mt-2 text-sm"><strong>Admin report review:</strong> {inspection.reviewNote}</p>}
          </div>
          {canRequestInspection && <Btn onClick={askForInspection} busy={requestBusy}>{inspection?.status === "REJECTED" ? "Request again" : "Request inspection"}</Btn>}
        </div>
      </section>}

      <section className="panel overflow-hidden" aria-labelledby="identity-title">
        <div className="grid lg:grid-cols-[minmax(15rem,42%)_1fr]">
          <div className="min-h-64 bg-board">
            {(p.photo || photoUrl) && !photoFailed ? <img src={photoUrl || ""} alt={`${p.brand} ${p.model}`} onError={() => setPhotoFailed(true)} className="h-full min-h-64 w-full object-contain" /> : (
              <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-center text-ink-2"><div className="grid h-14 w-14 place-items-center rounded-full bg-surface text-ink"><Laptop size={26} /></div><div><p className="font-semibold text-ink">{getDevicePhotoPlaceholderLabel(p)}</p><p className="text-sm">No device photo available</p></div></div>
            )}
          </div>
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <SectionHeading id="identity-title" eyebrow="1 / Device identity" title="Device identity" />
            </div>
            <IdentityDetails product={p} />
            {(p.company || p.documentId?.claimType === "DEVICE_CERTIFICATE") && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {p.company && <Claim label="Company" value={p.company.name} state={p.company.isVerified ? "ADMIN VERIFIED" : "NOT VERIFIED"} tone={p.company.isVerified ? "ok" : "warn"} />}
              {p.documentId?.claimType === "DEVICE_CERTIFICATE" && <Claim label="Device certificate" value={p.documentId.originalName || "Certificate submitted"} state={p.documentId.adminReview?.status === "APPROVED" ? "ADMIN APPROVED" : p.documentId.adminReview?.status === "REJECTED" ? "REJECTED" : "PENDING ADMIN REVIEW"} tone={p.documentId.adminReview?.status === "APPROVED" ? "ok" : p.documentId.adminReview?.status === "REJECTED" ? "fail" : "info"} />}
            </div>}
            <p className="mt-4 text-sm text-ink-2">Identity claims are shown with their source. A protected fingerprint confirms that a value is stored without exposing the raw identifier.</p>
            {p.description && <div className="mt-4 border-t border-line-2 pt-4"><p className="text-sm text-ink-2">Description</p><p className="mt-1">{p.description}</p></div>}
          </div>
        </div>
      </section>

      <section className="panel p-6" aria-labelledby="ownership-title">
        <SectionHeading id="ownership-title" eyebrow="2 / Current ownership" title="Current ownership" />
        {listed && <p className="mt-3"><Badge tone="info">Listed on marketplace · {new Intl.NumberFormat("en-US").format(p.listingPrice)} TND</Badge></p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Claim label="Current owner" value={displayName(p.owner, user)} state="CURRENT OWNER" tone="info" />
            <Claim label="Device status" value={statusLabel(p.status)} state="RECORDED STATUS" tone="grey" />
          <Claim label="Ownership history" value={`${ownershipTransfers} recorded ${ownershipTransfers === 1 ? "transfer" : "transfers"}`} state="LIFECYCLE RECORD" tone="info" />
        </div>
      </section>

      <TechnicalConditionSection product={p} />

      <section className="panel p-6" aria-labelledby="repair-history-title">
        <SectionHeading id="repair-history-title" eyebrow="5 / Repair history" title="Repair history" />
        <div className="mt-5"><RepairHistory repairs={repairs} /></div>
      </section>

      <EvidenceSection product={p} repairs={repairs} events={events} me={user} />
      <VerificationStatusSection product={p} repairs={repairs} />

      {["RECYCLED", "DECOMMISSIONED"].includes(p.status) && <Notice tone="info" title="Closed passport">This device has left the circuit: its history remains visible, but it will no longer evolve.</Notice>}

      {actions.length > 0 && <section className="panel p-6" aria-labelledby="actions-title"><SectionHeading id="actions-title" eyebrow="Manage" title="Actions" /><div className="mt-4 flex flex-wrap gap-2.5" role="group" aria-label="Actions for this device">{actions}</div></section>}

      <section className="panel p-6" aria-labelledby="passport-history-title">
        <SectionHeading id="passport-history-title" eyebrow="Passport history" title="Recorded events" />
        <div className="mt-5"><Timeline events={events} repairs={repairs} me={user} /></div>
      </section>

      {user && user.role === "OWNER" && !mine && <p className="text-sm text-ink-2">This device belongs to another user: you are viewing it in read-only mode.</p>}
      {user?.role === "OWNER" && mine && <RouteErrorBoundary key={p.passportId} fallbackMessage="Preuve Hedera indisponible" showReload={false}><HederaProof product={p} /></RouteErrorBoundary>}

      <TextModal open={modal === "maintenance"} onClose={close} title="Record maintenance" label="What was done" withDate submit="Save"
        run={(f) => post("/maintenance", { product: p._id, description: f.description, date: f.date })} onDone={done} success="Maintenance recorded" />
      <TextModal open={modal === "list"} onClose={close} title="List for parts" label="Description for buyers" withPrice submit="List"
        run={(f) => post(`/products/${p._id}/events`, { type: "LISTED_FOR_PARTS", description: f.description, price: f.price })} onDone={done} success="Device listed for parts" />
      <TextModal open={modal === "stolen"} onClose={close} title="Report device as stolen" label="Details for the report" submit="Report stolen" danger
        intro="This creates an owner-reported stolen event. TrustPass does not independently verify theft without an authority or partner integration."
        run={(f) => post(`/passports/${p._id}/stolen-report`, { note: f.description })} onDone={done} success="Stolen report recorded" />
      <ListingModal open={modal === "list-sale"} onClose={close} product={p} onDone={done} />
      <TransferModal open={modal === "transfer"} onClose={close} product={p} user={user} onDone={done} />
      <BuyModal open={modal === "buy"} onClose={close} product={p} user={user} onDone={done} />
      <RepairConfirmationModal repair={confirmationRepair} onClose={() => setConfirmationRepair(null)} onDone={() => { setConfirmationRepair(null); reload(); }} />
      <ProfessionalAttestationModal repair={attestationRepair} onClose={() => setAttestationRepair(null)} onDone={() => { setAttestationRepair(null); reload(); }} />
    </div>
  );
}

function HederaProof({ product }) {
  const [proof, setProof] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [anchorError, setAnchorError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [result, setResult] = useState(null);
  const endpoint = `/passports/${product._id}/hedera-proof`;

  const loadProof = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const response = await get(endpoint);
      setProof({
        ...(response.proof || {}),
        localHash: response.localHash,
        history: response.history || [],
        needsReanchor: response.needsReanchor,
        network: response.network || "testnet"
      });
      setResult(null);
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProof();
  }, [endpoint]);

  const compare = async () => {
    setBusy(true);
    setVerifyError("");
    setResult(null);
    const startedAt = Date.now();
    try {
      const [response] = await Promise.all([
        post(`${endpoint}/verify`, {}),
        new Promise((resolve) => setTimeout(resolve, Math.max(0, 1000 - (Date.now() - startedAt))))
      ]);
      setResult(response);
      setProof((current) => current ? { ...current, consensusTimestamp: response.consensusTimestamp || current.consensusTimestamp } : current);
    } catch (error) {
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 1000 - (Date.now() - startedAt))));
      setVerifyError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const retryAnchor = async () => {
    setAnchorBusy(true);
    setAnchorError("");
    try {
      const response = await post(`${endpoint}/retry`, {});
      setProof({
        ...response.proof,
        localHash: response.localHash,
        history: response.history || [],
        needsReanchor: response.needsReanchor,
        network: response.network
      });
      setResult(null);
    } catch (error) {
      setAnchorError(errorMessage(error));
    } finally {
      setAnchorBusy(false);
    }
  };

  const network = proof?.network || "testnet";
  const localHash = stringValue(result?.localHash) || stringValue(proof?.localHash) || stringValue(proof?.hash);
  const chainHash = stringValue(result?.onChainHash) || stringValue(proof?.hash);
  const transactionId = stringValue(proof?.transactionId);
  const topicId = stringValue(proof?.topicId);
  const sequenceNumber = proof?.sequenceNumber ?? null;
  const consensusTimestamp = formatConsensusTimestamp(proof?.consensusTimestamp);
  const hashscanUrl = transactionId
    ? `https://hashscan.io/${encodeURIComponent(network)}/transaction/${encodeURIComponent(transactionId)}`
    : null;

  return <section className="panel p-6" aria-labelledby="hedera-proof-title">
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-petrol-tint text-petrol"><ShieldCheck size={21} aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">8 / Public proof</p>
        <h2 id="hedera-proof-title" className="mt-1 text-xl font-bold">Hedera Proof</h2>
      </div>
      {!loading && proof?.status && <Badge tone={proof.status === "CONFIRMED" ? "ok" : proof.status === "FAILED" ? "fail" : "warn"}>{proof.status}</Badge>}
    </div>

    {loading ? <p className="mt-5 text-sm text-ink-2">Loading the passport proof…</p>
      : loadError ? <Notice tone="fail" title="Proof could not be loaded" className="mt-5">
          <p>{loadError}</p><Btn className="mt-3" size="sm" variant="secondary" onClick={loadProof}>Retry</Btn>
        </Notice>
      : proof?.status !== "CONFIRMED" || !transactionId || !topicId || sequenceNumber == null ? <Notice tone={proof?.status === "FAILED" ? "fail" : "warn"} className="mt-5">
          <p>{proof?.status === "FAILED" ? "This passport could not be anchored on Hedera. Its passport data is still available in TrustPass." : "Pas encore ancré sur Hedera"}</p>
          <Btn className="mt-3" size="sm" variant="secondary" busy={anchorBusy} onClick={retryAnchor}>Retry Hedera anchoring</Btn>
          {anchorError && <p className="mt-2 text-sm text-fail" role="alert">{anchorError}</p>}
        </Notice>
      : proof.schemaVersion !== 2 || !proof.payload ? <Notice tone="warn" title="Legacy Hedera proof" className="mt-5">
          <p>This proof was created before versioned snapshots were stored. Its original data snapshot is unavailable, so it cannot be reliably compared with the current passport.</p>
          <Btn className="mt-3" size="sm" variant="secondary" busy={anchorBusy} onClick={retryAnchor}>Anchor current passport version</Btn>
          {anchorError && <p className="mt-2 text-sm text-fail" role="alert">{anchorError}</p>}
        </Notice>
      : <>
        <div className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <ProofDetail label="Transaction ID" value={transactionId} />
          <ProofDetail label="Topic ID" value={topicId} />
          <ProofDetail label="Sequence number" value={sequenceNumber} />
          <ProofDetail label="Consensus timestamp" value={consensusTimestamp || "Awaiting Mirror Node indexing"} />
        </div>
        {hashscanUrl && <a href={hashscanUrl} target="_blank" rel="noreferrer noopener" className="link mt-4 inline-flex items-center gap-1">Voir la preuve sur HashScan ↗</a>}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <HashValue label="Hash local" hash={localHash} />
          <HashValue label="Hash enregistré sur Hedera" hash={chainHash} changed={Boolean(result && !result.matches)} />
        </div>

        <Btn className="mt-5 w-full sm:w-auto" onClick={compare} busy={busy}>Compare with Hedera</Btn>
        {result && <Notice tone={result.matches ? "ok" : "fail"} title={result.matches
          ? `✅ Authentique — non modifié depuis le ${formatConsensusTimestamp(result.consensusTimestamp) || "consensus Hedera"}`
          : "❌ Données modifiées après l'ancrage — le hash ne correspond plus"} className="mt-4">
          {!result.matches && <p className="mono break-all text-xs">Local: {result.localHash}<br />Hedera: {result.onChainHash}</p>}
          {!result.matches && <Btn className="mt-3" size="sm" variant="secondary" busy={anchorBusy} onClick={retryAnchor}>Anchor current passport version</Btn>}
        </Notice>}
        {verifyError && <Notice tone="fail" title="Verification failed" className="mt-4">
          <p>{verifyError}</p><Btn className="mt-3" size="sm" variant="secondary" busy={busy} onClick={compare}>Retry comparison</Btn>
        </Notice>}
      </>}
    {proof?.history?.length > 0 && <div className="mt-5 border-t border-line-2 pt-4">
      <h3 className="text-sm font-semibold">Previous Hedera proofs</h3>
      <ol className="mt-3 space-y-2">
        {[...proof.history].reverse().map((entry, index) => {
          const url = entry.transactionId
            ? `https://hashscan.io/${encodeURIComponent(network)}/transaction/${encodeURIComponent(entry.transactionId)}`
            : null;
          return <li key={`${entry.transactionId || entry.hash || "proof"}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line-2 p-3 text-sm">
            <span>{entry.reason || "Previous passport proof"} · {formatConsensusTimestamp(entry.consensusTimestamp) || "Timestamp unavailable"}</span>
            {url ? <a className="link" href={url} target="_blank" rel="noreferrer noopener">HashScan ↗</a> : <span>{shortHash(entry.hash, 4)}</span>}
          </li>;
        })}
      </ol>
    </div>}
    {proof && <p className="mt-4 text-xs text-ink-2">Coût de l’ancrage : ~0,0001 $ · Finalité ≈ 3 s · Réseau Hedera {network}</p>}
  </section>;
}

function stringValue(value) {
  return typeof value === "string" && value.length ? value : null;
}

function formatConsensusTimestamp(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const timestamp = value.trim();
  const hederaTimestamp = timestamp.match(/^(\d+)(?:\.(\d+))?$/);
  const date = hederaTimestamp
    ? new Date(Number(hederaTimestamp[1]) * 1000 + Number(`0.${hederaTimestamp[2] || "0"}`) * 1000)
    : new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : fmtDateTime(date);
}

function ProofDetail({ label, value }) {
  return <div className="min-w-0"><p className="text-xs text-ink-2">{label}</p><p className="mt-1 break-all text-sm font-medium mono">{value || "—"}</p></div>;
}

function HashValue({ label, hash, changed = false }) {
  const safeHash = stringValue(hash);
  return <div className={`min-w-0 rounded-lg border p-3 ${changed ? "border-fail bg-fail-tint/60" : "border-line-2 bg-white/50"}`}>
    <p className="text-xs font-semibold text-ink-2">{label}</p>
    <div className="mt-2 flex min-w-0 items-center gap-2">
      <span className="mono min-w-0 flex-1 truncate text-sm" title={safeHash || ""}>{shortHash(safeHash, 4)}</span>
      {safeHash && <CopyButton text={safeHash} label={`Copy ${label}`} />}
    </div>
  </div>;
}

function StolenWarning({ report }) {
  if (!report?.status || report.status === "NONE") return null;
  const authorityVerified = report.status === "AUTHORITY_VERIFIED";
  return <section className="rounded-xl border-2 border-fail bg-fail-tint p-5" role="alert" aria-labelledby="stolen-warning-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-fail">Safety warning</p><h2 id="stolen-warning-title" className="mt-1 text-xl font-bold">Device reported stolen</h2></div><Badge tone="fail">{authorityVerified ? "AUTHORITY/PARTNER VERIFIED STOLEN" : "OWNER REPORTED STOLEN"}</Badge></div>
    <p className="mt-3 text-sm leading-relaxed">{authorityVerified ? "A trusted authority or partner has verified this stolen report." : "The current owner reported this device as stolen. TrustPass has not independently verified the report."}</p>
    {report.note && <p className="mt-2 text-sm"><strong>Report details:</strong> {report.note}</p>}
    <p className="mt-3 text-xs text-fail">This warning is part of the device history and is not silently removed.</p>
  </section>;
}

function EndOfLifeOwnerNotice({ event, canList, onList }) {
  const repairer = event.actor ? `${event.actor.firstName || ""} ${event.actor.lastName || ""}`.trim() : "Unknown repairer";
  return <section className="rounded-xl border border-gilt bg-gilt-tint/45 p-5" aria-labelledby="owner-end-of-life-title">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-gilt-ink">Lifecycle decision</p>
        <h2 id="owner-end-of-life-title" className="mt-1 text-xl font-bold">Your device has been marked end of life.</h2>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="text-ink-2">Repairer</dt><dd>{repairer}</dd>
          <dt className="text-ink-2">Reason</dt><dd>{event.description || "Not provided"}</dd>
        </dl>
        <p className="mt-4 font-semibold">This device can now only be sold for parts.</p>
      </div>
      {canList && <Btn onClick={onList}><Store size={17} />List for parts</Btn>}
    </div>
  </section>;
}

function IdentityDetails({ product }) {
  const inspection = product.technicalInspection?.checklist || [];
  const inspectionApproved = product.technicalInspection?.status === "TECHNICALLY_VERIFIED";
  const stateFor = (ids) => {
    const item = inspection.find((entry) => ids.includes(entry.itemId));
    return inspectionApproved && item?.status === "PASS" ? "MATCHED BY INSPECTION" : "OWNER DECLARED";
  };
  return <div className="mt-5 grid gap-3 sm:grid-cols-2">
    <Claim label="Manufacturer / model" value={`${product.manufacturer || product.brand} ${product.model}`} state={stateFor(["model"])} tone={stateFor(["model"]) === "MATCHED BY INSPECTION" ? "ok" : "warn"} />
    <Claim label="Serial" value="Protected fingerprint" state={stateFor(["serialNumber"])} tone={stateFor(["serialNumber"]) === "MATCHED BY INSPECTION" ? "ok" : "warn"} />
    <Claim label="Category" value={product.category} state="OWNER DECLARED" tone="warn" />
  </div>;
}

function Claim({ label, value, state, tone }) {
  return <div className="rounded-lg border border-line-2 bg-white/50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><span className="text-sm text-ink-2">{label}</span><Badge tone={tone}>{state}</Badge></div><p className="mt-2 font-semibold">{value}</p></div>;
}

function RepairHistory({ repairs }) {
  if (!repairs.length) return <p className="text-ink-2">No repair claims or repair records have been submitted.</p>;
  return <div className="space-y-4">{repairs.map((repair) => {
    const status = repair.provenance?.verificationStatus;
    const certified = status === "PROFESSIONALLY_ATTESTED" || repair.verificationDecision === "PROFESSIONALLY_ATTESTED";
    const rejected = repair.verificationDecision === "REJECTED";
    return <article key={repair._id} className="border border-line-2 rounded-lg p-4">
      <div className="flex flex-wrap justify-between gap-3"><div><h3 className="font-semibold">{repair.description}</h3><p className="text-sm text-ink-2">{fmtDate(repair.date)}{repair.changedParts?.length ? ` · ${repair.changedParts.join(", ")}` : ""}</p></div><Badge tone={certified ? "ok" : rejected ? "fail" : status === "EVIDENCE_SUBMITTED" ? "info" : "warn"}>{certified ? "Certified repairer" : rejected ? "Rejected / unverified" : status === "EVIDENCE_SUBMITTED" ? "Evidence submitted" : "Owner declared"}</Badge></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 text-sm"><Detail label="Source" value={repair.claimant ? "Owner" : repair.repairer ? "Repairer" : "Unknown"} /><Detail label="Status" value={certified ? "PROFESSIONALLY ATTESTED" : rejected ? "REJECTED" : status === "EVIDENCE_SUBMITTED" ? "EVIDENCE SUBMITTED" : "OWNER DECLARED"} /><Detail label="Evidence" value={repair.evidenceDocument?.category || (repair.evidenceHash ? "Hash recorded" : "None")} /><Detail label="Repairer" value={repair.repairer ? `${repair.repairer.firstName} ${repair.repairer.lastName}` : "None"} /><Detail label="Repairer confirmation" value={certified ? "CERTIFIED REPAIRER" : "None"} /><Detail label="Digital signature" value={repair.signatureValid === true ? "VALID" : "None"} /><Detail label="Evidence integrity" value={repair.provenance?.evidence?.integrityStatus === "VERIFIED" ? "HASH MATCH" : repair.provenance?.evidence?.integrityStatus === "FAILED" ? "HASH MISMATCH" : repair.provenance?.evidence?.integrityStatus === "UNVERIFIED" ? "UNVERIFIED" : repair.evidenceHash ? "UNVERIFIED" : "None"} /></div>
    </article>;
  })}</div>;
}

function Detail({ label, value }) { return <div><span className="text-ink-2">{label}: </span><strong>{value}</strong></div>; }

function TechnicalConditionSection({ product }) {
  const inspection = product.technicalInspection;
  const items = inspection?.checklist || [];
  const partsOnly = isPartsOnlyStatus(product.status);
  const inspectionValidity = inspection?.validity || { status: inspection?.status === "TECHNICALLY_VERIFIED" ? "CURRENT" : null, affectedBy: [] };
  const inspectionDate = inspection?.inspectedAt || inspection?.performedAt;
  const inspectorName = inspection?.inspector
    ? `${inspection.inspector.firstName || ""} ${inspection.inspector.lastName || ""}`.trim()
    : inspection?.performedBy
      ? `${inspection.performedBy.firstName || ""} ${inspection.performedBy.lastName || ""}`.trim()
      : "Unknown inspector";

  return <section className="panel p-6" aria-labelledby="condition-title"><SectionHeading id="condition-title" eyebrow="3 / Current condition" title="Current condition" />
    <p className="mt-2 text-sm text-ink-2">Owner declaration: <strong className="text-ink">{product.currentCondition || "No condition statement submitted"}</strong></p>
    <div className="mt-5 border-t border-line-2 pt-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">4 / Technical inspection</p><p className="mt-1 font-semibold">Inspection result</p></div><Badge tone={partsOnly ? "warn" : inspection?.status === "TECHNICALLY_VERIFIED" ? "ok" : "warn"}>{partsOnly ? "END OF LIFE · PARTS ONLY" : inspection?.status === "TECHNICALLY_VERIFIED" ? "TECHNICALLY VERIFIED" : inspection?.status === "COMPLETED" ? "AWAITING ADMIN REVIEW" : "NOT INDEPENDENTLY VERIFIED"}</Badge></div></div>
    {inspection?.status === "TECHNICALLY_VERIFIED" && <div className="mt-4 grid gap-3 sm:grid-cols-2 rounded-lg border border-line-2 bg-white/50 p-4 text-sm">
      <div><span className="text-ink-2">Inspection date: </span><strong>{inspectionDate ? fmtDate(inspectionDate) : "Not recorded"}</strong></div>
      <div><span className="text-ink-2">Inspector: </span><strong>{inspectorName}</strong></div>
      <div className="sm:col-span-2"><span className="text-ink-2">Inspected state: </span><strong>{inspection?.inspectedState || "No recorded state"}</strong></div>
      <div className="sm:col-span-2"><span className="text-ink-2">Later events affect this inspection: </span><strong>{inspectionValidity?.affectedBy?.length ? `Yes (${inspectionValidity.affectedBy.join(", ")})` : "No"}</strong></div>
    </div>}
    {items.length > 0 && <div className="mt-4 grid gap-2 sm:grid-cols-2">{items.map((item) => <div key={item.itemId} className="rounded-md border border-line-2 px-3 py-2 text-sm"><div className="flex justify-between gap-2"><span>{item.label}</span><Badge tone={item.status === "PASS" ? "ok" : item.status === "FAIL" ? "fail" : item.status === "WARNING" ? "warn" : "grey"}>{item.status}</Badge></div>{item.notes && <p className="mt-1 text-ink-2">{item.notes}</p>}</div>)}</div>}
    <p className="mt-4 text-xs text-ink-2">{partsOnly ? "This device is restricted to parts-only listing and purchase." : "Technically verified means a qualified repairer inspected this device and an admin approved the report. It does not mean perfect or defect-free."}</p>
  </section>;
}

function EvidenceSection({ product, repairs, events, me }) {
  const documents = [
    product.documentId && { document: product.documentId, event: events.find((event) => event.document?._id === product.documentId._id) },
    ...repairs.map((repair) => repair.evidenceDocument && {
      document: repair.evidenceDocument,
      repair,
      event: events.find((event) => event.sourceRef === repair.repairId || event.document?._id === repair.evidenceDocument._id)
    }),
    ...events.filter((event) => event.document && !repairs.some((repair) => repair.evidenceDocument?._id === event.document._id)).map((event) => ({ document: event.document, event }))
  ].filter(Boolean).filter((entry, index, all) => all.findIndex((candidate) => candidate.document._id === entry.document._id) === index);
  return <section className="panel p-6" aria-labelledby="evidence-title"><SectionHeading id="evidence-title" eyebrow="6 / Supporting evidence" title="Evidence records" />
    <div className="mt-5 space-y-4">{documents.length ? documents.map((entry) => <EvidenceRecord key={entry.document._id} product={product} me={me} {...entry} />) : <EvidenceRecord product={product} me={me} />}</div>
  </section>;
}

function EvidenceRecord({ product, document, repair, event, me }) {
  const certified = repair?.verificationDecision === "PROFESSIONALLY_ATTESTED" || repair?.provenance?.verificationStatus === "PROFESSIONALLY_ATTESTED";
  const rawStatus = certified ? "CERTIFIED REPAIRER" : repair?.provenance?.verificationStatus || document?.verificationStatus || product.provenance?.verificationStatus || "OWNER_DECLARED";
  const status = rawStatus === "BLOCKCHAIN_RECORDED" ? "OWNER_DECLARED" : rawStatus;
  const statusTone = status === "CERTIFIED REPAIRER" || status === "TECHNICALLY_VERIFIED" ? "ok" : status === "EVIDENCE_SUBMITTED" ? "info" : "warn";
  const submittedBy = document?.uploadedBy || repair?.claimant || product.owner;
  const verifier = repair?.repairer || document?.professionallyVerifiedBy;
  const comparisons = (document?.advisoryAnalysis?.comparisons || []).filter((comparison) => /serial|model/i.test(comparison.field));
  const integrity = repair?.provenance?.evidence?.integrityStatus || "UNKNOWN";
  const hashStatus = repair?.evidenceHash || document?.sha256 || event?.hash ? integrity === "VERIFIED" ? "MATCH" : integrity === "FAILED" ? "MISMATCH" : integrity === "UNVERIFIED" ? "UNVERIFIED" : "RECORDED" : null;
  const unsupported = !document && status === "OWNER_DECLARED";
  const submittedAt = document?.createdAt || event?.createdAt || repair?.createdAt || product?.createdAt;
  const evidenceType = document ? "Provided" : "None";
  return <article className={`rounded-lg border p-4 sm:p-5 ${unsupported ? "border-gilt bg-gilt-tint/35" : "border-line-2 bg-white/50"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3"><Badge tone={statusTone}>{status}</Badge></div>
    <div className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
      <Detail label="Evidence" value={evidenceType} />
      <Detail label="Submitted by" value={`${personName(submittedBy)}${submittedBy?.role ? ` (${humanize(submittedBy.role)})` : ""}`} />
      <Detail label="Date submitted" value={fmtDate(submittedAt)} />
      {comparisons.map((comparison) => <Detail key={comparison.field} label={humanize(comparison.field)} value={comparison.result} />)}
      <Detail label="Verification status" value={humanize(status)} />
      {verifier && <Detail label="Professional verifier" value={personName(verifier)} />}
      {(repair?.signatureValid != null || repair?.provenance?.signature?.status) && <Detail label="Digital signature" value={repair.signatureValid === true || repair.provenance?.signature?.status === "VALID" ? "VALID" : "INVALID"} />}
      {hashStatus && <Detail label="SHA-256 integrity" value={hashStatus} />}
    </div>
    {unsupported ? <p className="mt-4 border-t border-gilt/50 pt-3 text-sm font-semibold text-gilt-ink">This claim is owner declared only. There is no supporting document or independent confirmation.</p> : <p className="mt-4 border-t border-line-2 pt-3 text-xs text-ink-2">Evidence supports a claim; it does not automatically prove the claim.</p>}
  </article>;
}

function humanize(value) { return String(value || "—").replaceAll("_", " "); }
function personName(person) { return person ? `${person.firstName || ""} ${person.lastName || ""}`.trim() || "Unknown" : "Owner"; }

function VerificationStatusSection({ product, repairs }) {
  const statuses = repairs.length ? repairs.map((repair) => repair.verificationDecision === "PROFESSIONALLY_ATTESTED" ? "PROFESSIONALLY_ATTESTED" : repair.provenance?.verificationStatus || "OWNER_DECLARED") : [product.provenance?.verificationStatus || "OWNER_DECLARED"];
  const visibleStatuses = statuses.map((status) => status === "BLOCKCHAIN_RECORDED" ? "OWNER_DECLARED" : status);
  return <section className="panel p-6" aria-labelledby="verification-title"><SectionHeading id="verification-title" eyebrow="7 / Verification status" title="Verification status" /><div className="mt-4 flex flex-wrap gap-2">{[...new Set(visibleStatuses)].map((status) => <Badge key={status} tone={status === "PROFESSIONALLY_ATTESTED" || status === "TECHNICALLY_VERIFIED" ? "ok" : status === "EVIDENCE_SUBMITTED" ? "info" : "warn"}>{status.replaceAll("_", " ")}</Badge>)}</div><p className="mt-3 text-sm text-ink-2">These are claim states, not a single device-wide grade. Owner-declared means reported by the owner; evidence submitted means a document exists; professional or technical states require the corresponding verifier.</p></section>;
}


function SectionHeading({ id, eyebrow, title }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-2">{eyebrow}</p><h2 id={id} className="mt-1 text-xl font-bold">{title}</h2></div>;
}

function RepairConfirmationModal({ repair, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [go, busy] = useAction();
  if (!repair) return null;
  const send = async (confirmed) => {
    const result = await go(() => post(`/repairs/${repair._id}/owner-confirmation`, { confirmed, note }), confirmed ? "Repair confirmed" : "Repair rejection recorded");
    if (result) { setNote(""); onDone(); }
  };
  return (
    <Modal open={Boolean(repair)} onClose={onClose} title="Review repair">
      <p className="text-ink-2">Confirm whether this repair occurred. Your response will be recorded as a separate history event.</p>
      <Field label="Note (optional)"><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        <Btn variant="danger" type="button" busy={busy} onClick={() => send(false)}>Reject repair</Btn>
        <Btn type="button" busy={busy} onClick={() => send(true)}>Confirm repair</Btn>
      </div>
    </Modal>
  );
}

function ProfessionalAttestationModal({ repair, onClose, onDone }) {
  const [note, setNote] = useState("");
  const [go, busy] = useAction();
  if (!repair) return null;
  const send = async (e) => {
    e.preventDefault();
    const result = await go(() => post(`/repairs/${repair._id}/professional-confirmation`, { confirmed: true, note }), "Repair professionally attested");
    if (result) { setNote(""); onDone(); }
  };
  return (
    <Modal open={Boolean(repair)} onClose={onClose} title="Professionally attest repair">
      <p className="text-ink-2">Confirm that you independently stand behind this repair record. This creates a separate attestation event and does not erase the original evidence submission.</p>
      <Field label="Attestation note (optional)"><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      <form onSubmit={send} className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn>
        <Btn type="submit" busy={busy}>Confirm attestation</Btn>
      </form>
    </Modal>
  );
}

function TextModal({ open, onClose, title, label, intro, submit, danger, withDate, withPrice, run, onDone, success }) {
  const [f, setF] = useState({ description: "", date: today(), price: "" });
  const [go, busy] = useAction();
  const send = async (e) => {
    e.preventDefault();
    const r = await go(() => run(f), success);
    if (r) { setF({ description: "", date: today(), price: "" }); onDone(); }
  };
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={send} className="space-y-4">
        {intro && <p className="text-ink-2 text-[0.95rem]">{intro}</p>}
        <Field label={label}><textarea className="input" required minLength={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {withPrice && <Field label="Price (TND)" hint="Leave blank if the price is agreed separately."><input className="input" type="number" min="0" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field>}
        {withDate && <Field label="Date"><input className="input" type="date" max={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>}
        <div className="flex justify-end gap-2 pt-1"><Btn variant="ghost" type="button" onClick={onClose}>Annuler</Btn><Btn variant={danger ? "danger" : "primary"} type="submit" busy={busy}>{submit}</Btn></div>
      </form>
    </Modal>
  );
}

function TransferModal({ open, onClose, product, user, onDone }) {
  const [email, setEmail] = useState("");
  const [go, busy] = useAction();
  const send = async (e) => {
    e.preventDefault();
    const r = await go(() => post("/transfers", { product: product._id, toEmail: email }), "Transfer proposed. The recipient must accept it.");
    if (r) { setEmail(""); onDone(); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Sell or transfer">
      <form onSubmit={send} className="space-y-4">
        <p className="text-ink-2 text-[0.95rem]">The recipient receives the request in their space and accepts it. Ownership and the device&apos;s history are then transferred to them.</p>
        <Field label="Recipient email" hint="They must have a ReLoop account (owner or buyer)."><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>Propose transfer</Btn></div>
      </form>
    </Modal>
  );
}

function ListingModal({ open, onClose, product, onDone }) {
  const [price, setPrice] = useState(product?.listingPrice ?? "");
  const [go, busy] = useAction();
  const send = async (e) => {
    e.preventDefault();
    const value = Number(price);
    const r = await go(() => patch(`/passports/${product._id}/listing`, { action: "LIST", price: value }), "Device listed on the marketplace");
    if (r) onDone();
  };
  return (
    <Modal open={open} onClose={onClose} title="List on marketplace">
      <form onSubmit={send} className="space-y-4">
        <p className="text-ink-2 text-[0.95rem]">Set an asking price. Any verified buyer will then be able to find this device in the marketplace and request to buy it.</p>
        <Field label="Price (TND)"><input className="input" type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Btn variant="ghost" type="button" onClick={onClose}>Cancel</Btn><Btn type="submit" busy={busy}>List device</Btn></div>
      </form>
    </Modal>
  );
}

function BuyModal({ open, onClose, product, user, onDone }) {
  const [go, busy] = useAction();
  const partsOnly = isPartsOnlyStatus(product.status);
  const send = async () => {
    const r = await go(() => post("/transfers", { product: product._id, toOwner: user.id }), "Purchase complete. This device is now yours.");
    if (r) onDone();
  };
  return (
    <Modal open={open} onClose={onClose} title={partsOnly ? "Buy for parts" : "Buy this device"}>
      {partsOnly
        ? <p className="font-semibold">This device is sold for parts and is not represented as a working device.</p>
        : <p className="font-semibold">Buy this device{product.listingPrice != null ? ` for ${new Intl.NumberFormat("en-US").format(product.listingPrice)} TND` : ""}?</p>}
      <p className="mt-3 text-ink-2">{partsOnly ? "The current owner must accept your request before ownership transfers." : "This completes immediately — ownership transfers to your account."}</p>
      <div className="flex justify-end gap-2 mt-6"><Btn variant="ghost" onClick={onClose}>Cancel</Btn><Btn busy={busy} onClick={send}>{partsOnly ? "Request purchase" : "Confirm purchase"}</Btn></div>
    </Modal>
  );
}
