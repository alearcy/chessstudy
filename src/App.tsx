import { useState, useEffect } from "react";
import { HashRouter, Routes, Route } from "react-router-dom";
import { DatabaseBackup, Settings } from "lucide-react";
import LessonsPage from "@/pages/LessonsPage";
import LessonDetailPage from "@/pages/LessonDetailPage";
import SettingsDialog from "@/components/SettingsDialog";
import DatabaseBackupDialog from "@/components/DatabaseBackupDialog";
import { Button } from "@/components/ui/button";
import { DATABASE_BACKUP_RESTORED_EVENT } from "@/services/databaseBackupService";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        await import("@tauri-apps/api/core");
      } catch {
        // web: settings dialog shows info message
      }
    }
    check();
  }, []);

  return (
    <HashRouter>
      <div className="min-h-screen bg-background text-foreground">
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-[96rem] items-center gap-3 px-6 py-4">
            <a href="/" className="text-xl font-bold tracking-tight">
              Chess Study
            </a>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setBackupOpen(true)}
              title="Backup dati"
              aria-label="Backup dati"
            >
              <DatabaseBackup className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSettingsOpen(true)}
              title="Impostazioni"
              aria-label="Impostazioni"
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[96rem] px-4 py-4">
          <Routes>
            <Route path="/" element={<LessonsPage onOpenSettings={() => setSettingsOpen(true)} />} />
            <Route path="/lesson/:id" element={<LessonDetailPage />} />
          </Routes>
        </main>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
        <DatabaseBackupDialog
          open={backupOpen}
          onOpenChange={setBackupOpen}
          onRestored={() => {
            window.dispatchEvent(new Event(DATABASE_BACKUP_RESTORED_EVENT));
          }}
        />
      </div>
    </HashRouter>
  );
}

export default App;
