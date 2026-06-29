import { useCallback, useEffect, useState } from "react";
import { Brain, CheckCircle, Cpu, Gauge, Loader2, Save, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { resetStockfishSettingsCache } from "@/services/analysisService";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChanged?: () => void;
}

const DEFAULT_LLM_BASE_URL = "http://localhost:11434";
const DEFAULT_LLM_MODEL = "gemma3:4b";
const DEFAULT_STOCKFISH_DEPTH = 15;
const DEFAULT_STOCKFISH_THREADS = 1;

const DEPTH_OPTIONS = [
  { value: 10, label: "Veloce", hint: "analisi rapida" },
  { value: 15, label: "Bilanciata", hint: "scelta consigliata" },
  { value: 20, label: "Profonda", hint: "piu lenta" },
  { value: 25, label: "Molto profonda", hint: "molto lenta" },
] as const;

interface SettingsInfo {
  llm_base_url: string;
  llm_model: string;
  stockfish_depth: number;
  stockfish_threads: number;
}

interface LlmStatus {
  ready: boolean;
  model_available: boolean;
  base_url: string;
  model: string;
}

export default function SettingsDialog({ open, onOpenChange, onSettingsChanged }: SettingsDialogProps) {
  const [llmBaseUrl, setLlmBaseUrl] = useState(DEFAULT_LLM_BASE_URL);
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL);
  const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
  const [checkingLlm, setCheckingLlm] = useState(false);
  const [savingLlm, setSavingLlm] = useState(false);
  const [stockfishDepth, setStockfishDepth] = useState(DEFAULT_STOCKFISH_DEPTH);
  const [stockfishThreads, setStockfishThreads] = useState(DEFAULT_STOCKFISH_THREADS);
  const [savingStockfish, setSavingStockfish] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState<boolean | null>(null);
  const detectedThreads =
    typeof navigator.hardwareConcurrency === "number"
      ? Math.min(navigator.hardwareConcurrency, 32)
      : null;
  const cpuOptions = buildCpuOptions(detectedThreads);

  useEffect(() => {
    async function check() {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("get_settings");
        setIsTauri(true);
      } catch {
        setIsTauri(false);
      }
    }
    check();
  }, []);

  const checkLlmStatus = useCallback(async () => {
    if (!isTauri) return;
    setCheckingLlm(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const status = await invoke<LlmStatus>("llm_status");
      setLlmStatus(status);
    } catch {
      setLlmStatus(null);
    } finally {
      setCheckingLlm(false);
    }
  }, [isTauri]);

  const loadSettings = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const info = await invoke<SettingsInfo>("get_settings");
      setLlmBaseUrl(info.llm_base_url || DEFAULT_LLM_BASE_URL);
      setLlmModel(info.llm_model || DEFAULT_LLM_MODEL);
      setStockfishDepth(normalizeDepthOption(info.stockfish_depth));
      setStockfishThreads(normalizeCpuOption(info.stockfish_threads, buildCpuOptions(detectedThreads)));
    } catch {
      setLlmStatus(null);
    }
  }, [isTauri, detectedThreads]);

  useEffect(() => {
    if (open && isTauri !== false) {
      loadSettings();
      checkLlmStatus();
      setError(null);
    }
  }, [open, isTauri, loadSettings, checkLlmStatus]);

  const handleSaveLlm = async () => {
    if (!isTauri) return;
    setSavingLlm(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_settings", {
        args: {
          llm_base_url: llmBaseUrl,
          llm_model: llmModel,
        },
      });
      await checkLlmStatus();
      onSettingsChanged?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingLlm(false);
    }
  };

  const handleSaveStockfish = async () => {
    if (!isTauri) return;
    setSavingStockfish(true);
    setError(null);
    try {
      const depth = normalizeDepthOption(stockfishDepth);
      const threads = normalizeCpuOption(stockfishThreads, cpuOptions);
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_settings", {
        args: {
          stockfish_depth: depth,
          stockfish_threads: threads,
        },
      });
      resetStockfishSettingsCache();
      setStockfishDepth(depth);
      setStockfishThreads(threads);
      window.dispatchEvent(new Event("stockfish-settings-changed"));
      onSettingsChanged?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingStockfish(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="size-5" />
            Impostazioni
          </DialogTitle>
          <DialogDescription>
            {isTauri
              ? "Configura AI locale e analisi Stockfish."
              : "Avvia l'app con Tauri desktop per modificare le impostazioni."}
          </DialogDescription>
        </DialogHeader>

        {!isTauri ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            {isTauri === null ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin" />
                Verifica ambiente...
              </div>
            ) : (
              <p>
                Le impostazioni sono disponibili solo nell&apos;app desktop.
                Avvia con <code className="rounded bg-muted px-1">npm run tauri dev</code>.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-3 border-b pb-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Brain className="size-4" />
                  AI locale
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  <span>Stato:</span>
                  {checkingLlm ? (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Verifica...
                    </span>
                  ) : llmStatus?.ready ? (
                    <span className="flex items-center gap-1 font-medium text-green-600">
                      <CheckCircle className="size-4" />
                      Server locale attivo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <XCircle className="size-4" />
                      Server locale non raggiungibile
                    </span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="llm-base-url" className="text-sm font-medium">
                      URL server
                    </label>
                    <Input
                      id="llm-base-url"
                      value={llmBaseUrl}
                      onChange={(e) => setLlmBaseUrl(e.target.value)}
                      placeholder={DEFAULT_LLM_BASE_URL}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="llm-model" className="text-sm font-medium">
                      Modello
                    </label>
                    <Input
                      id="llm-model"
                      value={llmModel}
                      onChange={(e) => setLlmModel(e.target.value)}
                      placeholder={DEFAULT_LLM_MODEL}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Default: Ollama locale con {DEFAULT_LLM_MODEL}. Gemma 4B e leggero abbastanza per commenti didattici brevi.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleSaveLlm} disabled={savingLlm}>
                    {savingLlm ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    <span className="ml-1">Salva AI</span>
                  </Button>
                  <Button variant="outline" onClick={checkLlmStatus} disabled={checkingLlm}>
                    {checkingLlm && <Loader2 className="mr-1 size-4 animate-spin" />}
                    Verifica
                  </Button>
                </div>
              </section>

              <section className="flex flex-col gap-3 border-b pb-4">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Gauge className="size-4" />
                  Stockfish
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="stockfish-depth" className="text-sm font-medium">
                      Profondità
                    </label>
                    <select
                      id="stockfish-depth"
                      value={stockfishDepth}
                      onChange={(e) => setStockfishDepth(Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {DEPTH_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} - d{option.value}, {option.hint}
                        </option>
                      ))}
                    </select>
                    {stockfishDepth >= 20 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Profondità alte possono aumentare molto il tempo di analisi.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="stockfish-threads" className="flex items-center gap-1 text-sm font-medium">
                      <Cpu className="size-4" />
                      CPU
                    </label>
                    <select
                      id="stockfish-threads"
                      value={stockfishThreads}
                      onChange={(e) => setStockfishThreads(Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {cpuOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label} - {option.description}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {detectedThreads
                        ? `Rilevati ${detectedThreads} thread logici.`
                        : "Numero core non disponibile: valori conservativi."}
                    </p>
                  </div>
                </div>
                <div>
                  <Button variant="outline" onClick={handleSaveStockfish} disabled={savingStockfish}>
                    {savingStockfish ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    <span className="ml-1">Salva Stockfish</span>
                  </Button>
                </div>
              </section>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Chiudi
              </Button>
            </DialogFooter>
          </>
        )}
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
  options: Array<{ value: number; label: string; description: string }>
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
    { value: 1, label: "Leggera", description: "impatto minimo" },
    { value: balanced, label: "Bilanciata", description: "scelta consigliata" },
    { value: fast, label: "Rapida", description: detectedThreads ? "usa piu CPU" : "usa piu risorse" },
  ];
  const uniqueOptions = options.filter(
    (option, index) =>
      options.findIndex((candidate) => candidate.value === option.value) === index
  );
  return uniqueOptions.sort((a, b) => a.value - b.value);
}
