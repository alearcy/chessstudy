# Import partite giocatore da Lichess e Chess.com

## Obiettivo

Permettere di configurare gli username Lichess e Chess.com nelle impostazioni e,
dalla homepage, scegliere una partita di uno dei due giocatori da importare come
nuova lezione in modalita `analysis` tramite il flusso PGN esistente.

## Flusso utente

1. L'utente apre le impostazioni e salva gli username Lichess e Chess.com.
2. Nella homepage trova la sezione "Importa da piattaforma".
3. Il pulsante Lichess usa lo username salvato per caricare le 30 partite piu recenti.
4. Una modale mostra le partite con giocatori, colore dell'utente, risultato, data e cadenza.
5. Selezionando una partita, il suo PGN viene passato a `importPgnAsLesson`.
6. La modale si chiude e l'app apre la nuova lezione di analisi.

Per Chess.com il flusso usa due livelli:

1. carica l'elenco degli archivi mensili dello username salvato;
2. seleziona automaticamente il mese piu recente;
3. permette di cambiare mese senza scaricare l'intera cronologia;
4. carica e presenta le partite del mese selezionato;
5. importa il PGN scelto con lo stesso flusso usato da Lichess.

Se lo username Lichess non e configurato, la homepage mostra un messaggio visibile e
permette di aprire direttamente il dialog delle impostazioni.

## API Lichess

Endpoint pubblico documentato in `docs/lichess-api.json`:

```text
GET https://lichess.org/api/games/user/{username}
Accept: application/x-ndjson
```

Parametri:

- `max=30`
- `moves=true`
- `tags=true`
- `pgnInJson=true`
- `opening=true`
- `sort=dateDesc`

La risposta viene letta come NDJSON. Ogni riga deve contenere almeno un PGN valido;
righe vuote vengono ignorate e una risposta malformata produce un errore utente.
La documentazione dichiara `Access-Control-Allow-Origin: *`, quindi la richiesta viene
eseguita dal frontend senza introdurre un proxy Rust.

## API Chess.com

Elenco archivi mensili:

```text
GET https://api.chess.com/pub/player/{username}/games/archives
```

La risposta, documentata in `docs/chesscom-archive-api.json`, contiene un array
`archives` di URL ufficiali. Gli URL vengono validati come HTTPS sul dominio
`api.chess.com`, ordinati dal piu recente e mostrati come mesi selezionabili.

Partite del mese:

```text
GET {archiveUrl}
```

Il payload, documentato in `docs/chesscom-games-api.json`, contiene `games` con
PGN e metadati. La UI usa giocatori, rating, risultato, `time_class`,
`time_control`, `end_time`, link e apertura. Le varianti non standard vengono
escluse perche la scacchiera dell'app supporta gli scacchi standard.

## Modello e persistenza impostazioni

`AppSettings`, `SetSettingsArgs` e `SettingsInfo` vengono estesi con:

```text
lichess_username: string
chesscom_username: string
```

Gli username vengono normalizzati rimuovendo spazi iniziali/finali. I campi mancanti
nei vecchi `settings.json` assumono stringa vuota, preservando la compatibilita.

Il dialog impostazioni presenta una sezione "Account di gioco" separata da Stockfish.
Il salvataggio resta atomico attraverso il comando Tauri `set_settings`.

## Servizio frontend

Nuovo `src/services/lichessService.ts`:

- recupera lo username dalle impostazioni tramite un piccolo helper condiviso;
- costruisce l'URL con `encodeURIComponent`/`URLSearchParams`;
- esegue la richiesta con header NDJSON;
- distingue username inesistente, rate limit e errore di rete;
- converte ogni riga in un modello UI con `id`, `pgn`, giocatori, risultato, data,
  cadenza, colore dell'utente e link Lichess;
- limita la superficie pubblica a funzioni pure testabili e alla funzione di fetch.

Non vengono richiesti token OAuth: il task usa esclusivamente dati pubblici.

Nuovo `src/services/chessComService.ts`:

- recupera e valida gli archivi mensili;
- carica su richiesta un solo mese;
- converte le partite standard nello stesso modello visuale dell'import Lichess;
- distingue giocatore inesistente, rate limit, payload non valido ed errore di rete;
- conserva il PGN originale per `importPgnAsLesson`.

## UI homepage

La sezione "Importa da piattaforma" viene aggiunta sotto le azioni principali:

- pulsante Lichess attivo con stato di caricamento;
- pulsante Chess.com attivo con lo username configurato;
- errori inline con possibilita di riprovare;
- modale con lista scorrevole delle partite e stato vuoto;
- ogni riga espone un pulsante esplicito "Importa" per evitare selezioni accidentali.

`App` passa a `LessonsPage` una callback per aprire il dialog impostazioni quando lo
username Lichess e assente. Non vengono introdotti eventi globali o nuovo context.

## TDD e casi coperti

Prima dell'implementazione vengono aggiunti test per:

- parsing NDJSON valido, righe vuote e risposta malformata;
- mapping dei metadati e del colore del giocatore;
- costruzione della richiesta Lichess e gestione degli status HTTP principali;
- normalizzazione e compatibilita dei nuovi campi settings lato Rust;
- integrazione del PGN selezionato con il flusso di import esistente, dove testabile
  senza duplicare test UI fragili.
- parsing e ordinamento degli archivi Chess.com;
- mapping delle partite mensili, filtro varianti e gestione errori HTTP;
- caricamento automatico del mese piu recente, cambio mese e import Chess.com.

## File previsti

| File | Azione |
| --- | --- |
| `src/services/lichessService.ts` | Nuovo servizio API e mapping |
| `src/services/lichessService.test.ts` | Test RED/GREEN del servizio |
| `src/components/board/ImportLichessDialog.tsx` | Modale selezione partita |
| `src/services/chessComService.ts` | Servizio archivi e partite mensili |
| `src/services/chessComService.test.ts` | Test RED/GREEN del servizio |
| `src/components/board/ImportChessComDialog.tsx` | Modale mese e selezione partita |
| `src/pages/LessonsPage.tsx` | Sezione piattaforme e orchestrazione import |
| `src/App.tsx` | Callback apertura impostazioni |
| `src/components/SettingsDialog.tsx` | Campi username |
| `src-tauri/src/settings.rs` | Persistenza e normalizzazione |
| `src-tauri/src/commands.rs` | Payload comandi settings |
| `TASKS.md` | Tracciamento stato e link alla spec |

## Fuori scope

- OAuth o import di partite private.
- Paginazione/infinite scroll oltre le 30 partite piu recenti.
- Filtri per periodo, variante, colore o cadenza.
- Import multiplo in una singola operazione.

## Definition of done

- Gli username sono salvati e ricaricati nelle impostazioni desktop.
- Lichess carica le 30 partite recenti dello username configurato.
- Chess.com carica gli archivi, apre il mese recente e permette di cambiare mese.
- La modale presenta metadati leggibili e gestisce loading, vuoto ed errori.
- La partita scelta viene importata come lezione `analysis` e aperta dalla homepage.
- Entrambe le piattaforme importano la partita selezionata tramite il PGN esistente.
- Test frontend, `npm run build`, `cargo check` e `git diff --check` passano.
- Nessuna modifica locale estranea viene sovrascritta.
