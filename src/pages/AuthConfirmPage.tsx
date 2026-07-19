import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { confirmEmailOtp } from "@/auth/authService";
import ErrorNotice from "@/components/ErrorNotice";

export default function AuthConfirmPage() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    void confirmEmailOtp(searchParams).then((type) => {
      if (!active) return;
      const needsPassword = type === "invite" || type === "recovery";
      navigate(needsPassword ? `/auth/update-password?reason=${type}` : "/", {
        replace: true,
      });
    }).catch((caught: unknown) => {
      if (!active) return;
      setError(caught instanceof Error ? caught.message : "Link non valido.");
    });
    return () => { active = false; };
  }, [navigate, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 text-sm">
      {error ? (
        <div className="w-full max-w-md space-y-4">
          <ErrorNotice message={error} />
          <Link className="text-primary hover:underline" to="/login">Torna all'accesso</Link>
        </div>
      ) : (
        <p className="text-muted-foreground">Verifica del link in corso...</p>
      )}
    </main>
  );
}
