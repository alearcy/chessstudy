import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Settings } from "lucide-react";
import LessonsPage from "@/pages/LessonsPage";
import LessonDetailPage from "@/pages/LessonDetailPage";
import SettingsDialog from "@/components/SettingsDialog";
import { Button } from "@/components/ui/button";

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

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
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
            <a href="/" className="text-xl font-bold tracking-tight">
              Chess Study
            </a>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setSettingsOpen(true)}
              title="Impostazioni AI"
            >
              <Settings className="size-4" />
            </Button>
          </div>
        </header>
        <main className="px-6 py-8">
          <Routes>
            <Route path="/" element={<LessonsPage />} />
            <Route path="/lesson/:id" element={<LessonDetailPage />} />
          </Routes>
        </main>
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      </div>
    </HashRouter>
  );
}

export default App;