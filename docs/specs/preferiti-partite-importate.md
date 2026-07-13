# Preferiti per le partite importate

## Obiettivo

Permettere di contrassegnare come preferite alcune partite importate e filtrare
la homepage per mostrare soltanto quelle preferite.

Nel modello corrente ogni partita importata e una `Lesson` in modalita
`analysis`; le lezioni `study` non partecipano a questa funzionalita.

## Modello e persistenza

`Lesson` viene esteso con il campo:

```ts
isFavorite?: boolean;
```

Il campo resta non indicizzato: il filtro opera sulla lista gia caricata dalla
homepage e non richiede una query Dexie dedicata. Una nuova versione dello
schema documenta il campo e normalizza in modo conservativo le lezioni
esistenti a `false`, senza modificare board o mosse.

Il servizio lezioni espone un'operazione dedicata che aggiorna soltanto
`isFavorite`. La pagina ricarica la lista dopo il salvataggio, mantenendo
l'ordinamento esistente per data di creazione.

## Interfaccia

- Le card delle lezioni `analysis` mostrano un pulsante con icona cuore.
- Anche l'header della pagina di dettaglio `analysis` mostra lo stesso cuore,
  accanto alle azioni della lezione, così il preferito può essere modificato
  senza tornare alla homepage.
- Il cuore condiviso misura 16 px; e vuoto quando la partita non e preferita
  e pieno quando lo e.
- Il pulsante interrompe il click della card, quindi non apre la lezione.
- Titolo e `aria-label` distinguono le azioni "Aggiungi ai preferiti" e
  "Rimuovi dai preferiti".
- Un controllo "Solo preferite" filtra la lista mostrando esclusivamente
  lezioni `analysis` con `isFavorite === true`.
- Se il filtro non trova risultati viene mostrato uno stato vuoto specifico,
  distinto dallo stato in cui non esiste ancora alcuna lezione.
- Un errore di persistenza viene mostrato nella pagina tramite il componente
  `ErrorNotice` esistente.

## TDD e casi coperti

Prima dell'implementazione vengono aggiunti test per verificare che:

- il servizio persista aggiunta e rimozione del preferito;
- il cuore sia disponibile soltanto sulle partite importate;
- il componente cuore condiviso esponga stato e azione accessibili anche nel
  dettaglio della partita;
- il click sul cuore non navighi alla lezione e aggiorni lo stato;
- il filtro nasconda partite non preferite e lezioni `study`;
- lo stato vuoto dei preferiti sia visibile quando il filtro non ha risultati.

## File previsti

| File | Azione |
| --- | --- |
| `src/types/index.ts` | Aggiunta del campo `isFavorite` a `Lesson` |
| `src/db/database.ts` | Versione Dexie conservativa per il nuovo campo |
| `src/services/lessonService.ts` | Operazione di aggiornamento del preferito |
| `src/services/lessonService.test.ts` | Test RED/GREEN della persistenza |
| `src/pages/LessonsPage.tsx` | Pulsante cuore, filtro e stato vuoto |
| `src/pages/LessonsPage.test.tsx` | Test RED/GREEN delle interazioni UI |
| `src/components/lesson/LessonFavoriteButton.tsx` | Cuore condiviso tra lista e dettaglio |
| `src/components/lesson/LessonFavoriteButton.test.tsx` | Test del cuore condiviso |
| `src/pages/LessonDetailPage.tsx` | Cuore nell'header della partita `analysis` |
| `TASKS.md` | Tracciamento del task e link alla spec |

## Fuori scope

- Preferiti per lezioni `study` create manualmente.
- Ordinamento manuale o raccolte multiple di preferiti.
- Sincronizzazione dei preferiti tra dispositivi.

## Definition of done

- Il preferito viene salvato e resta disponibile dopo il reload.
- Solo le partite importate espongono il pulsante cuore.
- Il preferito può essere modificato sia dalla lista sia dal dettaglio
  `analysis`.
- Il filtro mostra soltanto le partite preferite.
- Errori di aggiornamento sono visibili e recuperabili.
- Test, build e `git diff --check` passano.
- Nessuna modifica locale estranea viene sovrascritta.
