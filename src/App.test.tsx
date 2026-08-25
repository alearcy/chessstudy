import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

vi.mock("@/auth/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/auth/authContext", () => ({
  useAuth: () => ({
    authError: null,
    loading: false,
    passwordChangeRequired: false,
    refreshPasswordChangeRequired: vi.fn(),
    user: { id: "user-1", email: "player@example.com" },
  }),
}));
vi.mock("@/auth/authService", () => ({ signOut: vi.fn() }));

vi.mock("@/pages/LessonsPage", () => ({ default: () => <div>Lezioni</div> }));
vi.mock("@/pages/LessonDetailPage", () => ({ default: () => <div>Dettaglio</div> }));
vi.mock("@/pages/LoginPage", () => ({ default: () => <div>Accesso pubblico</div> }));
vi.mock("@/components/SettingsDialog", () => ({
  default: ({ open }: { open: boolean }) => open ? <div>Dialog impostazioni aperto</div> : null,
}));
vi.mock("@/components/DatabaseBackupDialog", () => ({
  default: ({ open, onRestored }: { open: boolean; onRestored: () => void }) =>
    open ? (
      <div>
        <span>Dialog backup aperto</span>
        <button onClick={onRestored}>Segnala ripristino</button>
      </div>
    ) : null,
}));

const PORTRAIT_QUERY = "(orientation: portrait) and (max-width: 1279px)";

function installMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  const mediaQueryList = {
    get matches() {
      return matches;
    },
    media: PORTRAIT_QUERY,
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: (listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => mediaQueryList),
  });

  return {
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      const event = { matches, media: PORTRAIT_QUERY } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

beforeEach(() => {
  window.history.pushState({}, "", "/");
  installMatchMedia(false);
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "matchMedia");
});

describe("App toolbar", () => {
  it("shows the current year copyright in the private shell", () => {
    const view = render(<App />);

    expect(view.getByText(`© ${new Date().getFullYear()} Alessandro Arcidiaco`)).toBeTruthy();
  });

  it("uses the Chessstudy PNG as the home link", () => {
    const view = render(<App />);
    const homeLink = view.getByRole("link", { name: "Chessstudy" });
    const logo = view.getByRole("img", { name: "Chessstudy" });

    expect(homeLink.getAttribute("href")).toBe("/");
    expect(homeLink.contains(logo)).toBe(true);
    expect(logo.getAttribute("src")).toBe("/chessstudy.png");
  });

  it("shows an icon-only backup button next to settings and opens the dialog", () => {
    const view = render(<App />);
    const backupButton = view.getByRole("button", { name: "Backup dati" });
    const settingsButton = view.getByRole("button", { name: "Impostazioni" });

    expect(backupButton.textContent).toBe("");
    expect(backupButton.nextElementSibling).toBe(settingsButton);

    fireEvent.click(backupButton);
    expect(view.getByText("Dialog backup aperto")).toBeTruthy();
  });

  it("announces a completed restore to the active page", () => {
    const listener = vi.fn();
    window.addEventListener("chessstudy:database-backup-restored", listener);
    const view = render(<App />);

    fireEvent.click(view.getByRole("button", { name: "Backup dati" }));
    fireEvent.click(view.getByRole("button", { name: "Segnala ripristino" }));

    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener("chessstudy:database-backup-restored", listener);
  });

  it("replaces the private shell in portrait and restores it in landscape", () => {
    const orientation = installMatchMedia(true);
    const view = render(<App />);

    expect(view.getByRole("status", { name: "Ruota il dispositivo" })).toBeTruthy();
    expect(view.queryByText("Lezioni")).toBeNull();
    expect(
      view.container.querySelector(".cs-orientation-device")?.getAttribute("class"),
    ).toContain("motion-reduce:animate-none");

    act(() => orientation.setMatches(false));

    expect(view.queryByRole("status", { name: "Ruota il dispositivo" })).toBeNull();
    expect(view.getByText("Lezioni")).toBeTruthy();
  });

  it("asks for confirmation before logging out", async () => {
    const { signOut } = await import("@/auth/authService");
    const view = render(<App />);

    fireEvent.click(view.getByRole("button", { name: "Esci" }));
    expect(signOut).not.toHaveBeenCalled();
    expect(view.getByRole("dialog")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Annulla" }));
    expect(view.queryByRole("dialog")).toBeNull();
    expect(signOut).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Esci" }));
    const confirmButtons = view.getAllByRole("button", { name: "Esci" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("keeps public authentication routes accessible in portrait", () => {
    installMatchMedia(true);
    window.history.pushState({}, "", "/login");
    const view = render(<App />);

    expect(view.getByText("Accesso pubblico")).toBeTruthy();
    expect(view.queryByRole("status", { name: "Ruota il dispositivo" })).toBeNull();
    expect(view.queryByText(`© ${new Date().getFullYear()} Alessandro Arcidiaco`)).toBeNull();
  });
});
