import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { authHeaders, getToken, readError, setToken } from "@/lib/api";

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: "user" | "admin";
  favorite_genre: string;
  avatar_url: string;
  created_at: string;
}

export interface Session {
  access_token: string;
  user: AuthUser;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const toError = (err: unknown) => (err instanceof Error ? err : new Error(String(err)));

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((token: string | null, nextUser: AuthUser | null) => {
    setToken(token);
    setUser(token ? nextUser : null);
    setSession(token && nextUser ? { access_token: token, user: nextUser } : null);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          applySession(token, data.user);
        } else {
          applySession(null, null); // expired or revoked
        }
      })
      .catch((err) => {
        console.error("Error fetching current user:", err);
        setUser(null);
        setSession(null);
      })
      .finally(() => setLoading(false));
  }, [applySession]);

  /** Shared by register and login: both return `{ token, user }`. */
  const authenticate = async (path: string, body: Record<string, string>, fallback: string) => {
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) return { error: new Error(await readError(response, fallback)) };
      const data = await response.json();
      applySession(data.token, data.user);
      return { error: null };
    } catch (err) {
      return { error: toError(err) };
    }
  };

  const signUp = (email: string, password: string, username: string) =>
    authenticate("/api/auth/register", username.trim() ? { email, password, username } : { email, password }, "Registration failed");

  const signIn = (email: string, password: string) => authenticate("/api/auth/login", { email, password }, "Login failed");

  const signOut = async () => {
    if (getToken()) {
      try {
        await fetch("/api/auth/logout", { method: "POST", headers: authHeaders() });
      } catch (err) {
        console.error("Error signing out:", err);
      }
    }
    applySession(null, null);
  };

  const resetPassword = async (email: string) => {
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) return { error: new Error(await readError(response, "Could not request a reset link")) };
      return { error: null };
    } catch (err) {
      return { error: toError(err) };
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
