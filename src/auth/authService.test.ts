import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
}));
const securityState = vi.hoisted(() => ({
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth,
    from: vi.fn(() => securityState),
  },
}));

import {
  changePassword,
  confirmEmailOtp,
  getPasswordChangeRequired,
  requestPasswordReset,
  signIn,
  signOut,
  updatePassword,
} from "@/auth/authService";

beforeEach(() => {
  vi.clearAllMocks();
  auth.signInWithPassword.mockResolvedValue({ error: null });
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  auth.verifyOtp.mockResolvedValue({ error: null });
  auth.updateUser.mockResolvedValue({ error: null });
  auth.signOut.mockResolvedValue({ error: null });
  securityState.select.mockReturnValue(securityState);
  securityState.eq.mockReturnValue(securityState);
  securityState.maybeSingle.mockResolvedValue({
    data: { must_change_password: false },
    error: null,
  });
});

describe("authService", () => {
  it("normalizes the email before password login", async () => {
    await signIn("  Studio@Example.COM ", "segreta");

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "studio@example.com",
      password: "segreta",
    });
  });

  it("requests password recovery on the public update route", async () => {
    await requestPasswordReset(" USER@example.com ", "https://chess.example");

    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
      "user@example.com",
      { redirectTo: "https://chess.example/auth/update-password" },
    );
  });

  it("verifies invite token hashes without accepting arbitrary OTP types", async () => {
    const type = await confirmEmailOtp(
      new URLSearchParams("token_hash=token-123&type=invite"),
    );

    expect(type).toBe("invite");
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: "token-123",
      type: "invite",
    });
    await expect(
      confirmEmailOtp(new URLSearchParams("token_hash=x&type=unknown")),
    ).rejects.toThrow("Link di autenticazione non valido");
  });

  it("updates a password only after the current password is rechecked", async () => {
    await changePassword({
      email: "player@example.com",
      currentPassword: "vecchia",
      newPassword: "nuova-password",
    });

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "player@example.com",
      password: "vecchia",
    });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "nuova-password" });

    auth.signInWithPassword.mockResolvedValueOnce({ error: new Error("credenziali") });
    await expect(changePassword({
      email: "player@example.com",
      currentPassword: "errata",
      newPassword: "non-usata",
    })).rejects.toThrow("credenziali");
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
  });

  it("surfaces update and logout errors", async () => {
    await updatePassword("password-nuova");
    await signOut();

    expect(auth.updateUser).toHaveBeenCalledWith({ password: "password-nuova" });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it("reads the first-access gate for the authenticated user", async () => {
    securityState.maybeSingle.mockResolvedValueOnce({
      data: { must_change_password: true },
      error: null,
    });

    await expect(getPasswordChangeRequired("user-1")).resolves.toBe(true);
    expect(securityState.select).toHaveBeenCalledWith("must_change_password");
    expect(securityState.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
