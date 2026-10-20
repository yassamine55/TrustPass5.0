/* Lightweight SVG/HTML charts without dependencies. */
export function HBars({ data, color = "var(--color-petrol)", empty = "No data yet" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length || data.every((d) => !d.value)) return <p className="text-ink-2 text-sm py-3">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_2rem] items-center gap-3 text-sm">
          <span className="truncate" title={d.label}>{d.label}</span>
          <span className="h-3 rounded-sm bg-board overflow-hidden"><span className="block h-full rounded-sm" style={{ width: `${(d.value / max) * 100}%`, background: d.color || color }} /></span>
          <span className="font-semibold text-right">{d.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function Columns({ data, color = "var(--color-petrol)" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-3 h-40" role="img" aria-label={data.map((d) => `${d.label} : ${d.value}`).join(", ")}>
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
          <span className="text-sm font-semibold">{d.value}</span>
          <span className="w-full max-w-10 rounded-t-md" style={{ height: `${Math.max((d.value / max) * 100, d.value ? 6 : 2)}%`, background: d.value ? color : "var(--color-line)" }} />
          <span className="text-[0.78rem] text-ink-2">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
