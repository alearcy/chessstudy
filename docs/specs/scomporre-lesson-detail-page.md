# Scomporre LessonDetailPage

## Obiettivo

Ridurre complessita e coupling di `src/pages/LessonDetailPage.tsx` senza cambiare comportamento utente o modello dati.

## Ambito

- Estrarre componenti presentazionali riusabili dalla pagina:
  - markdown analisi AI;
  - commento mossa con badge Stockfish;
  - sidebar scacchiere in modalita studio;
  - dialog di modifica/eliminazione/reset.
- Estrarre helper puri legati a SAN/FEN, stato re, formattazione eval e swing chiave.
- Lasciare nella pagina orchestrazione, stato, persistenza Dexie, analisi Stockfish/AI e wiring dell'hook scacchiera.

## Vincoli

- Nessun cambio a schema DB o semantica delle mosse.
- Varianti restano scacchiere separate; storia mossa resta lineare.
- Nessun nuovo framework di test in questo task.
- Verifica minima: `npm run build`; `npm run lint` se disponibile.

## Note tecniche

- I componenti estratti vivono in `src/components/lesson/`.
- Gli helper puri vivono in `src/lib/lessonDetailUtils.ts`.
- `LessonDetailPage` resta il container principale della rotta `/lesson/:id`.
