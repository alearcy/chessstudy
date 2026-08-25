# ADR-0007: Migrazione a web full-client con Supabase e Stockfish.js

- **Data:** 2026-07-18
- **Stato:** Accepted
- **Supersedes:** ADR-0001, ADR-0002, ADR-0004, ADR-0006
- **Partially supersedes:** ADR-0005 per le sole parti relative al runtime
  Stockfish nativo e al fallback WASM

## Context

Chessstudy e attualmente distribuita come applicazione desktop Tauri. Il
frontend React/Vite usa Dexie/IndexedDB per la persistenza locale e delega
l'analisi principale a Stockfish 18 nativo tramite comandi Rust/Tauri,
mantenendo Stockfish WASM single-threaded come fallback nel browser.

Questa architettura presenta vincoli non piu coerenti con la direzione del
prodotto:

- richiede packaging, binari e build distinti per sistema operativo;
- lega backup e persistenza al profilo locale del dispositivo;
- i profili Dexie separano logicamente i dati ma non costituiscono un confine
  di autenticazione o sicurezza;
- non consente accesso personale agli stessi dati da piu dispositivi;
- mantiene un backend Rust il cui scopo principale scompare portando
  persistenza e analisi nel browser.

Il nuovo requisito e distribuire Chessstudy come applicazione web statica
React/Vite, accessibile soltanto a utenti invitati dall'amministratore. Ogni
utente deve poter leggere e modificare esclusivamente i propri dati. La
persistenza deve essere remota tramite Supabase e Stockfish deve continuare a
girare sul dispositivo dell'utente, senza introdurre un server applicativo per
l'analisi.

La soluzione deve inoltre:

- essere compatibile con i piani gratuiti di Supabase e di un hosting statico;
- non esporre nel frontend credenziali amministrative o la service-role key;
- preservare, per quanto possibile, contratti TypeScript e logiche applicative
  esistenti;
- mantenere la strategia di analisi adattiva, la coda sequenziale, i default
  conservativi e la classificazione delle mosse;
- offrire un percorso controllato per importare i backup JSON prodotti dalla
  versione Dexie;
- supportare il multi-threading WASM quando il browser e cross-origin isolated,
  senza rendere inutilizzabile l'app nei contesti che non lo supportano.

## Considered options

1. **React/Vite statico, Supabase per autenticazione e persistenza,
   Stockfish.js nel browser.** Elimina il runtime desktop e centralizza i dati,
   accettando dipendenza dalla rete per autenticazione e CRUD e requisiti HTTP
   specifici per il WASM multi-threaded.
2. **Mantenere Tauri, Dexie e Stockfish nativo aggiungendo sincronizzazione
   Supabase.** Conserva prestazioni native e uso offline, ma introduce due fonti
   di verita, gestione dei conflitti e una build desktop ancora
   multipiattaforma.
3. **Usare Supabase soltanto per l'autenticazione e mantenere IndexedDB come
   persistenza primaria.** Riduce la migrazione iniziale, ma non soddisfa
   l'accesso affidabile agli stessi dati da piu dispositivi e lascia irrisolti
   sincronizzazione, backup e isolamento remoto.
4. **Creare un backend applicativo dedicato con database PostgreSQL e analisi
   server-side.** Offre controllo completo, ma aumenta costi operativi,
   superficie di sicurezza e complessita senza un vantaggio necessario per
   l'attuale scala dell'app.

## Decision

Adottare l'opzione 1: Chessstudy diventa una SPA React/Vite full-client,
pubblicabile su hosting statico, con Supabase come servizio gestito per
autenticazione e persistenza e Stockfish.js eseguito localmente nel browser.

### Applicazione e hosting

Il frontend React/Vite resta il runtime applicativo. Tauri, il backend Rust, i
binari Stockfish nativi e le dipendenze native vengono rimossi dopo il
raggiungimento della parita funzionale.

La distribuzione iniziale privilegia Cloudflare Pages, ma il build resta
portabile verso qualunque hosting statico capace di configurare:

- fallback delle route SPA verso `index.html`;
- `Cross-Origin-Opener-Policy: same-origin`;
- `Cross-Origin-Embedder-Policy: require-corp`.

Gli stessi header vengono configurati negli ambienti Vite di sviluppo e
preview per verificare localmente il comportamento multi-threaded.

### Autenticazione invite-only

Supabase Auth gestisce utenti e sessioni. Non viene esposta registrazione
pubblica.

Il flusso comprende:

- invito creato dall'amministratore tramite Supabase Dashboard o ambiente
  amministrativo esterno all'app;
- accettazione dell'invito e impostazione della password;
- login;
- recupero password per utenti esistenti;
- modifica password;
- logout.

Il frontend usa esclusivamente la chiave pubblicabile/anon prevista da
Supabase. La service-role key e le API amministrative non vengono incluse nel
bundle ne invocate dal browser.

### Persistenza e isolamento

Supabase PostgreSQL diventa l'unica fonte di verita a runtime. Dexie e
IndexedDB non vengono mantenuti come cache o database parallelo, evitando
sincronizzazione bidirezionale e conflitti.

Il modello remoto comprende almeno:

- impostazioni utente;
- lezioni;
- scacchiere;
- mosse.

Gli identificatori numerici esistenti vengono conservati dove possibile per
ridurre l'impatto sui contratti frontend. Ogni record posseduto include
`user_id`; foreign key e vincoli impediscono relazioni tra record appartenenti
a utenti diversi.

Row Level Security e abilitata su tutte le tabelle applicative. Le policy
consentono `select`, `insert`, `update` e `delete` soltanto quando
`auth.uid() = user_id`. L'isolamento viene verificato con almeno due utenti
distinti e non viene affidato ai soli filtri del frontend.

Il repository applicativo resta il confine di accesso ai dati. Le
implementazioni Dexie vengono sostituite da repository Supabase, evitando di
distribuire query dirette nei componenti UI.

Le operazioni che devono restare atomiche su piu tabelle, inclusi il ripristino
di un backup e la conversione da analisi a studio, vengono implementate come
funzioni PostgreSQL/RPC con controlli espliciti sull'utente autenticato.

### Migrazione dei dati locali

Il formato JSON di backup esistente viene mantenuto come ponte di migrazione.
L'import:

- valida formato, versione, identificatori, date e relazioni;
- assegna tutti i record all'utente autenticato;
- ricostruisce in modo deterministico le catene `parentId` storicamente
  problematiche;
- applica la sostituzione o l'import concordato in modo atomico;
- mostra conferma, avanzamento, successo ed errore sulla superficie
  dell'azione.

Dexie viene rimosso soltanto dopo che questo percorso e stato verificato con un
backup reale o con una conferma esplicita di accettare una prova automatizzata.

### Stockfish nel browser

Il motore principale e il flavor Stockfish 18 lite multi-threaded di
`stockfish.js`, eseguito in un Web Worker. Offre un compromesso adeguato tra
forza, dimensione del download e velocita, evitando il peso del flavor large.

Il motore usa:

- profondita base predefinita 15;
- 2 thread come profilo conservativo consigliato;
- `MultiPV 1`;
- analisi adattiva con approfondimento delle posizioni critiche;
- la coda sequenziale gia prevista dal servizio di analisi.

Profondita, thread e `MultiPV` continuano a essere limitati a valori sicuri dal
servizio che costruisce i comandi UCI.

Il multi-threading viene attivato soltanto quando
`crossOriginIsolated === true` e `SharedArrayBuffer` e disponibile. Negli altri
contesti l'app carica automaticamente il flavor Stockfish 18 lite
single-threaded. Il fallback riduce le prestazioni ma non impedisce studio,
analisi o accesso ai dati.

Le valutazioni restano normalizzate dal punto di vista del Bianco e i contratti
`PositionEval` esistenti vengono preservati.

## Consequences

### Positive

- Un solo frontend web sostituisce build e distribuzioni desktop specifiche per
  macOS e Windows.
- Gli utenti invitati possono accedere ai propri dati da dispositivi diversi.
- Supabase Auth e RLS introducono un vero confine di sicurezza per utente.
- PostgreSQL offre vincoli relazionali e transazioni atomiche per operazioni
  multi-tabella.
- Il livello repository limita l'impatto della sostituzione di Dexie.
- Stockfish continua a elaborare le posizioni sul dispositivo dell'utente,
  evitando costi di calcolo server-side e invio delle partite a un servizio di
  analisi.
- Il flavor WASM multi-threaded migliora le prestazioni rispetto al precedente
  fallback single-threaded.
- Il fallback single-threaded mantiene disponibile l'analisi quando
  l'isolamento cross-origin non e supportato.
- La soluzione puo essere ospitata inizialmente sui piani gratuiti previsti.

### Negative

- Login, caricamento e salvataggio dei dati richiedono connettivita; non viene
  fornito un database offline equivalente a Dexie.
- Supabase diventa una dipendenza operativa esterna e introduce limiti di quota,
  disponibilita e possibili costi futuri.
- La migrazione dei dati locali richiede un'importazione esplicita per ogni
  utente o dispositivo che contiene dati da conservare.
- RLS, funzioni RPC e migrazioni PostgreSQL aumentano il lavoro di schema,
  sicurezza e test.
- Le operazioni Supabase possono avere latenza maggiore delle operazioni
  IndexedDB locali e richiedono stati visibili di attesa, errore e retry.
- Il WASM multi-threaded richiede `SharedArrayBuffer` e header COOP/COEP, che
  possono interferire con risorse cross-origin non compatibili.
- Stockfish WASM lite e meno potente del precedente binario nativo con rete
  grande.
- Il primo caricamento del motore comporta il download degli asset JavaScript,
  WASM e NNUE.
- Il browser limita il controllo su CPU, memoria e durata dei worker rispetto al
  backend nativo.
- La licenza GPLv3 e gli obblighi di distribuzione degli asset Stockfish
  continuano ad applicarsi.
- Il piano gratuito di Supabase puo richiedere configurazione aggiuntiva per
  recapito email affidabile e gestione delle quote.

## Related specs / tasks

- `WEB-001` in `TASKS.md`.
- `docs/specs/migrazione-web-supabase-stockfish-wasm.md`.
- `DB-001 Database locale stabile, ricerca paginata e backup`.
- `FEAT-008 Analisi Stockfish adattiva`.
- `TAURI-001 Conversione Tauri del frontend esistente`.
- `TAURI-002 Sostituire Stockfish WASM con Stockfish 18 nativo via UCI`.
- `TAURI-003 Integrare LLM locale per commenti didattici`.
- `docs/specs/database-locale-profili-backup.md`.
- `docs/specs/stockfish-adaptive-analysis.md`.
- `docs/specs/stockfish-cross-platform-settings.md`.
- `docs/specs/stockfish-analysis-queue.md`.
- `docs/specs/TAURI-002-native-stockfish.md`.

## Superseded ADRs

- **ADR-0001 - Stockfish 18 in browser:** superseded perche il flavor
  single-threaded non e piu il motore browser primario; resta come strategia di
  fallback.
- **ADR-0002 - Conversione a Tauri con Stockfish nativo e LLM locale:**
  superseded integralmente dalla rimozione del runtime desktop e del backend
  Rust.
- **ADR-0004 - Switch da OpenRouter a GGUF embedded via Rust:** superseded
  perche il runtime Rust/Tauri viene rimosso e l'app non reintroduce un LLM.
- **ADR-0006 - Dexie/IndexedDB per database locale, profili e backup:**
  superseded integralmente da Supabase Auth, PostgreSQL e RLS.
- **ADR-0005 - Analisi Stockfish adattiva:** resta Accepted per strategia,
  soglie, default e coda; sono superseded soltanto i riferimenti al backend
  nativo e al fallback WASM come path secondario.

ADR-0003 e un predecessore storico gia sostituito concettualmente da ADR-0004;
il suo stato non viene modificato da questa decisione.

## Open questions

1. Confermare Cloudflare Pages come hosting definitivo o scegliere un altro
   provider statico con supporto equivalente per header e fallback SPA.
2. Definire il provider SMTP e i limiti accettabili per inviti e recupero
   password in produzione.
3. Misurare dimensione e durata dei backup reali per decidere se l'import RPC
   puo usare un singolo payload o richiede staging e chunk controllati.
4. Decidere se, dopo la migrazione, mantenere export/import JSON come funzione
   permanente di portabilita oppure soltanto come strumento transitorio.
