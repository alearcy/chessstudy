# Database locale, ricerca e backup

## Contesto

Chess Study salva oggi lezioni, scacchiere e mosse in IndexedDB tramite
Dexie. Il database deve restare affidabile anche con archivi più grandi,
supportare ricerca e paginazione senza caricare tutte le lezioni in memoria e
permettere un backup locale ripristinabile dopo la reinstallazione.

L'evoluzione futura prevista non è multiutente di rete: più persone possono
usare la stessa installazione scegliendo un profilo locale, senza password. I
profili sono contenitori di dati e non rappresentano un confine di sicurezza.

## Decisione

Si mantiene Dexie/IndexedDB. Il costo e il rischio di migrare ora a SQLite non
sono giustificati dai requisiti correnti. Gli accessi nuovi passano da servizi
di repository, così l'interfaccia non dipende dalle query Dexie e un'eventuale
migrazione futura resta circoscritta.

La catena completa delle versioni Dexie esistenti resta invariata. Ogni nuova
migrazione è additiva e lossless.

## Modello dati

La nuova versione dello schema introduce:

- `profiles`: profili locali con identificatore stabile, nome e date;
- `profileId` e identificatore stabile sulle lezioni;
- identificatori stabili anche su scacchiere e mosse per backup portabili;
- `updatedAt` sui record modificabili;
- termini di ricerca derivati dai dati della lezione e dagli header PGN;
- indici composti per profilo, ordinamento, modalità, preferiti e sequenza
  delle mosse.

La migrazione crea un profilo `Principale` e gli assegna tutti i dati
esistenti. Non elimina né ricrea lezioni, scacchiere o mosse.

Il profilo attivo è una preferenza locale dell'installazione. In questo task
si prepara il modello e si usa il profilo predefinito; il selettore visuale dei
profili può essere aggiunto separatamente senza cambiare il database.

## Query lezioni

Il repository espone una query paginata con:

- profilo;
- testo libero su titolo, descrizione, giocatori, evento, sito, ECO e data PGN;
- modalità `analysis` o `study`;
- sole partite preferite;
- data di creazione;
- pagina e dimensione pagina.

La risposta contiene elementi, totale, pagina corrente e numero totale di
pagine. L'ordinamento è dal contenuto più recente al meno recente, con ID come
criterio stabile in caso di date uguali.

La pagina Lezioni usa il repository: cambio ricerca o filtro riporta alla
prima pagina; creazione, modifica, cancellazione e preferiti ricaricano solo la
pagina necessaria.

## Backup e ripristino

Il backup è un JSON versionato che contiene metadati di formato e tutte le
tabelle applicative. Le date sono serializzate in ISO 8601 e gli identificatori
stabili sono preservati.

Prima del ripristino vengono verificati:

- formato e versione supportata;
- tipi e campi obbligatori;
- unicità degli identificatori;
- riferimenti profilo-lezione, lezione-scacchiera e scacchiera-mossa;
- date e valori enumerati.

I backup storici possono contenere `parentId` copiati tra scacchiere. Poiché
la storia supportata è lineare, il ripristino ricostruisce questi collegamenti
in modo deterministico dall'ordine delle mosse di ogni scacchiera invece di
respingere il file.

Il ripristino completo sostituisce il database applicativo in un'unica
transazione Dexie. Un file invalido non modifica alcun dato. La UI richiede una
conferma esplicita, mostra stato in corso, successo ed errore con possibilità
di riprovare. Il dialogo si apre da un pulsante solo icona nella toolbar
globale, immediatamente accanto alle impostazioni.

## Strategia TDD

1. Test del repository per migrazione, isolamento profilo, ricerca, filtri e
   confini di pagina.
2. Implementazione minima di schema e query.
3. Test di serializzazione, validazione, rollback e ripristino.
4. Implementazione minima del servizio backup.
5. Test della UI per paginazione e azioni backup/ripristino.
6. Integrazione e refactor mantenendo verdi i test.

## Fuori scope

- autenticazione o password dei profili;
- sincronizzazione cloud o tra dispositivi;
- cifratura a riposo;
- importazione parziale o merge tra backup;
- selettore UI per creare, rinominare o cambiare profilo;
- migrazione a SQLite.

## Definition of done

- nessuna migrazione distruttiva e dati esistenti assegnati al profilo
  predefinito;
- ricerca e paginazione avvengono tramite il repository;
- backup completo esportabile e ripristinabile atomicamente;
- errori e conferme visibili sulla superficie dell'azione;
- test di repository, backup e UI verdi;
- `npm run build` e `npm test` passano;
- `TASKS.md` e ADR correlato aggiornati.
