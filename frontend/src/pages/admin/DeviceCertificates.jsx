import { useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { api, get, patch, post } from "../../lib/api";
import { Badge, Btn, Empty, Field, Notice, PageHeader, Spinner, useAction, useAsync } from "../../components/ui";

export default function DeviceCertificates() {
  const { data, loading, error, reload } = useAsync(() => get("/admin/device-certificates"));
  const [notes, setNotes] = useState({});
  const [noteErrors, setNoteErrors] = useState({});
  const [go, busy] = useAction();

  const openDocument = async (document) => {
    const preview = window.open("about:blank", "_blank");
    if (!preview) {
      window.alert("Allow pop-ups to preview the certificate.");
      return;
    }
    try {
      const response = await api.get(`/documents/${document._id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(response.data);
      preview.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      preview.close();
      throw error;
    }
  };

  const review = async (document, action) => {
    const note = (notes[document._id] || "").trim();
    if (action === "REJECT" && note.length < 3) {
      setNoteErrors((current) => ({
        ...current,
        [document._id]: "Enter a rejection reason of at least 3 characters."
      }));
      return;
    }
    setNoteErrors((current) => ({ ...current, [document._id]: "" }));
    const message = action === "APPROVE" ? "Certificate approved" : "Certificate rejected";
    if (await go(() => patch(`/admin/device-certificates/${document._id}/review`, { action, note }), message)) reload();
  };

  return <div>
    <PageHeader title="Device certificates" lead="Review owner-submitted certificates. Company associations are accepted only for companies already verified by an administrator." />
    {loading ? <Spinner /> : error ? <Notice tone="fail">{error}</Notice> : !data?.length ? <Empty title="No certificates awaiting review" /> : <ul className="space-y-4">
      {data.map((document) => <li key={document._id} className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{document.product ? `${document.product.brand} ${document.product.model}` : document.originalName}</h2>
            <p className="text-sm text-ink-2">{document.product?.passportId || "Passport pending"} · {document.product?.owner?.firstName} {document.product?.owner?.lastName}</p>
            <p className="text-sm text-ink-2 mt-1">{document.originalName} · {new Date(document.createdAt).toLocaleDateString()}</p>
          </div>
          <Badge tone="warn">Pending review</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Btn variant="secondary" onClick={() => go(() => openDocument(document))}><ExternalLink size={16} />Open certificate</Btn>
          <span className="mono text-xs text-ink-2 break-all">SHA-256 {document.sha256}</span>
        </div>
        <Field label="Review note" hint="Required when rejecting (at least 3 characters)." error={noteErrors[document._id]}><textarea className="input mt-2" aria-invalid={Boolean(noteErrors[document._id])} value={notes[document._id] || ""} onChange={(event) => {
          const value = event.target.value;
          setNotes((current) => ({ ...current, [document._id]: value }));
          if (value.trim().length >= 3) setNoteErrors((current) => ({ ...current, [document._id]: "" }));
        }} placeholder="Explain why the certificate is rejected." /></Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn busy={busy} onClick={() => review(document, "APPROVE")}><Check size={16} />Approve</Btn>
          <Btn variant="danger" busy={busy} onClick={() => review(document, "REJECT")}><X size={16} />Reject</Btn>
        </div>
      </li>)}
    </ul>}
  </div>;
}
