export function normalizeDevicePhotoRef(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\\/g, "/");
  if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) return null;
  const relative = trimmed.replace(/^\/+/, "");
  if (!relative || relative.includes("..")) return null;

  const patterns = [/^device-photos\/([A-Za-z0-9._-]+)$/, /^uploads\/([A-Za-z0-9._-]+)$/];
  for (const pattern of patterns) {
    const match = relative.match(pattern);
    if (match) return relative;
  }

  return null;
}

export function getDevicePhotoUrl(product, backendBase) {
  if (!product) return null;
  const ref = normalizeDevicePhotoRef(product.photo);
  if (!ref) return null;
  const productId = product._id || product.id;
  if (!productId) return null;
  const base = backendBase ? backendBase.replace(/\/+$/, "") : "";
  return `${base}/api/public/devices/${productId}/photo`;
}

export function getDevicePhotoPlaceholderLabel(product) {
  if (!product) return "Device photo";
  const name = [product.brand, product.model].filter(Boolean).join(" ").trim();
  return name || "TrustPass device";
}
