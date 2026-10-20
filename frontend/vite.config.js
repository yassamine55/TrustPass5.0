import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Le proxy évite tout problème de CORS en développement : /api -> backend Express.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_PROXY_TARGET || "http://localhost:5000";
  return {
    plugins: [react(), tailwindcss()],
    server: { host: true, port: 5173, proxy: { "/api": { target, changeOrigin: true } } },
    preview: { host: true, port: 5173, proxy: { "/api": { target, changeOrigin: true } } }
  };
});
