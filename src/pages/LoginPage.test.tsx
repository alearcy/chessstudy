import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth/authService", () => ({ signIn: signInMock }));

import LoginPage from "@/pages/LoginPage";

beforeEach(() => signInMock.mockResolvedValue(undefined));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginPage", () => {
  it("shows the Chess Study PNG as the form brand", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    const logo = screen.getByRole("img", { name: "Chess Study" });
    expect(logo.getAttribute("src")).toBe("/chessstudy.png");
    expect(screen.queryByText("Chess Study")).toBeNull();
  });

  it("offers login and password recovery but no public registration", () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    expect(screen.getByRole("button", { name: "Accedi" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Password dimenticata?" })).toBeTruthy();
    expect(screen.queryByText(/registr/i)).toBeNull();
  });

  it("shows authentication errors on the form", async () => {
    signInMock.mockRejectedValueOnce(new Error("Credenziali non valide"));
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "errata" } });
    fireEvent.click(screen.getByRole("button", { name: "Accedi" }));

    expect(await screen.findByText("Credenziali non valide")).toBeTruthy();
  });
});
