import { useState, useEffect, useCallback } from "react";
import { Key, Eye, EyeOff, Trash2, Loader2, CheckCircle, XCircle } from "lucide-react";
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

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsChanged?: () => void;
}

const DEFAULT_MODEL = "openai/gpt-4o-mini";

export default function SettingsDialog({ open, onOpenChange, onSettingsChanged }: SettingsDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTauri, setIsTauri] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (open && isTauri !== false) {
      loadSettings();
      setApiKey("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isTauri]);

  const loadSettings = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const info = await invoke<{ api_key_configured: boolean; model: string }>("get_settings");
      setConfigured(info.api_key_configured);
      if (info.model) setModel(info.model);
    } catch {
      setConfigured(false);
    }
  }, [isTauri]);

  const handleSave = async () => {
    if (!isTauri) return;
    setSaving(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_settings", {
        args: {
          api_key: apiKey || null,
          model: model || null,
        },
      });
      setConfigured(!!apiKey);
      setApiKey("");
      onSettingsChanged?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!isTauri) return;
    setClearing(true);
    setError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_api_key");
      setConfigured(false);
      setApiKey("");
      onSettingsChanged?.();
    } catch (e) {
      setError(String(e));
    } finally {
      setClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="size-5" />
            Impostazioni AI
          </DialogTitle>
          <DialogDescription>
            {isTauri
              ? "Configura OpenRouter per generare commenti didattici con AI."
              : "Avvia l'app con Tauri desktop per configurare l'AI."}
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
                Le impostazioni AI sono disponibili solo nell&apos;app desktop.
                Avvia con <code className="bg-muted px-1 rounded">npm run tauri dev</code>.
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm">
                <span>Stato:</span>
                {configured ? (
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle className="size-4" />
                    API key configurata
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <XCircle className="size-4" />
                    Nessuna API key
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="api-key" className="text-sm font-medium">
                  API Key OpenRouter
                </label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-or-v1-..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ottieni una key su{" "}
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    openrouter.ai/keys
                  </a>
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="model" className="text-sm font-medium">
                  Modello
                </label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={DEFAULT_MODEL}
                />
                <p className="text-xs text-muted-foreground">
                  Formato: <code>provider/nome-modello</code>. Default: {DEFAULT_MODEL}
                </p>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="destructive"
                onClick={handleClear}
                disabled={clearing || !configured}
              >
                {clearing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                <span className="ml-1">Rimuovi key</span>
              </Button>
              <Button onClick={handleSave} disabled={saving || !apiKey.trim()}>
                {saving && <Loader2 className="size-4 animate-spin mr-1" />}
                Salva
              </Button>
            </DialogFooter>
          </>
        )}

        {!isTauri && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}