import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/authContext";
import { changePassword } from "@/auth/authService";
import ErrorNotice from "@/components/ErrorNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ChangePasswordPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.email) return;
    if (newPassword.length < 8) {
      setError("La nuova password deve contenere almeno 8 caratteri.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("Le password non coincidono.");
      return;
    }
    setPending(true);
    setSuccess(false);
    setError(null);
    try {
      await changePassword({ email: user.email, currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setSuccess(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Modifica non riuscita.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-lg">
      <CardHeader>
        <CardTitle>Cambia password</CardTitle>
        <CardDescription>Conferma la password corrente prima di impostarne una nuova.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && <ErrorNotice message={error} onDismiss={() => setError(null)} />}
          {success && <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">Password aggiornata.</p>}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="current-password">Password corrente</label>
            <Input id="current-password" type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="account-new-password">Nuova password</label>
            <Input id="account-new-password" type="password" autoComplete="new-password" required minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="account-confirm-password">Conferma password</label>
            <Input id="account-confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Link className="text-sm text-primary hover:underline" to="/">Annulla</Link>
            <Button type="submit" disabled={pending}>{pending ? "Salvataggio..." : "Aggiorna password"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
