import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { clearToken, getToken } from '../api/client';
import { login as loginRequest } from '../api/endpoints';

interface JwtPayload {
  sub: string;
  username: string;
  role: 'analyst' | 'admin';
}

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  role: JwtPayload['role'] | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// Client-side JWT payload decode for display only — the server is the only party
// that verifies the signature. Never trust this for authorization decisions.
function decodePayload(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<JwtPayload | null>(() => {
    const token = getToken();
    return token ? decodePayload(token) : null;
  });

  const value = useMemo<AuthState>(
    () => ({
      isAuthenticated: payload !== null,
      username: payload?.username ?? null,
      role: payload?.role ?? null,
      login: async (username: string, password: string) => {
        await loginRequest(username, password);
        const token = getToken();
        setPayload(token ? decodePayload(token) : null);
      },
      logout: () => {
        clearToken();
        setPayload(null);
      }
    }),
    [payload]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
