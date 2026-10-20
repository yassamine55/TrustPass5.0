import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { parsePassportId } from "../lib/format";
import { Btn, Field, Notice, PageHeader } from "../components/ui";

export default function Lookup() {
  const nav = useNavigate();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    const id = parsePassportId(value);
    if (!id) {
      setError("Identifier not recognized. It should look like RLP-2026-F39BC90.");
      return;
    }
    nav(`/passport/${id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Open a device passport" lead="Enter the TrustPass ID printed on the device or shared by its owner." />
      <form onSubmit={submit} className="panel p-6 sm:p-8 space-y-5" noValidate>
        <Field label="TrustPass ID" hint="Example: RLP-2026-F39BC90">
          <input className="input mono" value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} placeholder="RLP-2026-F39BC90" autoComplete="off" />
        </Field>
        {error && <Notice tone="fail">{error}</Notice>}
        <Btn type="submit"><Search size={17} />Open passport</Btn>
      </form>
    </div>
  );
}
