import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const updatePasswordMock = vi.hoisted(() => vi.fn());
const refreshPasswordChangeRequiredMock = vi.hoisted(() => vi.fn());

vi.mock("@/auth/authService", () => ({ updatePassword: updatePasswordMock }));
vi.mock("@/auth/authContext", () => ({
  useAuth: () => ({
    refreshPasswordChangeRequired: refreshPasswordChangeRequiredMock,
  }),
}));

import FirstPasswordPage from "@/pages/FirstPasswordPage";

beforeEach(() => {
  updatePasswordMock.mockResolvedValue(undefined);
  refreshPasswordChangeRequiredMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FirstPasswordPage", () => {
  it("requires and confirms a new password without offering navigation away", async () => {
    render(<MemoryRouter><FirstPasswordPage /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "Cambia la password temporanea" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();

    fireEvent.change(screen.getByLabelText("Nuova password"), {
      target: { value: "password-nuova" },
    });
    fireEvent.change(screen.getByLabelText("Conferma password"), {
      target: { value: "password-nuova" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salva e continua" }));

    expect(updatePasswordMock).toHaveBeenCalledWith("password-nuova");
    expect(await screen.findByText("Password aggiornata. Accesso in corso...")).toBeTruthy();
    expect(refreshPasswordChangeRequiredMock).toHaveBeenCalledOnce();
  });
});
