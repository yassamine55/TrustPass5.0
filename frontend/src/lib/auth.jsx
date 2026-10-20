import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TOKEN_KEY, get, post, patch } from "./api";

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const logout = useCallback(() => { localStorage.removeItem(TOKEN_KEY); setUser(null); }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    get("/auth/me").then((d) => setUser(d.user)).catch(logout).finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => { window.addEventListener("reloop:logout", logout); return () => window.removeEventListener("reloop:logout", logout); }, [logout]);

  const value = useMemo(() => ({
    user, loading, logout,
    async login(email, password) {
      const d = await post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, d.token); setUser(d.user); return d.user;
    },
    async register(payload) {
      const d = await post("/auth/register", payload);
      localStorage.setItem(TOKEN_KEY, d.token); setUser(d.user); return d.user;
    },
    async refresh() { const d = await get("/auth/me"); setUser(d.user); return d.user; },
    async updateProfile(body) { const d = await patch("/auth/me", body); setUser(d.user); return d.user; },
    async updatePassword(body) { const d = await patch("/auth/me/password", body); return d; }
  }), [user, loading, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
