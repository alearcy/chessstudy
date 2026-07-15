import { useEffect, useState } from "react";
import { BookOpen, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  OpeningDestinationConflict,
  addOpeningToStudy,
  createOpeningStudy,
  getOpeningStudyDestinations,
  type OpeningConflictStrategy,
  type OpeningStudyDestination,
} from "@/services/openingStudyService";
import type { OpeningReference } from "@/types";

interface OpeningStudyDialogProps {
  opening: OpeningReference | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (lessonId: number, boardId: number) => void;
}

type DestinationMode = "new" | "existing";

export default function OpeningStudyDialog({
  opening,
  open,
  onOpenChange,
  onCreated,
}: OpeningStudyDialogProps) {
  const [mode, setMode] = useState<DestinationMode>("new");
  const [studyTitle, setStudyTitle] = useState("");
  const [boardTitle, setBoardTitle] = useState("");
  const [destinations, setDestinations] = useState<OpeningStudyDestination[]>([]);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<OpeningDestinationConflict | null>(null);

  useEffect(() => {
    if (!open || !opening) return;
    setMode("new");
    setStudyTitle(opening.name);
    setBoardTitle(opening.name);
    setDestinationId(null);
    setError(null);
    setConflict(null);
    setLoadingDestinations(true);

    void getOpeningStudyDestinations(opening)
      .then((items) => {
        setDestinations(items);
        setDestinationId(items[0]?.lessonId ?? null);
      })
      .catch(() => {
        setDestinations([]);
        setError("Impossibile caricare gli studi disponibili.");
      })
      .finally(() => setLoadingDestinations(false));
  }, [open, opening]);

  const save = async (
    strategy: OpeningConflictStrategy,
    nameOverride?: string,
  ) => {
    if (!opening) return;
    setSaving(true);
    setError(null);
    try {
      const result = mode === "new"
        ? await createOpeningStudy(opening, {
            title: nameOverride ?? studyTitle,
            conflict: strategy,
          })
        : destinationId == null
          ? null
          : await addOpeningToStudy(opening, {
              lessonId: destinationId,
              boardTitle: nameOverride ?? boardTitle,
              conflict: strategy,
            });

      if (!result) {
        setError("Seleziona uno studio di destinazione.");
        return;
      }

      setConflict(null);
      onOpenChange(false);
      onCreated(result.lessonId, result.boardId);
    } catch (caught) {
      if (caught instanceof OpeningDestinationConflict) {
        setConflict(caught);
      } else {
        setError(caught instanceof Error ? caught.message : "Creazione dello studio fallita.");
      }
    } finally {
      setSaving(false);
    }
  };

  const useSuggestedName = () => {
    if (!conflict) return;
    if (mode === "new") setStudyTitle(conflict.suggestedName);
    else setBoardTitle(conflict.suggestedName);
    setConflict(null);
    void save("error", conflict.suggestedName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-5" />
            Crea materiale di studio
          </DialogTitle>
          <DialogDescription>
            {opening?.name}. La scacchiera conterrà l'intera sequenza di mosse dell'apertura.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input
              type="radio"
              name="opening-destination"
              aria-label="Crea un nuovo studio"
              checked={mode === "new"}
              onChange={() => {
                setMode("new");
                setConflict(null);
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Crea un nuovo studio</span>
              <span className="block text-xs text-muted-foreground">
                Una nuova lezione Studio con una scacchiera dedicata.
              </span>
            </span>
          </label>

          {mode === "new" ? (
            <div className="space-y-1.5 pl-7">
              <label htmlFor="opening-study-title" className="text-xs font-medium">
                Nome dello studio
              </label>
              <Input
                id="opening-study-title"
                value={studyTitle}
                onChange={(event) => setStudyTitle(event.target.value)}
              />
            </div>
          ) : null}

          <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
            <input
              type="radio"
              name="opening-destination"
              aria-label="Aggiungi a uno studio esistente"
              checked={mode === "existing"}
              disabled={destinations.length === 0}
              onChange={() => {
                setMode("existing");
                setConflict(null);
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">Aggiungi a uno studio esistente</span>
              <span className="block text-xs text-muted-foreground">
                Lo studio non verrà rinominato; la variante diventa una nuova scacchiera.
              </span>
            </span>
          </label>

          {loadingDestinations ? (
            <div className="flex items-center gap-2 pl-7 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Caricamento studi...
            </div>
          ) : mode === "existing" ? (
            <div className="max-h-40 space-y-2 overflow-y-auto pl-7">
              {destinations.map((destination) => (
                <label
                  key={destination.lessonId}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="existing-study"
                    aria-label={`${destination.title}${destination.related ? " Stessa famiglia" : ""}`}
                    checked={destinationId === destination.lessonId}
                    onChange={() => setDestinationId(destination.lessonId)}
                  />
                  <span>{destination.title}</span>
                  {destination.related ? (
                    <span className="ml-auto text-[10px] font-medium uppercase text-primary">
                      Stessa famiglia
                    </span>
                  ) : null}
                </label>
              ))}
              <div className="space-y-1.5 pt-1">
                <label htmlFor="opening-board-title" className="text-xs font-medium">
                  Nome della nuova scacchiera
                </label>
                <Input
                  id="opening-board-title"
                  value={boardTitle}
                  onChange={(event) => setBoardTitle(event.target.value)}
                />
              </div>
            </div>
          ) : null}

          {conflict ? (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="text-sm">{conflict.message}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void save("overwrite")}
                >
                  Sovrascrivi {conflict.kind === "lesson" ? "studio" : "scacchiera"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={useSuggestedName}
                >
                  Usa {conflict.suggestedName}
                </Button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            type="button"
            disabled={
              saving ||
              !opening ||
              (mode === "new" ? !studyTitle.trim() : destinationId == null || !boardTitle.trim())
            }
            onClick={() => void save("error")}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "new" ? "Crea studio" : "Aggiungi allo studio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
