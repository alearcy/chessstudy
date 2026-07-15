import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import DatabaseBackupDialog from "@/components/DatabaseBackupDialog";

const {
  createBackupMock,
  inspectBackupMock,
  restoreBackupMock,
  saveBackupFileMock,
  selectBackupFileMock,
} = vi.hoisted(() => ({
  createBackupMock: vi.fn(),
  inspectBackupMock: vi.fn(),
  restoreBackupMock: vi.fn(),
  saveBackupFileMock: vi.fn(),
  selectBackupFileMock: vi.fn(),
}));

vi.mock("@/services/databaseBackupService", () => ({
  createDatabaseBackupJson: createBackupMock,
  inspectDatabaseBackupJson: inspectBackupMock,
  restoreDatabaseBackupJson: restoreBackupMock,
}));

vi.mock("@/services/databaseBackupFileService", () => ({
  saveDatabaseBackupFile: saveBackupFileMock,
  selectDatabaseBackupFile: selectBackupFileMock,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DatabaseBackupDialog", () => {
  it("exports a backup and shows where it was saved", async () => {
    createBackupMock.mockResolvedValue("backup-json");
    saveBackupFileMock.mockResolvedValue("chessstudy-backup-2026-07-15.json");

    const view = render(
      <DatabaseBackupDialog open onOpenChange={vi.fn()} onRestored={vi.fn()} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Esporta backup" }));

    expect(await view.findByText(/Backup salvato:/)).toBeTruthy();
    expect(view.getByText(/chessstudy-backup-2026-07-15\.json/)).toBeTruthy();
    expect(saveBackupFileMock).toHaveBeenCalledWith("backup-json");
  });

  it("validates the selected file and requires confirmation before restore", async () => {
    selectBackupFileMock.mockResolvedValue({ name: "famiglia.json", contents: "backup-json" });
    inspectBackupMock.mockReturnValue({ profiles: 2, lessons: 8, boards: 10, moves: 240 });
    restoreBackupMock.mockResolvedValue({ profiles: 2, lessons: 8, boards: 10, moves: 240 });
    const onRestored = vi.fn();

    const view = render(
      <DatabaseBackupDialog open onOpenChange={vi.fn()} onRestored={onRestored} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Scegli backup da importare" }));

    expect(await view.findByText("famiglia.json")).toBeTruthy();
    expect(view.getByText("2 profili, 8 lezioni, 10 scacchiere e 240 mosse")).toBeTruthy();
    expect(restoreBackupMock).not.toHaveBeenCalled();

    fireEvent.click(view.getByRole("button", { name: "Ripristina e sostituisci i dati" }));

    await waitFor(() => {
      expect(restoreBackupMock).toHaveBeenCalledWith("backup-json");
      expect(onRestored).toHaveBeenCalledOnce();
    });
    expect(view.getByText("Backup ripristinato correttamente.")).toBeTruthy();
  });

  it("shows an actionable error when file selection or validation fails", async () => {
    selectBackupFileMock.mockResolvedValue({ name: "rotto.json", contents: "not-json" });
    inspectBackupMock.mockImplementation(() => {
      throw new Error("Formato non supportato");
    });

    const view = render(
      <DatabaseBackupDialog open onOpenChange={vi.fn()} onRestored={vi.fn()} />,
    );
    fireEvent.click(view.getByRole("button", { name: "Scegli backup da importare" }));

    expect(await view.findByText("Formato non supportato")).toBeTruthy();
    expect(view.getByRole("button", { name: "Riprova" })).toBeTruthy();
  });
});
