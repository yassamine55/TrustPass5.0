import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileCheck2, Fingerprint, ImagePlus } from "lucide-react";
import { get, post } from "../lib/api";
import { hashSerial, sha256File } from "../lib/hash";
import { CATEGORIES } from "../lib/labels";
import { shortHash } from "../lib/format";
import { Btn, Field, Notice, PageHeader, useAction, useAsync, useToast } from "../components/ui";

const creationSteps = [
  "Données validées",
  "Hash généré",
  "Envoyé à Hedera",
  "Consensus atteint ✓"
];

export default function DeviceNew() {
  const nav = useNavigate();
  const toast = useToast();
  const [go, busy] = useAction();
  const { data: companies, error: companiesError } = useAsync(() => get("/public/companies/verified"));
  const [f, setF] = useState({ manufacturer: "", model: "", category: CATEGORIES[0], serial: "", purchaseDate: "", currentCondition: "", description: "", photo: null, certificate: null, companyId: "" });
  const [hash, setHash] = useState("");
  const [certificateHash, setCertificateHash] = useState("");
  const [creationStep, setCreationStep] = useState(0);
  const photoInput = useRef(null);
  const certificateInput = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => { if (f.serial.trim()) hashSerial(f.serial).then(setHash); else setHash(""); }, [f.serial]);

  const submit = async (e) => {
    e.preventDefault();
    const { serial, photo, certificate, manufacturer, companyId, ...rest } = f;
    setCreationStep(1);
    const hashTimer = setTimeout(() => setCreationStep(2), 800);
    const submitTimer = setTimeout(() => setCreationStep(3), 1700);
    const r = await go(async () => {
      let documentId;
      if (certificate) {
        const evidence = new FormData();
        evidence.append("file", certificate);
        evidence.append("category", "WARRANTY_DOCUMENT");
        evidence.append("claimType", "DEVICE_CERTIFICATE");
        documentId = (await post("/documents", evidence)).document._id;
      }
      const body = new FormData();
      Object.entries({ ...rest, brand: manufacturer, manufacturer, serialNumberHash: hash, companyId, documentId }).forEach(([key, value]) => {
        if (value !== undefined && value !== "") body.append(key, value);
      });
      if (photo) body.append("photo", photo);
      return post("/passports", body);
    });
    clearTimeout(hashTimer);
    clearTimeout(submitTimer);
    if (!r) {
      setCreationStep(0);
      return;
    }
    const p = r.product;
    if (p.hederaProof?.status === "CONFIRMED") {
      setCreationStep(4);
      toast("Passport created and anchored on Hedera");
    } else {
      setCreationStep(3);
      toast("Passport created, but Hedera anchoring failed. You can retry the proof later.", "fail");
    }
    nav(`/passport/${p.passportId}`);
  };

  return (
    <div>
      <PageHeader title="New device" lead="Create a digital passport for your device." />
      <form onSubmit={submit} className="panel p-6 sm:p-8 max-w-2xl space-y-5">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Manufacturer *" hint="Owner-provided information; not manufacturer verification."><input className="input" required value={f.manufacturer} onChange={set("manufacturer")} placeholder="Apple" /></Field>
          <Field label="Model *"><input className="input" required value={f.model} onChange={set("model")} placeholder="MacBook Air M1" /></Field>
        </div>
        <Field label="Category"><select className="input" value={f.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
        {companiesError
          ? <Notice tone="fail">Verified companies could not be loaded: {companiesError}</Notice>
          : <Field label="Verified company (optional)" hint="Only companies added and verified by an administrator are available.">
              <select className="input" value={f.companyId} onChange={set("companyId")}>
                <option value="">No company selected</option>
                {(companies || []).map((company) => <option key={company._id} value={company._id}>{company.name}</option>)}
              </select>
            </Field>}
        <Field label="Device certificate (optional)" hint="Upload a manufacturer or authenticity certificate for administrator review. PDF, JPG, PNG, or WEBP, max 5 MB.">
          <input ref={certificateInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
            const certificate = e.target.files?.[0] || null;
            setF((value) => ({ ...value, certificate }));
            setCertificateHash(certificate ? await sha256File(certificate) : "");
          }} />
          <Btn type="button" variant="secondary" onClick={() => certificateInput.current?.click()}><FileCheck2 size={17} />{f.certificate ? "Change certificate" : "Add certificate"}</Btn>
          {f.certificate && <p className="mt-2 text-sm text-ink-2 truncate">{f.certificate.name} · SHA-256 {shortHash(certificateHash, 10)}</p>}
        </Field>
        <div>
          <Field label="Serial number *" hint="Printed on the device or in its settings.">
            <input className="input mono" required value={f.serial} onChange={set("serial")} autoComplete="off" placeholder="C02XK1ABJG5H" />
          </Field>
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-2"><Fingerprint size={16} className="shrink-0" />
            {hash ? <>Only this fingerprint is stored: <span className="mono text-ink">{shortHash(hash, 12)}</span></> : "The number is transformed into a SHA-256 fingerprint in your browser. It is never sent in clear text."}</p>
        </div>
        <Field label="Description (optional)"><textarea className="input" value={f.description} onChange={set("description")} placeholder="Color, capacity, overall condition…" /></Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Purchase date (optional)" hint="Use this if known; it can be years after manufacture."><input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={f.purchaseDate} onChange={set("purchaseDate")} /></Field>
          <Field label="Current condition (optional)" hint="Owner declaration only until independently inspected."><input className="input" value={f.currentCondition} onChange={set("currentCondition")} placeholder="Good, worn, cracked screen…" /></Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Device photo (optional)" hint="JPG, PNG, or WEBP, max 5 MB.">
            <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setF({ ...f, photo: e.target.files?.[0] || null })} />
            <Btn type="button" variant="secondary" onClick={() => photoInput.current?.click()}><ImagePlus size={17} />{f.photo ? "Change photo" : "Add a photo"}</Btn>
            {f.photo && <p className="mt-2 text-sm text-ink-2 truncate">{f.photo.name}</p>}
          </Field>
        </div>

        {busy && <ol aria-label="Passport creation progress" className="space-y-3 rounded-lg border border-line-2 bg-white/60 p-4">
          {creationSteps.map((label, index) => {
            const complete = creationStep > index + 1 || (index === 3 && creationStep === 4);
            const current = creationStep === index + 1;
            return <li key={label} className={`flex items-center gap-3 text-sm transition-colors ${complete ? "text-ok" : current ? "font-semibold text-petrol" : "text-ink-2"}`}>
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${complete ? "border-ok bg-ok-tint" : current ? "animate-pulse border-petrol bg-petrol-tint" : "border-line-2"}`}>
                {complete ? "✓" : index + 1}
              </span>
              <span>{label}</span>
            </li>;
          })}
        </ol>}

        <Btn type="submit" busy={busy} disabled={!hash} className="w-full sm:w-auto">Create passport</Btn>
      </form>
    </div>
  );
}
