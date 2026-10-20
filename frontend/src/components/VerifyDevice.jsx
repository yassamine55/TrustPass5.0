import { useRef, useState } from "react";
import { CheckCircle2, XCircle, FileCheck2, Hash } from "lucide-react";
import { hashSerial, sha256File } from "../lib/hash";
import { EVENTS } from "../lib/labels";
import { fmtDate } from "../lib/format";
import { Btn, Notice } from "./ui";

/* Checks done in the browser: the serial number and files are never sent. */
export default function VerifyDevice({ passport, events, repairs }) {
  const [tab, setTab] = useState("serial");
  const [serial, setSerial] = useState("");
  const [res, setRes] = useState(null);
  const fileRef = useRef(null);

  const switchTab = (t) => { setTab(t); setRes(null); };

  async function checkSerial(e) {
    e.preventDefault();
    if (!serial.trim()) return;
    const h = await hashSerial(serial);
    setRes({ ok: h === passport.serialNumberHash });
  }
  async function checkFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const h = await sha256File(file);
    const ev = events.find((x) => x.hash === h);
    const rep = repairs.find((r) => r.evidenceHash === h || r.invoiceHash === h);
    setRes({ ok: Boolean(ev || rep), hash: h, event: ev, name: file.name });
    e.target.value = "";
  }

  return (
    <section className="panel p-5" aria-labelledby="vd-title">
      <h2 id="vd-title" className="text-lg font-semibold">Verify this device</h2>
      <p className="text-[0.9rem] text-ink-2 mt-1">Compare the device or invoice presented to you with this passport.</p>
      <div role="tablist" className="flex gap-1 mt-4 p-1 bg-board rounded-lg">
        {[["serial", "Serial number", Hash], ["file", "Document", FileCheck2]].map(([k, l, Icon]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => switchTab(k)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold cursor-pointer ${tab === k ? "bg-paper shadow-sm" : "text-ink-2 hover:text-ink"}`}><Icon size={15} />{l}</button>
        ))}
      </div>

      {tab === "serial" ? (
        <form onSubmit={checkSerial} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold" htmlFor="vd-serial">Serial number printed on the device</label>
          <input id="vd-serial" className="input mono" value={serial} onChange={(e) => { setSerial(e.target.value); setRes(null); }} placeholder="Ex. C02XK1ABJG5H" autoComplete="off" />
          <Btn variant="secondary" className="w-full" type="submit" disabled={!serial.trim()}>Compare</Btn>
        </form>
      ) : (
        <div className="mt-4">
          <input ref={fileRef} type="file" accept="application/pdf,image/*" onChange={checkFile} className="hidden" id="vd-file" />
          <Btn variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>Choose a file</Btn>
          <p className="text-[0.82rem] text-ink-2 mt-2">The SHA-256 fingerprint is calculated on your device. The file is not uploaded.</p>
        </div>
      )}

      <div className="mt-3" aria-live="polite">
        {res && (res.ok
          ? <Notice tone="ok" title={tab === "serial" ? "Serial number matches" : "Document hash matches"}>
              {tab === "serial" ? "The fingerprint of this number matches that of the passport."
                : <>The file “{res.name}” matches the event <strong>{EVENTS[res.event?.type]?.label || "Repair"}</strong>{res.event ? ` on ${fmtDate(res.event.createdAt)}` : ""}. It has not been modified.</>}
            </Notice>
          : <Notice tone="fail" title={tab === "serial" ? "Different serial number" : "No match"}>
              {tab === "serial" ? "This number does not match the passport. Check the entry, otherwise the device may not be the one described here."
                : "This file is not linked to any event in this passport. It may have been modified or come from another device."}
            </Notice>)}
      </div>
    </section>
  );
}
