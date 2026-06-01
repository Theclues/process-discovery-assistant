import { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { UserRole } from "../types";

export interface Identity {
  orgId: string;
  orgName: string;
  empId: string;
  empName: string;
  role: UserRole;
}

interface SessionApi {
  identity: Identity | null;
  signIn: (id: Identity) => void;
  signOut: () => void;
}

const SessionContext = createContext<SessionApi | null>(null);
const STORAGE_KEY = "pda-identity";

function load(): Identity | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch { return null; }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(load);

  const signIn = useCallback((id: Identity) => {
    setIdentity(id);
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(id)); } catch { /* ignore */ }
  }, []);

  const signOut = useCallback(() => {
    setIdentity(null);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const value = useMemo(() => ({ identity, signIn, signOut }), [identity, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
