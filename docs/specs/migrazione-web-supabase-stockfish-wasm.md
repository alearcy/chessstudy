# Migrazione web full-client con Supabase e Stockfish WASM

## Business goal

Rendere Chessstudy accessibile come applicazione web multiutente gratuita, con
dati personali sincronizzati e analisi Stockfish nel browser, senza dipendenze
dal runtime desktop Tauri.

## Contesto

L'applicazione React/Vite usa attualmente Dexie/IndexedDB per lezioni,
scacchiere e mosse, mentre impostazioni e Stockfish principali dipendono dal
backend Rust/Tauri. Il task sostituisce questi confini con Supabase Auth e
Postgres, mantiene nel frontend le logiche scacchistiche esistenti e riporta
Stockfish 18 nel browser tramite `stockfish.js`.

Il piano approvato prevede un'applicazione solo client, pubblicabile su hosting
statico gratuito. Supabase e il browser sono gli unici runtime necessari in
produzione.

## In scope

- autenticazione Supabase con email e password, senza registrazione pubblica;
- accesso consentito soltanto ad account creati manualmente dall'amministratore
  Supabase;
- password temporanea comunicata manualmente, cambio obbligatorio al primo
  accesso, modifica e recupero password;
- sessione persistente, protezione delle route e logout;
- persistenza remota di impostazioni, lezioni, scacchiere e mosse;
- isolamento dei dati per utente tramite `user_id`, vincoli e Row Level
  Security su ogni tabella esposta;
- repository frontend Supabase che sostituiscono Dexie senza propagare query
  di database nei componenti;
- import del backup JSON v1 esistente come ponte dai dati locali a Supabase;
- operazioni multi-tabella critiche atomiche, incluse conversione
  analisi-studio e import del backup;
- Stockfish 18 lite multi-threaded WASM come motore principale e lite
  single-threaded come fallback;
- mantenimento dell'analisi adattiva, della coda sequenziale, dei commenti
  deterministici e dei contratti `PositionEval` esistenti;
- rimozione del runtime Tauri, del backend Rust, dei binari nativi e delle
  relative dipendenze frontend;
- uso del logo `public/chessstudy.png` nei punti in cui il nome
  "Chessstudy" identifica il marchio, inclusi testata e login;
- configurazione Vite e hosting statico per isolamento cross-origin e fallback
  delle route SPA.

## Out of scope

- registrazione autonoma o amministrazione degli account dalla UI;
- ruoli applicativi, organizzazioni, condivisione di lezioni o collaborazione;
- pannello amministrativo personalizzato: creazione e revoca degli account
  restano in Supabase Dashboard o in strumenti amministrativi separati;
- uso di `service_role`, secret key o credenziali amministrative nel client;
- sincronizzazione offline, cache persistente o mantenimento di Dexie dopo
  l'importazione;
- modifica delle regole scacchistiche, del layout principale o dei testi
  didattici non necessaria alla migrazione;
- Edge Functions, Realtime, Storage o backend applicativo dedicato;
- distribuzione desktop Tauri e build native macOS/Windows/Linux;
- motori Stockfish large con NNUE di grandi dimensioni.

## Functional requirements

1. L'app mostra soltanto le route di autenticazione quando non esiste una
   sessione valida e ripristina la route richiesta dopo l'accesso.
2. L'app non espone un'azione di registrazione e il progetto Supabase non
   consente signup pubblici; un nuovo account viene creato manualmente
   dall'amministratore con email e password temporanea, senza invio email
   automatico obbligatorio.
3. Al primo accesso con la password temporanea l'app mostra automaticamente un
   form obbligatorio per scegliere una nuova password e impedisce la
   navigazione verso le altre route private finché il cambio non è completato.
4. Un utente abilitato può accedere con email e password, uscire, richiedere il
   recupero password e completare il cambio dalla route indicata nell'email.
5. Un utente autenticato può cambiare la password dalle impostazioni; nel
   flusso ordinario deve fornire anche la password corrente.
6. Loading, successo ed errore delle operazioni Auth sono visibili sulla
   superficie che le ha avviate, senza lasciare la UI in uno stato ambiguo.
7. Ogni query di impostazioni, lezioni, scacchiere e mosse opera soltanto sui
   record appartenenti all'utente autenticato, anche se il client manipola gli
   identificatori o invia un `user_id` diverso.
8. La pagina lezioni mantiene ricerca, filtri, preferiti, ordinamento e
   paginazione tramite il repository remoto, senza scaricare l'intero archivio.
9. Creazione, aggiornamento e cancellazione di lezioni, scacchiere e mosse
   mantengono i comportamenti e gli identificatori numerici attesi dalla UI.
10. Le cancellazioni rispettano la gerarchia utente -> lezione -> scacchiera ->
    mossa e non lasciano record orfani.
11. La conversione da analisi a studio e le altre scritture che coinvolgono più
    tabelle sono eseguite in una singola transazione PostgreSQL.
12. L'utente può selezionare un backup JSON nel formato
    `chessstudy-backup` versione 1, vederne il riepilogo e confermare
    esplicitamente l'importazione nel proprio account.
13. L'import valida l'intero backup prima di scrivere, preserva lezioni,
    scacchiere, mosse, UID portabili, date e relazioni, assegna tutti i contenuti
    all'utente corrente e ignora gli ID numerici locali durante l'inserimento.
14. Un import non valido o fallito non modifica alcun dato remoto; il risultato
    mostra conteggi, errore e possibilità di riprovare.
15. L'import non sostituisce implicitamente i dati remoti: un eventuale
    conflitto su UID viene segnalato prima della conferma e non produce
    duplicati parziali.
16. Gli username Lichess/Chess.com sono salvati per utente in Supabase e
    ricaricati su ogni dispositivo; Stockfish usa un profilo automatico.
17. L'analisi usa `stockfish-18-lite` multi-threaded in un Web Worker quando
    `crossOriginIsolated` e `SharedArrayBuffer` sono disponibili.
18. Se l'isolamento cross-origin non è disponibile, l'analisi passa
    automaticamente a `stockfish-18-lite-single` e mostra che è attiva la
    modalità compatibilità a un thread.
19. Il profilo automatico resta profondità 15, 2 thread e `MultiPV 1`; il
    fallback single-thread forza un thread e nessun valore e configurabile
    dall'utente.
20. L'analisi adattiva continua a eseguire la passata base e il raffinamento
    delle posizioni critiche a profondità base + 5, massimo 30, mantenendo
    cancellazione, progresso e normalizzazione dal punto di vista del Bianco.
21. Esportazione e importazione file usano le API browser e non richiedono
    plugin filesystem o dialog Tauri.
22. L'app funziona con `npm run dev`, `npm run build` e `npm run preview` senza
    toolchain Rust; in produzione, un refresh su una route valida della SPA non
    restituisce 404.
23. La testata privata e il form di login mostrano il logo PNG con testo
    alternativo "Chessstudy"; i titoli descrittivi delle altre pagine restano
    testo.

## Data and contract impact

### Supabase Auth

- provider email/password abilitato;
- signup pubblico disabilitato;
- Site URL e redirect locali/di produzione configurati per conferma e recupero;
- creazione manuale degli account con password temporanea e nessuna dipendenza
  da SMTP o inviti email automatici;
- nessuna chiave privilegiata nel bundle: il client usa soltanto URL progetto e
  publishable key, oppure la legacy anon key se il progetto non dispone ancora
  della publishable key.

### PostgreSQL

Le migrazioni imperative creano le seguenti tabelle nel schema esposto
`public`:

- `user_settings`: `user_id uuid` primary key e foreign key verso
  `auth.users`, username Lichess/Chess.com, colonne Stockfish legacy con default
  automatici, `created_at`, `updated_at`;
- `user_security_state`: `user_id uuid` primary key e foreign key verso
  `auth.users`, flag `must_change_password` e date; gli account esistenti sono
  inizializzati a `false`, i nuovi account a `true`;
- `lessons`: `id bigint generated by default as identity`, `user_id uuid`,
  `uid uuid`, titolo, descrizione, modalità, preferito, termini di ricerca e
  date;
- `boards`: ID numerico, `user_id`, `uid`, `lesson_id`, FEN, note, annotazioni,
  ordine, valutazioni, header PGN, analisi partita, apertura e date;
- `moves`: ID numerico, `user_id`, `uid`, `board_id`, `parent_id`, SAN, FEN,
  ordine, commenti, annotazioni, valutazioni e date.

Array e oggetti applicativi come frecce, evidenziazioni, header PGN e report
apertura sono salvati come `jsonb`. I timestamp sono `timestamptz`. Gli UID sono
unici per utente; gli ID numerici restano il contratto relazionale e UI.

Le foreign key includono l'ownership del record padre, così una scacchiera o
una mossa non può riferire un record di un altro utente. Le cancellazioni di
lezioni e scacchiere applicano `ON DELETE CASCADE`; `moves.parent_id` resta
interno alla stessa scacchiera e allo stesso utente. Gli indici coprono almeno
`user_id`, ordinamento/paginazione lezioni, modalità, preferiti,
`(lesson_id, order)` e `(board_id, order)`.

RLS è abilitata su tutte le tabelle. Le policy `SELECT`, `INSERT`, `UPDATE` e
`DELETE` sono rivolte a `authenticated` e confrontano sempre `user_id` con
`(select auth.uid())`; le policy di update usano sia `USING` sia `WITH CHECK`.
Non esistono policy per `anon`.

`user_security_state` espone al client soltanto `SELECT` della propria riga.
Un trigger privato su `auth.users` crea lo stato dei nuovi account e disattiva
il flag soltanto quando cambia la password cifrata registrata da Supabase Auth;
il browser non può modificare direttamente il gate.

Le funzioni RPC multi-tabella usano il contesto dell'utente chiamante e non
aggirano RLS. Si preferisce `SECURITY INVOKER`; l'esecuzione viene revocata a
`PUBLIC` e `anon` e concessa esplicitamente ad `authenticated`.

Poiché i nuovi progetti possono non esporre automaticamente le tabelle alla
Data API, la migrazione include e verifica i grant minimi al ruolo
`authenticated`, separatamente dalle policy RLS.

### Frontend contracts

- il client Supabase browser è unico e tipizzato con i tipi database generati;
- i repository convertono `snake_case`/stringhe ISO Postgres nei modelli
  TypeScript e `Date` correnti;
- le interfacce `Lesson`, `Board`, `Move`, `EvalFields` e gli ID numerici restano
  stabili per i componenti;
- `profileId` e `LocalProfile` vengono rimossi dal contratto runtime: l'utente
  autenticato è il solo confine dei dati;
- `analysisService` mantiene la superficie pubblica esistente, sostituendo
  l'invocazione Tauri con il worker WASM;
- i servizi settings e file non importano più `@tauri-apps/api`.

### Build and deployment

- rimozione di `src-tauri/`, script e dipendenze Tauri, Cargo e binari nativi;
- rimozione di Dexie e `fake-indexeddb` quando nessun test o modulo runtime li
  usa più;
- asset Stockfish lite multi e lite single serviti da `public/stockfish/` con i
  nomi attesi dal glue Emscripten;
- header `Cross-Origin-Opener-Policy: same-origin` e
  `Cross-Origin-Embedder-Policy: require-corp` configurati in Vite dev/preview e
  nell'hosting statico;
- regola di fallback SPA per tutte le route applicative;
- variabili `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` validate
  all'avvio con un errore breve e comprensibile se mancanti.

## Validation rules

- email obbligatoria e normalizzata; messaggi di recupero non devono rivelare
  se un account esiste;
- password nuova e conferma devono coincidere e rispettare la policy password
  configurata in Supabase;
- nessun payload client può scegliere o modificare l'owner effettivo;
- modalità lezione limitata a `study` o `analysis`;
- profondità Stockfish automatica 15, con raffinamento a 20;
- thread automatici: 2 nel runtime multi-thread e 1 nel fallback;
- `MultiPV` resta 1 nel flusso di analisi partita;
- FEN, ordine, date, JSON annotazioni e valori di valutazione devono essere
  validi prima di una scrittura o importazione;
- una lezione `analysis` contiene una sola scacchiera principale;
- l'ordine di scacchiere e mosse è non negativo e unico nel relativo padre;
- `parent_id` è nullo per la prima mossa e punta alla mossa precedente della
  stessa scacchiera per la storia lineare supportata;
- backup accettato soltanto con formato/versione supportati, UID unici e
  riferimenti completi; gli ID locali non vengono considerati affidabili come
  chiavi remote;
- un conflitto su UID richiede una scelta esplicita supportata dal flusso; in
  assenza di una scelta, l'import non scrive.

## Non-functional requirements

- **Security:** RLS e vincoli PostgreSQL costituiscono il confine di sicurezza;
  nessuna autorizzazione dipende da `user_metadata` e nessun secret
  amministrativo raggiunge il browser.
- **Atomicity:** conversioni e import completi sono all-or-nothing.
- **Performance:** liste paginate e filtrate lato database; nessun caricamento
  completo di mosse per la homepage; indici verificati sulle query principali.
- **Reliability:** errori di rete e sessione scaduta producono stati visibili e
  ripetibili senza duplicare scritture.
- **Compatibility:** browser desktop moderni; fallback single-thread quando
  SharedArrayBuffer non è utilizzabile.
- **Resource usage:** profilo automatico conservativo a 2 thread e coda di
  analisi sequenziale per evitare saturazione della CPU.
- **Cost:** architettura compatibile con i piani gratuiti Supabase e hosting
  statico, senza dipendenze obbligatorie a pagamento.
- **Maintainability:** UI separata dai dettagli PostgREST tramite repository e
  mapping tipizzati; migrazioni SQL versionate nel repository.
- **Licensing:** distribuzione e avvisi devono rispettare la GPLv3 di
  Stockfish/stockfish.js.

## Implementation sequence

1. Stabilire una baseline verde e aggiungere test RED per Auth, mapping e RLS.
2. Inizializzare la struttura Supabase, creare migrazioni schema/policy/grant e
   generare i tipi TypeScript.
3. Implementare Auth con account amministrati e protezione route.
4. Introdurre repository Supabase e migrare settings, lezioni, scacchiere e
   mosse una superficie per volta.
5. Implementare e verificare RPC atomiche e import del backup v1.
6. Sostituire il backend Stockfish nativo con worker lite multi e fallback
   lite single, mantenendo l'analisi adattiva.
7. Migrare i dialog file alle API browser e rimuovere Dexie/Tauri/Rust.
8. Configurare build e hosting statico, eseguire test end-to-end e verifica
   finale su ambiente pubblicato.

Ogni fase deve mantenere verdi i test già migrati e chiudersi con una revisione
del diff prima di passare alla successiva.

## Expected tests

- **Auth unit/integration:** login valido e non valido, ripristino sessione,
  logout, password temporanea e cambio iniziale obbligatorio, cambio con
  password corrente e recupero con redirect consentito.
- **Route integration:** utente anonimo reindirizzato al login; utente
  autenticato torna alla route originaria; callback invalida mostra un errore
  recuperabile.
- **RLS integration:** due utenti distinti non possono leggere, inserire,
  modificare o cancellare record reciproci su nessuna tabella, neppure usando
  ID noti; `anon` non può accedere ai dati.
- **Ownership integration:** foreign key e policy respingono board, move e
  `parent_id` collegati a owner o padre differenti.
- **Repository unit:** mapping date/JSON/campi opzionali, paginazione stabile,
  ricerca, modalità, preferiti e conteggio totale.
- **Settings integration:** salvataggio e isolamento degli username di gioco;
  le colonne Stockfish legacy non vengono lette o aggiornate dal frontend.
- **RPC integration:** conversione analisi-studio completa oppure rollback;
  funzioni non eseguibili da `anon` e incapaci di operare su dati altrui.
- **Backup unit:** parsing del formato v1, date, UID, riferimenti, catena
  `parentId`, annotazioni colorate e rifiuto di payload malformati.
- **Backup integration:** import completo con rimappatura degli ID, conflitto
  UID, conteggi corretti e rollback totale su errore intermedio.
- **Stockfish unit:** protocollo UCI, parsing `cp`/`mate`, normalizzazione POV,
  progress, cancellazione e mantenimento dell'analisi adattiva.
- **Stockfish browser:** scelta multi-thread automatica in contesto isolato e
  fallback single-thread quando l'isolamento manca.
- **UI:** stati loading/error/retry per Auth, CRUD remoto, backup e analisi;
  controlli Stockfish presenti soltanto in modalita Analisi; logo PNG presente
  e accessibile nella testata e nel login.
- **Deployment smoke:** asset JS/WASM raggiungibili con MIME corretto, header
  COOP/COEP presenti, `crossOriginIsolated` vero sul deploy supportato e refresh
  di route SPA senza 404.
- **Regression:** suite Vitest completa, `npm run build` e `git diff --check`.
- **Database verification:** test query con utenti distinti, verifica migrazioni
  applicate e advisor Supabase senza finding di sicurezza non risolti.

## Acceptance criteria

- un account non creato dall'amministratore non può registrarsi né accedere
  all'app;
- un account creato manualmente accede con la password temporanea, viene
  bloccato sul cambio password obbligatorio e soltanto dopo entra nell'app;
- un utente abilitato cambia o recupera la password ed esegue logout con
  feedback visibile;
- due account di prova vedono e modificano esclusivamente i propri dati in test
  UI e query dirette alla Data API;
- impostazioni, lezioni, scacchiere e mosse sopravvivono a logout/login e sono
  disponibili da un secondo browser autenticato con lo stesso account;
- ricerca, filtri, preferiti, paginazione, CRUD, conversione analisi-studio e
  import PGN conservano il comportamento applicativo esistente;
- un backup reale v1 viene importato nel nuovo account preservando tutti i
  contenuti scacchistici e un errore simulato dimostra il rollback;
- nessun accesso runtime usa Dexie, IndexedDB, Tauri, Rust o binari nativi;
- Stockfish lite multi analizza correttamente sul deploy isolato e lite single
  entra automaticamente in funzione quando l'isolamento viene tolto;
- il profilo Stockfish resta depth 15, 2 thread automatici,
  `MultiPV 1`, raffinamento +5 e massimo 30;
- asset, redirect Auth, header COOP/COEP e fallback SPA sono verificati
  sull'ambiente pubblicato;
- nel bundle non sono presenti service role key, secret key o credenziali
  amministrative;
- migrazioni, tipi generati e configurazione deploy sono versionati;
- testata e login usano il logo PNG senza perdere il nome accessibile
  "Chessstudy";
- test frontend e integrazione RLS passano, `npm run build` e
  `git diff --check` sono verdi;
- Tauri, Cargo, Dexie e dipendenze non più usate sono rimossi dal progetto.

## Open questions

- In caso di UID già presente durante l'import, il primo rilascio deve offrire
  soltanto annullamento oppure anche un merge/sovrascrittura esplicita?
