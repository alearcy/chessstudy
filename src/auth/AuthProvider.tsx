import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import { AuthContext } from "@/auth/authContext";
import { getPasswordChangeRequired } from "@/auth/authService";

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshPasswordChangeRequired = useCallback(async () => {
    if (!user) {
      setPasswordChangeRequired(false);
      return;
    }
    setAuthError(null);
    try {
      setPasswordChangeRequired(await getPasswordChangeRequired(user.id));
    } catch (caught) {
      const message = caught instanceof Error
        ? caught.message
        : "Verifica dello stato account non riuscita.";
      setAuthError(message);
      throw caught;
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    let authEventSeen = false;

    async function applyUser(nextUser: User | null) {
      setUser(nextUser);
      setAuthError(null);
      if (!nextUser) {
        setPasswordChangeRequired(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const required = await getPasswordChangeRequired(nextUser.id);
        if (!active) return;
        setPasswordChangeRequired(required);
      } catch (caught) {
        if (!active) return;
        setAuthError(caught instanceof Error
          ? caught.message
          : "Verifica dello stato account non riuscita.");
      } finally {
        if (active) setLoading(false);
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        authEventSeen = true;
        void applyUser(session?.user ?? null);
      },
    );

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active || authEventSeen) return;
      void applyUser(error ? null : data.user);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    authError,
    loading,
    passwordChangeRequired,
    refreshPasswordChangeRequired,
    user,
  }), [
    authError,
    loading,
    passwordChangeRequired,
    refreshPasswordChangeRequired,
    user,
  ]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
