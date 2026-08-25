# UI-016 — Audit UI e coerenza con il prodotto

## Obiettivo

Rifinire l'interfaccia esistente secondo `PRODUCT.md` e `DESIGN.md`, senza
sostituire il linguaggio visivo introdotto di recente e senza ampliare il
perimetro funzionale del prodotto.

## Audit

- Rendere semanticamente navigabili da tastiera le righe dell'archivio.
- Distinguere Studio e Analisi con testo e iconografia neutrali, riservando i
  colori saturi ai significati scacchistici e agli stati.
- Riportare le micro-etichette alla scala tipografica documentata.
- Localizzare i nomi accessibili condivisi e rendere contestuali le azioni
  iconiche dell'archivio.
- Limitare le transizioni alle sole proprietà che cambiano.
- Rafforzare separazione e focus della testata con i pattern del design system.

## Vincoli

- Conservare flussi, dati, gerarchia delle quattro azioni di ingresso e layout
  desktop/tablet landscape.
- Non includere il layout smartphone registrato in
  `docs/tech-debt/responsive-smartphone-layout.md`.
- Non modificare né chiudere UI-015, già in corso nel worktree.
- Nessuna nuova dipendenza o costo server.

## Verifica

- Test mirati per semantica e nomi accessibili dell'archivio.
- Detector Impeccable, suite Vitest, lint e build.
- Diff finale limitato al task.
- La conferma visiva renderizzata resta aperta se non è disponibile un browser.
