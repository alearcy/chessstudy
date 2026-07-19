import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";

export interface AuthContextValue {
  authError: string | null;
  loading: boolean;
  passwordChangeRequired: boolean;
  refreshPasswordChangeRequired: () => Promise<void>;
  user: User | null;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve essere usato dentro AuthProvider.");
  return context;
}
