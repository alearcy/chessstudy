# Dark theme app-wide

## Obiettivo
Rendere l'app permanentemente in tema dark.

## Contesto
- `src/index.css` definisce già `:root` (light) e `.dark` (dark) con tutti i
  token semantici (`--background`, `--foreground`, `--card`, `--muted`, ecc.).
- `@custom-variant dark (&:is(.dark *))` abilita i variant `dark:` di Tailwind.
- Nessun colore hardcoded nei componenti: usano solo token
  (`bg-background`, `text-foreground`, `bg-muted`, `bg-primary/5`, ...).
- Nessun theme provider / toggle esisteva → la classe `dark` non veniva mai
  applicata e l'app restava sempre light.

## Approccio
Applicare `class="dark"` staticamente su `<html>` in `index.html`.

- Attiva il blocco `.dark { ... }` già presente in `src/index.css`.
- Cascade globale via `body { @apply bg-background text-foreground }`.
- Mantiene `:root`/`.dark` intatti → un eventuale toggle futuro richiede
  solo di gestire dinamicamente la classe su `<html>` invece di hardcodarla.

### Alternative scartate
- Spostare i valori dark dentro `:root` ed eliminare `.dark`: perde la
  possibilità di toggle futuro, più invasivo.
- ThemeProvider (next-themes o custom): overkill per un requisito "sempre
  dark", aggiunge dipendenze.

## Cambiamenti
- `index.html`: `<html lang="it">` → `<html lang="it" class="dark">`.

## Definition of done
- `npm run build` verde (tsc + vite).
- App visibilmente dark (sfondo scuro, testo chiaro, scacchiera e pannelli
  coerenti).
- Nessun componente con colori light residui hardcoded.
