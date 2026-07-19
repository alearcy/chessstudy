import { act, cleanup, render, screen } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
}));
const securityStateMock = vi.hoisted(() => ({
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    auth: authMock,
    from: vi.fn(() => securityStateMock),
  },
}));

import { AuthProvider } from "@/auth/AuthProvider";
import { useAuth } from "@/auth/authContext";

let authListener: ((event: string, session: { user: User } | null) => void) | null;

function Probe() {
  const { loading, passwordChangeRequired, user } = useAuth();
  if (loading) return <div>Caricamento sessione</div>;
  return <div>{user?.email ?? "Anonimo"} - {passwordChangeRequired ? "Cambio richiesto" : "Password inizializzata"}</div>;
}

beforeEach(() => {
  authListener = null;
  authMock.getUser.mockResolvedValue({
    data: { user: { id: "user-1", email: "player@example.com" } as User },
    error: null,
  });
  authMock.onAuthStateChange.mockImplementation((listener) => {
    authListener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  securityStateMock.select.mockReturnValue(securityStateMock);
  securityStateMock.eq.mockReturnValue(securityStateMock);
  securityStateMock.maybeSingle.mockResolvedValue({
    data: { must_change_password: false },
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("restores the authenticated user and reacts to sign out", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);

    expect(screen.getByText("Caricamento sessione")).toBeTruthy();
    expect(await screen.findByText("player@example.com - Password inizializzata")).toBeTruthy();

    act(() => authListener?.("SIGNED_OUT", null));
    expect(screen.getByText("Anonimo - Password inizializzata")).toBeTruthy();
  });

  it("loads the mandatory password state before exposing an authenticated user", async () => {
    securityStateMock.maybeSingle.mockResolvedValueOnce({
      data: { must_change_password: true },
      error: null,
    });

    render(<AuthProvider><Probe /></AuthProvider>);

    expect(await screen.findByText("player@example.com - Cambio richiesto")).toBeTruthy();
  });
});
