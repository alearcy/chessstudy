import { useCallback, useEffect, useState } from "react";
import { Gamepad2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getAppSettings,
  setAppSettings,
  type AppSettingsInfo,
} from "@/services/settingsService";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChanged?: () => void;
}

export default function SettingsDialog({ open, onOpenChange, onSettingsChanged }: SettingsDialogProps) {
  const [lichessUsername, setLichessUsername] = useState("");
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadSettings = useCallback(async () => {
    try {
      const info: AppSettingsInfo = await getAppSettings();
      setLichessUsername(info.lichess_username);
      setChesscomUsername(info.chesscom_username);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    if (open) void loadSettings();
  }, [open, loadSettings]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    setError(null);
    try {
      const saved = await setAppSettings({
        lichess_username: lichessUsername.trim(),
        chesscom_username: chesscomUsername.trim(),
      });
      setLichessUsername(saved.lichess_username);
      setChesscomUsername(saved.chesscom_username);
      onSettingsChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Impostazioni</DialogTitle>
          <DialogDescription>Configura gli account usati per importare le partite.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Gamepad2 className="size-4" />
                Account di gioco
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="lichess-username" className="text-sm font-medium">
                    Username Lichess
                  </label>
                  <Input
                    id="lichess-username"
                    value={lichessUsername}
                    onChange={(event) => setLichessUsername(event.target.value)}
                    placeholder="es. DrNykterstein"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="chesscom-username" className="text-sm font-medium">
                    Username Chess.com
                  </label>
                  <Input
                    id="chesscom-username"
                    value={chesscomUsername}
                    onChange={(event) => setChesscomUsername(event.target.value)}
                    placeholder="es. Hikaru"
                    autoComplete="off"
                  />
                </div>
              </div>
            </section>

        </div>

        <DialogFooter>
          <Button onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            <span className="ml-1">Salva impostazioni</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
