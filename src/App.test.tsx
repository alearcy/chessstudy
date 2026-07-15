import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

vi.mock("@/pages/LessonsPage", () => ({ default: () => <div>Lezioni</div> }));
vi.mock("@/pages/LessonDetailPage", () => ({ default: () => <div>Dettaglio</div> }));
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

afterEach(cleanup);

describe("App toolbar", () => {
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
});
