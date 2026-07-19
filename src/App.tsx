import { useState } from "react";
import {
  BrowserRouter,
  Link,
  Outlet,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { DatabaseBackup, KeyRound, LogOut, Settings } from "lucide-react";
import { AuthProvider } from "@/auth/AuthProvider";
import ProtectedRoute from "@/auth/ProtectedRoute";
import { signOut } from "@/auth/authService";
import BrandLogo from "@/components/BrandLogo";
import DatabaseBackupDialog from "@/components/DatabaseBackupDialog";
import ErrorNotice from "@/components/ErrorNotice";
import SettingsDialog from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";
import AuthConfirmPage from "@/pages/AuthConfirmPage";
import ChangePasswordPage from "@/pages/ChangePasswordPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import FirstPasswordPage from "@/pages/FirstPasswordPage";
import LessonDetailPage from "@/pages/LessonDetailPage";
import LessonsPage from "@/pages/LessonsPage";
import LoginPage from "@/pages/LoginPage";
import UpdatePasswordPage from "@/pages/UpdatePasswordPage";
import { DATABASE_BACKUP_RESTORED_EVENT } from "@/services/databaseBackupService";

function PrivateAppShell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(null);
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (caught) {
      setLogoutError(caught instanceof Error ? caught.message : "Disconnessione non riuscita.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-[96rem] items-center gap-3 px-6 py-4">
          <Link to="/" className="inline-flex shrink-0">
            <BrandLogo className="w-40 sm:w-44" />
          </Link>
          <div className="flex-1" />
          <Button variant="ghost" size="icon-xs" onClick={() => setBackupOpen(true)} title="Backup dati" aria-label="Backup dati">
            <DatabaseBackup className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => setSettingsOpen(true)} title="Impostazioni" aria-label="Impostazioni">
            <Settings className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={() => navigate("/account/password")} title="Cambia password" aria-label="Cambia password">
            <KeyRound className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={handleLogout} disabled={loggingOut} title="Esci" aria-label="Esci">
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      {logoutError && (
        <div className="mx-auto mt-3 w-full max-w-[96rem] px-4">
          <ErrorNotice message={logoutError} onDismiss={() => setLogoutError(null)} />
        </div>
      )}
      <main className="mx-auto w-full max-w-[96rem] px-4 py-4">
        <Outlet />
      </main>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <DatabaseBackupDialog
        open={backupOpen}
        onOpenChange={setBackupOpen}
        onRestored={() => {
          window.dispatchEvent(new Event(DATABASE_BACKUP_RESTORED_EVENT));
        }}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/confirm" element={<AuthConfirmPage />} />
          <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/account/first-password" element={<FirstPasswordPage />} />
            <Route element={<PrivateAppShell />}>
              <Route index element={<LessonsPage onOpenSettings={() => undefined} />} />
              <Route path="lesson/:id" element={<LessonDetailPage />} />
              <Route path="account/password" element={<ChangePasswordPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
