import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/authContext";

export default function ProtectedRoute() {
  const {
    authError,
    loading,
    passwordChangeRequired,
    refreshPasswordChangeRequired,
    user,
  } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Caricamento sessione
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (authError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center text-sm">
        <p>Verifica dello stato account non riuscita: {authError}</p>
        <button
          className="text-primary hover:underline"
          type="button"
          onClick={() => void refreshPasswordChangeRequired().catch(() => undefined)}
        >
          Riprova
        </button>
      </div>
    );
  }
  const firstPasswordPath = "/account/first-password";
  if (passwordChangeRequired && location.pathname !== firstPasswordPath) {
    return <Navigate to={firstPasswordPath} replace />;
  }
  if (!passwordChangeRequired && location.pathname === firstPasswordPath) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
