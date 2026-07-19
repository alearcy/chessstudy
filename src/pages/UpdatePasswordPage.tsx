import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/authContext";
import { updatePassword } from "@/auth/authService";
import ErrorNotice from "@/components/ErrorNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function UpdatePasswordPage() {
  const { loading, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmation) {
      setError("Le password non coincidono.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updatePassword(password);
      navigate("/", { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Aggiornamento non riuscito.");
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Caricamento sessione</main>;
  }
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="space-y-3 text-sm">
          <ErrorNotice message="Il link è scaduto o non contiene una sessione valida." />
          <Link className="text-primary hover:underline" to="/login">Torna all'accesso</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Imposta la password</CardTitle>
          <CardDescription>Scegli una password di almeno 8 caratteri.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && <ErrorNotice message={error} onDismiss={() => setError(null)} />}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="new-password">Nuova password</label>
              <Input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="confirm-password">Conferma password</label>
              <Input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            </div>
            <Button className="w-full" type="submit" disabled={pending}>{pending ? "Salvataggio..." : "Salva password"}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
