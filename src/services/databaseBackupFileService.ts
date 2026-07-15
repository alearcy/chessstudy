function backupFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `chessstudy-backup-${date}.json`;
}

function basename(path: string): string {
  return path.split(/[\\/]/).pop() || path;
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function saveDatabaseBackupFile(contents: string): Promise<string | null> {
  const filename = backupFilename();
  if (isTauriRuntime()) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await save({
      defaultPath: filename,
      filters: [{ name: "Backup Chess Study", extensions: ["json"] }],
    });
    if (!path) return null;
    await writeTextFile(path, contents);
    return basename(path);
  }

  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  return filename;
}

export interface SelectedBackupFile {
  name: string;
  contents: string;
}

export async function selectDatabaseBackupFile(): Promise<SelectedBackupFile | null> {
  if (isTauriRuntime()) {
    const [{ open }, { readTextFile }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/plugin-fs"),
    ]);
    const path = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "Backup Chess Study", extensions: ["json"] }],
    });
    if (typeof path !== "string") return null;
    return { name: basename(path), contents: await readTextFile(path) };
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { name: file.name, contents: await file.text() } : null);
    };
    input.oncancel = () => resolve(null);
    input.click();
  });
}
