import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "@/auth/authService";
import ErrorNotice from "@/components/ErrorNotice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch {
      setError("Impossibile inviare l'email in questo momento. Riprova.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Recupera password</CardTitle>
          <CardDescription>Riceverai un link se l'indirizzo appartiene a un account invitato.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-sm">
              <p>Se l'account esiste, l'email di recupero è stata inviata.</p>
              <Link className="text-primary hover:underline" to="/login">Torna all'accesso</Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error && <ErrorNotice message={error} onDismiss={() => setError(null)} />}
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="recovery-email">Email</label>
                <Input
                  id="recovery-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <Button className="w-full" type="submit" disabled={pending}>
                {pending ? "Invio in corso..." : "Invia link di recupero"}
              </Button>
              <Link className="block text-center text-sm text-primary hover:underline" to="/login">Torna all'accesso</Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
