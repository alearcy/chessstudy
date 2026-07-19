function backupFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `chessstudy-backup-${date}.json`;
}

export async function saveDatabaseBackupFile(contents: string): Promise<string | null> {
  const filename = backupFilename();
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
