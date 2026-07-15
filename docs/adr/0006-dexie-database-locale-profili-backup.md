# ADR-0006 — Dexie/IndexedDB per database locale, profili e backup

- **Stato:** Accepted
- **Data:** 2026-07-15

## Context

Chess Study salva lezioni, scacchiere e mosse in IndexedDB tramite Dexie. Il
database deve supportare archivi più grandi senza caricare tutti i contenuti
in memoria, ricerca e paginazione efficienti, migrazioni conservative e un
backup locale ripristinabile dopo la reinstallazione.

L'evoluzione prevista comprende profili locali senza password: più persone
possono usare la stessa installazione mantenendo separati studi e analisi con
un semplice cambio di profilo. I profili sono contenitori organizzativi e non
costituiscono un confine di autenticazione o sicurezza.

La scelta deve preservare i dati esistenti, limitare il rischio di migrazione
e non vincolare l'interfaccia utente alle API specifiche di Dexie.

## Considered options

### 1. Mantenere Dexie/IndexedDB

Conserva lo stack già integrato e adatto ai volumi previsti, ma richiede
repository applicativi, indici mirati e servizi espliciti per backup,
validazione e ripristino.

### 2. Migrare a SQLite locale

Offre vincoli relazionali e query SQL più sofisticate, ma introduce una
migrazione sostanziale, maggiore integrazione nativa con Tauri e un rischio
non giustificato dai requisiti correnti.

### 3. Introdurre un backend con database server

Abilita autenticazione, accesso concorrente e sincronizzazione tra
dispositivi, ma aggiunge infrastruttura incompatibile con il requisito di
profili esclusivamente locali e senza cloud.

## Decision

Si mantiene Dexie/IndexedDB come database locale.

I nuovi accessi ai dati passano attraverso un livello repository, evitando
query Dexie sparse nei componenti UI. Lo schema include profili locali,
identificatori stabili, `profileId`, `updatedAt`, termini di ricerca derivati e
indici composti adatti a filtro, ordinamento e paginazione.

I dati esistenti vengono assegnati tramite migrazione lossless a un profilo
predefinito. La catena delle versioni Dexie esistenti resta invariata e ogni
nuova migrazione è additiva e conservativa.

Il backup è un JSON versionato e portabile. Prima del ripristino vengono
validati schema, identificatori, relazioni, date e valori enumerati; la
sostituzione avviene in un'unica transazione.

La decisione privilegia continuità e minore rischio immediato. L'astrazione
repository mantiene circoscritta un'eventuale migrazione futura.

## Positive consequences

- Nessuna migrazione immediata a un nuovo motore.
- Supporto adeguato a profili locali senza autenticazione.
- Ricerca, filtri e paginazione tramite query dedicate.
- Backup completo, versionato, validato e ripristinabile atomicamente.
- Separazione tra UI e tecnologia di persistenza.
- Possibilità di migrare in futuro limitando l'impatto sui consumatori.

## Negative consequences

- IndexedDB resta dipendente dal WebView e dal relativo profilo dati.
- I profili separano logicamente i contenuti, ma non sono un confine di
  sicurezza.
- Backup, validazione, ripristino e migrazioni sono mantenuti
  dall'applicazione.
- Query relazionali complesse e ricerca full-text avanzata sono meno naturali
  rispetto a SQLite.
- L'astrazione repository aggiunge codice e disciplina architetturale.
- Una futura migrazione richiederà comunque conversione e verifica dei dati.
- La cifratura a riposo non è inclusa.

## Related specs / tasks

- `DB-001 Database locale stabile, ricerca paginata e backup` in `TASKS.md`.
- `docs/specs/database-locale-profili-backup.md`.
- `docs/specs/migrazioni-db-conservative.md`.

## Open questions

- Quando introdurre la UI per creare, rinominare e cambiare profilo?
- Quali soglie misurabili giustificherebbero una rivalutazione di SQLite?
- Quando rendere disponibile anche un backup parziale per singolo profilo?
