import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  loading: false,
  passwordChangeRequired: false,
  user: null as { id: string } | null,
}));

vi.mock("@/auth/authContext", () => ({ useAuth: () => authState }));

import ProtectedRoute from "@/auth/ProtectedRoute";

function LoginProbe() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from;
  return <div>Login da {from?.pathname ?? "nessuna route"}</div>;
}

afterEach(() => {
  cleanup();
  authState.loading = false;
  authState.passwordChangeRequired = false;
  authState.user = null;
});

describe("ProtectedRoute", () => {
  it("redirects anonymous users while preserving the requested route", () => {
    render(
      <MemoryRouter initialEntries={["/lesson/42"]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/lesson/:id" element={<div>Lezione privata</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login da /lesson/42")).toBeTruthy();
  });

  it("shows a loading state and renders private content only for a user", () => {
    authState.loading = true;
    const view = render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Area privata</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Caricamento sessione")).toBeTruthy();

    authState.loading = false;
    authState.user = { id: "user-1" };
    view.rerender(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Area privata</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Area privata")).toBeTruthy();
  });

  it("forces new users onto the initial password form", () => {
    authState.user = { id: "user-1" };
    authState.passwordChangeRequired = true;

    render(
      <MemoryRouter initialEntries={["/lesson/42"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/lesson/:id" element={<div>Lezione privata</div>} />
            <Route path="/account/first-password" element={<div>Nuova password obbligatoria</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Nuova password obbligatoria")).toBeTruthy();
    expect(screen.queryByText("Lezione privata")).toBeNull();
  });

  it("keeps initialized users out of the first-password route", () => {
    authState.user = { id: "user-1" };

    render(
      <MemoryRouter initialEntries={["/account/first-password"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Area privata</div>} />
            <Route path="/account/first-password" element={<div>Nuova password obbligatoria</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Area privata")).toBeTruthy();
    expect(screen.queryByText("Nuova password obbligatoria")).toBeNull();
  });
});
