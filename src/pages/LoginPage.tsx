import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signIn } from "@/auth/authService";
import BrandLogo from "@/components/BrandLogo";
import ErrorNotice from "@/components/ErrorNotice";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Accesso non riuscito.";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn(email, password);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from;
      navigate(from?.pathname ?? "/", { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader className="justify-items-center text-center">
          <CardTitle>
            <BrandLogo className="w-56 max-w-full" />
          </CardTitle>
          <CardDescription>Accedi con l'account ricevuto tramite invito.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && <ErrorNotice message={error} onDismiss={() => setError(null)} />}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="login-email">Email</label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="login-password">Password</label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            <Button className="w-full" type="submit" disabled={pending}>
              {pending ? "Accesso in corso..." : "Accedi"}
            </Button>
            <Link className="block text-center text-sm text-primary hover:underline" to="/auth/forgot-password">
              Password dimenticata?
            </Link>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
