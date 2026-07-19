import { useState, type FormEvent } from "react";
import { useAuth } from "@/auth/authContext";
import { updatePassword } from "@/auth/authService";
import ErrorNotice from "@/components/ErrorNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function FirstPasswordPage() {
  const { refreshPasswordChangeRequired } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("La nuova password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmation) {
      setError("Le password non coincidono.");
      return;
    }
    setPending(true);
    setSuccess(false);
    setError(null);
    try {
      await updatePassword(password);
      setSuccess(true);
      await refreshPasswordChangeRequired();
    } catch (caught) {
      setSuccess(false);
      setError(caught instanceof Error ? caught.message : "Aggiornamento non riuscito.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle><h1>Cambia la password temporanea</h1></CardTitle>
          <CardDescription>
            Prima di continuare, scegli una password personale di almeno 8 caratteri.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && <ErrorNotice message={error} onDismiss={() => setError(null)} />}
            {success && (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                Password aggiornata. Accesso in corso...
              </p>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="first-password">Nuova password</label>
              <Input
                id="first-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="first-password-confirmation">Conferma password</label>
              <Input
                id="first-password-confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </div>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Salvataggio..." : "Salva e continua"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
