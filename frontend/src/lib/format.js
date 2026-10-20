const dateFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const fmtDate = (d) => (d ? dateFmt.format(new Date(d)) : "—");
export const fmtDateTime = (d) => (d ? dateTimeFmt.format(new Date(d)) : "—");
export const fmtPrice = (n) => (n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "EUR" }).format(n));
export const shortHash = (h, n = 8) => (h ? `${h.slice(0, n)}…${h.slice(-6)}` : "—");
export const initials = (u) => (u ? `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() : "?");
export const displayName = (u, me) => (!u ? "—" : me && (u._id === me.id || u.id === me.id) ? "You" : `${u.firstName} ${u.lastName?.[0] ?? ""}.`);

// Extract a passport identifier from a shared passport URL or freeform entry.
export function parsePassportId(text) {
  if (!text) return null;
  const m = String(text).match(/RLP-\d{4}-[A-Z0-9]{5,}/i);
  return m ? m[0].toUpperCase() : null;
}
