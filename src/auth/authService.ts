import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";

const ALLOWED_EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function throwIfError(error: Error | null): void {
  if (error) throw error;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail(email),
    password,
  });
  throwIfError(error);
}

export async function requestPasswordReset(
  email: string,
  appOrigin = window.location.origin,
): Promise<void> {
  const origin = appOrigin.replace(/\/$/, "");
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizedEmail(email),
    { redirectTo: `${origin}/auth/update-password` },
  );
  throwIfError(error);
}

export async function confirmEmailOtp(
  searchParams: URLSearchParams,
): Promise<EmailOtpType> {
  const tokenHash = searchParams.get("token_hash");
  const rawType = searchParams.get("type");
  if (!tokenHash || !rawType || !ALLOWED_EMAIL_OTP_TYPES.has(rawType as EmailOtpType)) {
    throw new Error("Link di autenticazione non valido.");
  }

  const type = rawType as EmailOtpType;
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });
  throwIfError(error);
  return type;
}

export async function updatePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  throwIfError(error);
}

export async function getPasswordChangeRequired(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_security_state")
    .select("must_change_password")
    .eq("user_id", userId)
    .maybeSingle();
  throwIfError(error);
  if (!data) {
    throw new Error("Stato di sicurezza dell'account non disponibile.");
  }
  return data.must_change_password;
}

export async function changePassword(args: {
  email: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await signIn(args.email, args.currentPassword);
  await updatePassword(args.newPassword);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  throwIfError(error);
}
