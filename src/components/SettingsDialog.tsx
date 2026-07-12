import { useCallback, useEffect, useState } from "react";
import { Cpu, Gamepad2, Gauge, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { resetStockfishSettingsCache } from "@/services/analysisService";
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

const DEFAULT_STOCKFISH_DEPTH = 15;
const DEFAULT_STOCKFISH_THREADS = 2;

const DEPTH_OPTIONS = [
  { value: 10, label: "Veloce", hint: "analisi rapida" },
  { value: 15, label: "Bilanciata", hint: "scelta consigliata" },
  { value: 20, label: "Profonda", hint: "piu lenta" },
  { value: 25, label: "Molto profonda", hint: "molto lenta" },
];

export default function SettingsDialog({ open, onOpenChange, onSettingsChanged }: SettingsDialogProps) {
  const [stockfishDepth, setStockfishDepth] = useState(DEFAULT_STOCKFISH_DEPTH);
  const [stockfishThreads, setStockfishThreads] = useState(DEFAULT_STOCKFISH_THREADS);
  const [lichessUsername, setLichessUsername] = useState("");
  const [chesscomUsername, setChesscomUsername] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState<boolean | null>(null);
  const detectedThreads =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : null;
  const cpuOptions = buildCpuOptions(detectedThreads);

  useEffect(() => {
    async function check() {
      try {
        await getAppSettings();
        setIsTauri(true);
      } catch {
        setIsTauri(false);
      }
    }
    check();
  }, []);

  const loadSettings = useCallback(async () => {
    if (!isTauri) return;
    try {
      const info: AppSettingsInfo = await getAppSettings();
      setStockfishDepth(normalizeDepthOption(info.stockfish_depth));
      setStockfishThreads(normalizeCpuOption(info.stockfish_threads, buildCpuOptions(detectedThreads)));
      setLichessUsername(info.lichess_username);
      setChesscomUsername(info.chesscom_username);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [detectedThreads, isTauri]);

  useEffect(() => {
    if (open && isTauri) {
      loadSettings();
    }
  }, [open, isTauri, loadSettings]);

  const handleSaveSettings = async () => {
    if (!isTauri) return;
    setSavingSettings(true);
    setError(null);
    try {
      const depth = normalizeDepthOption(stockfishDepth);
      const threads = normalizeCpuOption(stockfishThreads, cpuOptions);
      const saved = await setAppSettings({
        stockfish_depth: depth,
        stockfish_threads: threads,
        lichess_username: lichessUsername.trim(),
        chesscom_username: chesscomUsername.trim(),
      });
      resetStockfishSettingsCache();
      setStockfishDepth(depth);
      setStockfishThreads(threads);
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
          <DialogDescription>Configura motore e account usati per importare le partite.</DialogDescription>
        </DialogHeader>

        {!isTauri ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            Le impostazioni Stockfish sono disponibili nell'app desktop.
          </div>
        ) : (
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

            <div className="border-t" />

            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Cpu className="size-4" />
                Stockfish
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Gauge className="size-4" />
                    Profondita
                  </label>
                  <select
                    value={stockfishDepth}
                    onChange={(event) => setStockfishDepth(Number(event.target.value))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    {DEPTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} - depth {option.value}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {DEPTH_OPTIONS.find((option) => option.value === stockfishDepth)?.hint}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <Cpu className="size-4" />
                    CPU
                  </label>
                  <select
                    value={stockfishThreads}
                    onChange={(event) => setStockfishThreads(Number(event.target.value))}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    {cpuOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {detectedThreads ? `Rilevati ${detectedThreads} thread logici.` : "Thread CPU non rilevati."}
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          {isTauri && (
            <Button onClick={handleSaveSettings} disabled={savingSettings}>
              {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              <span className="ml-1">Salva impostazioni</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function normalizeDepthOption(value: number) {
  return DEPTH_OPTIONS.some((option) => option.value === value)
    ? value
    : DEFAULT_STOCKFISH_DEPTH;
}

function normalizeCpuOption(
  value: number,
  options: Array<{ value: number; label: string }>,
) {
  return options.some((option) => option.value === value)
    ? value
    : DEFAULT_STOCKFISH_THREADS;
}

function buildCpuOptions(detectedThreads: number | null) {
  const max = detectedThreads ?? 4;
  const balanced = Math.max(1, Math.min(Math.ceil(max / 2), 32));
  const fast = Math.max(balanced, Math.min(max, 32));
  const options = [
    { value: 1, label: "1 thread" },
    { value: DEFAULT_STOCKFISH_THREADS, label: `${DEFAULT_STOCKFISH_THREADS} thread (consigliato)` },
    { value: balanced, label: `${balanced} thread` },
    { value: fast, label: `${fast} thread` },
  ];

  const uniqueOptions = options.filter(
    (option, index, list) => list.findIndex((item) => item.value === option.value) === index,
  );
  return uniqueOptions.sort((a, b) => a.value - b.value);
}
