import axios from "axios";

export const TOKEN_KEY = "reloop.token";
export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api", timeout: 60000 });

export function assetUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  const configuredApi = import.meta.env.VITE_API_URL;
  const backend = configuredApi
    ? configuredApi.replace(/\/api\/?$/, "")
    : (import.meta.env.VITE_PROXY_TARGET || "http://localhost:5000");
  return `${backend.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
}

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem(TOKEN_KEY);
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const url = err.config?.url || "";
    if (err.response?.status === 401 && !url.includes("/auth/login")) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("reloop:logout"));
    }
    return Promise.reject(err);
  }
);

const EN = {
  "Invalid email or password": "Incorrect email or password.",
  "Email already exists": "This email address is already in use.",
  "Account is disabled": "This account is disabled. Please contact the administrator.",
  "Authentication required": "Your session has expired. Please log in again.",
  "Invalid or expired token": "Your session has expired. Please log in again.",
  "Product not found": "Device not found.",
  "Passport not found": "No passport matches this identifier.",
  "Only a verified repairer can register a repair": "Only a verified repairer can record a repair. Your account must be approved by the administrator first.",
  "Only a verified repairer can declare end of life through a repair request": "Only a verified repairer can declare end of life through an accepted repair request.",
  "A transfer is already pending": "A purchase is already pending for this device.",
  "Destination owner is invalid": "Invalid recipient. Please check their email address and role.",
  "Transfer authorization denied": "You are not allowed to start this purchase.",
  "Only the destination owner can accept": "Only the recipient can accept this purchase.",
  "Product is not available for this transfer": "This device is not available for purchase.",
  "Only devices in service can be listed for sale": "Only devices in service can be listed for sale.",
  "Only the current owner can manage this device's listing": "Only the current owner can manage this device's listing.",
  "Hedera ownership transfer failed": "This purchase could not be completed. Please try again in a moment.",
  "Hedera integration is disabled": "This purchase could not be completed. Please try again in a moment.",
  "Hedera operation failed": "This purchase could not be completed. Please try again in a moment.",
  "Only PDF, JPG, PNG and WEBP files are allowed": "Accepted formats: PDF, JPG, PNG, and WEBP.",
  "File too large": "File too large (maximum 5 MB).",
  "Repairer signature is invalid": "The repairer signature is invalid.",
  "Access denied": "Access denied.",
  "Maintenance access denied": "You cannot record maintenance for this device.",
  "You do not own this product": "You do not own this device."
};

export function errorMessage(err) {
  if (!err?.response) {
    if (err?.code === "ECONNABORTED") return "The server is taking too long to respond.";
    if (err?.isAxiosError) return "Server unreachable. Please check that the backend is started.";
    const message = typeof err?.message === "string" ? err.message : "";
    return EN[message] || message || "An error has occurred.";
  }
  const { status, data } = err.response;
  if (status === 429) return "Too many requests. Please wait a few minutes before trying again.";
  if (data?.errors?.length) return data.errors.join(" · ");
  const msg = data?.message || "An error has occurred.";
  if (EN[msg]) return EN[msg];
  const m = msg.match(/^(\w+) is not allowed from product status (\w+)$/);
  if (m) return `This action is not possible for a device in this state (${m[2]}).`;
  return msg;
}

export const get = (url, params) => api.get(url, { params }).then((r) => r.data);
export const post = (url, body, cfg) => api.post(url, body, cfg).then((r) => r.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data);
