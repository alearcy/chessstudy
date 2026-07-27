# TASKS

## In Progress

- UI-013 Layout tablet landscape e invito alla rotazione
  - [x] Correggere il breakpoint per la viewport effettiva di iPad Mini
  - [x] Sfruttare lo spazio laterale aggiuntivo sui tablet landscape più ampi
  - [x] Vincolare altezza e scroll interno delle sidebar anche sui tablet
  - [x] Mostrare il guard portrait accessibile soltanto nella shell privata
  - [x] Rispettare la preferenza di riduzione dei movimenti
  - [x] Verificare test, lint e build
  - [ ] Confermare visivamente le viewport iPad Mini
  - Spec: `docs/specs/UI-013-layout-tablet-landscape.md`

## Completed

- BUG-003 Apertura Studio sull'ultima mossa
  - [x] Riprodurre il caricamento iniziale sulla prima posizione
  - [x] Posizionare le scacchiere di Studio sull'ultima mossa persistita
  - [x] Conservare l'apertura iniziale delle scacchiere di Analisi
  - [x] Verificare test, lint e build
  - Spec: `docs/specs/apertura-studio-ultima-mossa.md`

- UI-014 Evidenziazione completa dell'ultima mossa
  - [x] Riprodurre con un test la sola evidenziazione della partenza
  - [x] Evidenziare in azzurro partenza e arrivo in Studio e Analisi
  - [x] Verificare test, lint e build
  - Spec: `docs/specs/last-move-origin-highlight.md`

- FEAT-012 Duplicazione scacchiere nello Studio
  - [x] Esporre un'azione accessibile accanto a rinomina ed elimina
  - [x] Duplicare atomicamente scacchiera, annotazioni e linea di mosse
  - [x] Selezionare la copia e mostrare stato in corso o errore
  - [x] Verificare test, lint e build
  - Spec: `docs/specs/duplicazione-scacchiere-studio.md`

- UI-012 Controlli touch della scacchiera di Studio
  - [x] Ripristinare i selettori Muovi, Frecce ed Evidenzia soltanto in Studio
  - [x] Supportare disegno e selezione con puntatore touch
  - [x] Aggiungere una gomma touch per cancellare case e frecce singolarmente
  - [x] Non mostrare cursori speciali quando si seleziona uno strumento
  - [x] Impedire il cambio di riga della toolbar al cambio strumento
  - [x] Conservare gesture mouse e navigazione da tastiera esistenti
  - [x] Verificare test, lint e build
  - Spec: `docs/specs/controlli-touch-scacchiera-studio.md`

- UI-011 Chip interattive per le tattiche
  - [x] Persistire i pattern tattici separatamente dalle annotazioni
  - [x] Mostrare chip accessibili a selezione singola
  - [x] Evidenziare soltanto la tattica attiva sulla scacchiera
  - [x] Ricostruire le tattiche nelle analisi esistenti
  - [x] Affiancare ogni chip alla frase tattica senza titolo duplicato
  - [x] Verificare test, lint, build e migrazione Supabase
  - Spec: `docs/specs/chip-tattiche-scacchiera.md`

- UI-009 Stockfish automatico e analisi solo in modalita Analisi
  - [x] Rimuovere profondita e CPU dalle impostazioni utente
  - [x] Usare automaticamente depth 15 e 2 thread con fallback a 1
  - [x] Esporre avvio e annullamento Stockfish soltanto nelle analisi
  - [x] Convertire un'analisi in Studio copiando soltanto la sequenza di mosse
  - [x] Eliminare il layout shift durante il salvataggio delle mosse di Studio
  - [x] Riprovare in single-thread se il worker multi-thread cade durante l'analisi
  - [x] Eliminare la seconda passata a depth 20 sulle posizioni critiche
  - [x] Verificare la singola passata con test, lint e build
  - [x] Verificare test, lint e build
  - Spec: `docs/specs/stockfish-automatico-solo-analisi.md`

- FEAT-013 Riordino scacchiere nello Studio
  - [x] Aggiungere handle drag accessibile con supporto mouse e touch
  - [x] Mostrare l'ordine ottimistico e gestire rollback ed errore
  - [x] Persistire atomicamente l'ordine tramite RPC Supabase
  - [x] Verificare test, lint, build e migrazione Supabase
  - [x] Confermato il comportamento nell'app
  - Spec: `docs/specs/riordino-scacchiere-studio.md`

- UI-010 Cornice coordinate scacchiera ad alta visibilita
  - [x] Aggiungere la cornice compatta condivisa tra Studio e Analisi
  - [x] Mantenere allineati scacchiera, badge e coordinate
  - [x] Conservare la modalita con coordinate dentro ogni casa
  - [x] Verificare test, lint e build
  - [x] Confermata la resa visiva nell'app
  - Spec: `docs/specs/cornice-coordinate-scacchiera.md`

- UI-008 Empty state homepage senza filtri
  - [x] Nascondere filtri e separatore quando non esistono studi o analisi
  - [x] Mantenere i filtri quando una ricerca non restituisce risultati
  - [x] Uniformare lo stile chiaro dei quattro pulsanti di creazione/importazione
  - [x] Verificare test, lint e build
  - [x] Confermato il comportamento nell'app
  - Spec: `docs/specs/empty-state-senza-filtri.md`

- WEB-001 Migrazione web full-client con Supabase e Stockfish WASM
  - [x] Usare il logo PNG nella testata dell'app e nel form di login
  - [x] Configurare autenticazione con account amministrati e schema/RLS Supabase
    - [x] Implementare client Auth, route, feedback UI e migrazione SQL versionata
    - [x] Verificare test frontend, typecheck, build e controlli statici schema
    - [x] Applicare la migrazione e verificare RLS con due utenti tramite MCP
    - [x] Verificare advisor e configurazione Auth hosted
    - [x] Forzare il cambio della password temporanea al primo accesso
  - [x] Sostituire Dexie con repository Supabase e import backup
  - [x] Rendere Stockfish WASM il solo motore e portare le impostazioni
  - [x] Rimuovere Tauri/Rust e verificare il deploy statico end-to-end
    - [x] Rimuovere runtime, sorgenti, binari e dipendenze desktop
    - [x] Configurare Cloudflare Pages e verificare build/preview statici locali
    - [x] Pubblicare `https://chessstudy.pages.dev` e configurare i redirect Auth
    - [x] Confermato il completamento delle verifiche browser
  - Spec: `docs/specs/migrazione-web-supabase-stockfish-wasm.md`
  - ADR: `docs/adr/0007-web-supabase-stockfish-wasm.md`

- UI-006 Conferma conversione da analisi a studio
  - [x] Aprire un dialog senza avviare subito la conversione
  - [x] Gestire annullamento, conferma e stato in corso
  - [x] Verificare test, lint e build
  - Spec: `docs/specs/conferma-conversione-analisi-studio.md`

- UI-005 Nomi ed ELO dei giocatori nella scacchiera di analisi
  - [x] Mostrare i dati disponibili nelle rispettive posizioni
  - [x] Allineare le posizioni all'orientamento della scacchiera
  - [x] Rimuovere valutazione testuale e profondita dalla modalita Analisi
  - [x] Formattare il rating tra parentesi senza etichetta Elo
  - [x] Posizionare il giocatore superiore sotto la toolbar
  - [x] Verificare test e build
  - Spec: `docs/specs/nomi-elo-giocatori-analisi.md`

- UI-004 Rimuovere l'indicatore dal tab Aperture
  - [x] Rimuovere il pallino e la prop inutilizzata
  - [x] Verificare test e build
  - Spec: `docs/specs/analisi-aperture.md`

- FEAT-011 Miglioramenti scacchiera di studio
  - [x] Uniformare altezza dinamica della sidebar mosse tra Studio e Analisi
  - [x] Aggiungere menu contestuale per commentare o eliminare una mossa
  - [x] Sostituire i pulsanti Muovi/Frecce/Evidenzia con gesture mouse e tastiera
  - [x] Uniformare la dimensione della scacchiera tra Studio e Analisi
  - [x] Esportare la scacchiera di studio come PGN o immagine annotata
  - Spec: `docs/specs/miglioramenti-scacchiera-studio.md`

- UI-007 Grafico andamento partita
  - [x] Condividere scala di valutazione e classificazione mosse
  - [x] Disegnare grafico e marker per migliori mosse ed errori gravi
  - [x] Navigare le posizioni con cursore trascinabile e tastiera
  - [x] Integrare il grafico soltanto nella modalita Analisi
  - [x] Verificare test, lint e build
  - [x] Confermato il comportamento nell'app
  - Spec: `docs/specs/grafico-andamento-partita.md`

- UI-003 Indicatori commenti contestuali nella notazione mosse
  - [x] Nascondere le icone nella modalità Analisi
  - [x] Mostrare l'icona nello Studio solo per note utente
  - [x] Verificare test e build
  - [x] Confermato il comportamento delle icone messaggio
  - Spec: `docs/specs/indicatori-commenti-mosse.md`

- UI-002 Card compatte delle lezioni in homepage
  - [x] Rimuovere il titolo della pagina
  - [x] Allineare titolo e azioni sulla prima riga
  - [x] Mostrare data e fonte PGN sulla seconda riga
  - [x] Verificare test e build
  - Spec: `docs/specs/card-lezioni-homepage.md`

- BUG-002 Altezza stabile della sidebar analisi al cambio tab
  - [x] Riprodurre la regressione Aperture → Mosse con un test
  - [x] Vincolare l'altezza allo spazio disponibile nel viewport
  - [x] Conservare lo scroll interno delle mosse
  - [x] Verificare test e build
  - [x] Confermato il comportamento nella finestra ridimensionabile
  - Spec: `docs/specs/analisi-aperture.md`

- DB-001 Database locale stabile, ricerca paginata e backup
  - [x] Scegliere il database locale e definire la strategia evolutiva
  - [x] Introdurre repository, profilo predefinito e indici di ricerca
  - [x] Implementare ricerca, filtri e paginazione lato database
  - [x] Implementare backup e ripristino locale atomico
  - [x] Riparare i riferimenti padre storici tra scacchiere durante import e migrazione
  - [x] Integrare controlli e stati visibili nella UI
  - [x] Verificare test e build
  - [x] Confermato il ripristino con un backup reale
  - Spec: `docs/specs/database-locale-profili-backup.md`

- Layout desktop con dimensioni minime e massime compatibili
  - [x] Limitare lo stretch orizzontale della shell principale
  - [x] Impostare dimensioni minime Tauri con margine sopra il breakpoint desktop
  - [x] Ripristinare lo scroll della finestra nella scacchiera di analisi
  - [x] Separare azioni homepage dall'elenco lezioni con una toolbar su una riga
  - [x] Verificare build

- FEAT-010 Riconoscimento aperture e creazione studi
  - [x] Riconoscere aperture giocate e suggerite per entrambi i colori
  - [x] Creare uno studio con la sequenza completa dell'apertura
  - [x] Aggiungere una variante come nuova scacchiera a uno studio esistente
  - [x] Gestire conflitti di nome e sovrascrittura esplicita
  - [x] Spostare le aperture nel tab dedicato della sidebar destra
  - [x] Verificare test e build
  - Spec: `docs/specs/analisi-aperture.md`

- BUG-001 Coerenza fra badge e commenti Stockfish
  - [x] Riprodurre la contraddizione sulle mosse migliori
  - [x] Usare la stessa classificazione per badge e commento
  - [x] Verificare test e build

- Quando viene importata una partita la mossa si posiziona sull'ultima, invece voglio che parta dall'inizio.

- FEAT-009 Preferiti per le partite importate
  - Spec: `docs/specs/preferiti-partite-importate.md`

- UI-001 Coordinate scacchiera esterne di default
  - Spec: `docs/specs/coordinate-scacchiera.md`

- FEAT-005B Rendere affidabili e separati i commenti educativi tattici
  - Spec: `docs/specs/commenti-educativi-tattici.md`

- FEAT-008 Analisi Stockfish adattiva
  - Spec: `docs/specs/stockfish-adaptive-analysis.md`
  - ADR: `docs/adr/0005-analisi-stockfish-adattiva.md`

- FEAT-007 Importare le partite di un giocatore da Lichess e Chess.com
  - Spec: `docs/specs/import-lichess-player-games.md`

- Allargare la barra di valutazione e rimuovere il comando Analisi partita
  - Spec: `docs/specs/rimozione-analisi-partita-toolbar.md`

- [x] Aggiungere test minimi
  - Coperti parsing/eval, hook scacchiera e persistenza core con Vitest.

- [x] Rimuovere le etichette testuali "pari", "Bianco" e "Nero" dalle mosse nella sidebar, mantenendo la barra valutazione animata.

- [x] Elimina i simboli dei pezzi nei commenti didattici e sostituisci con i nomi dei pezzi in italiano. Inoltre se individui una forchetta, un'infilata o altre tattiche, colora di giallo le case dei pezzi coinvolti.

- Sostituire OpenRouter con un modello opensource leggero che giri in locale. Gemma potrebbe andar bene per analizzare gli scacchi?

- la libreria stockfish 18 ora viene usata in maniera grezza e solo per Mac. Visto che l'app sarà Mac/Windows, vorrei ci fosserò entrambe le versione compilate. Inoltre vorrei poter avere dei settaggi modificabili a frontend per scegliere la profondità di ragionamento di Stockfish e quanti CPU usare.

- sostituire le emoticons con delle icone, possibilmente prese direttamente dalla libreria shadcn

- Sostituire react-chessboard con [chessground](https://github.com/lichess-org/chessground)

- Scomporre LessonDetailPage

- Configurare ESLint flat config

- Error handling visibile per operazioni critiche

- Coda Stockfish e concorrenza analisi

- Migrazioni DB conservative

- Persistenza mosse affidabile

- Evidenziazione re sotto scacco e matto

- [x] Navigazione mosse con frecce tastiera
  - Spec: `docs/specs/keyboard-move-navigation.md`

- AI analysis comment refactor (→ `docs/specs/ai-comment-refactor.md`):
  - keep only panoramica and giudizio in AI summary
  - move "momento chiave" comments to related move in moves sidebar (below stockfish comment); suggested moves stay on main move
  - remove move links from AI summary and move comments (LLM no longer emits markdown links)
- Evidenziazione casa di partenza dell'ultima mossa
  Spec: `docs/specs/last-move-origin-highlight.md`

- [x] Badge notazione estesa: classificazione stile chess.com per ogni mossa
  - Spec: `docs/specs/move-badges-extended.md`
- [x] OpenRouter LLM (sostituzione llama.cpp/Gemma)
  - Spec: `docs/specs/openrouter-llm.md`
  - ADR: `docs/adr/0003-openrouter-llm.md`

- [x] Import PGN: ogni PGN diventa lezione analysis autonoma (non più contenitore cumulativo)
  - Spec: `docs/specs/pgn-import-per-lesson.md`

- [x] FEAT-006 Refactor home page + modalità Analisi vs Studio
  - Spec: `docs/specs/refactor-home-analysis.md`
- [x] FEAT-001 Scacchiera interattiva nella lezione
  - Spec: `docs/specs/FEAT-001-chessboard-lesson.md`
- [x] FEAT-002 Layout scacchiera sinistra + pannello notazione mosse destra
  - Spec: `docs/specs/move-notation-panel.md`
- [x] FEAT-003 Layout lezione 3 colonne (scacchiere | scacchiera+note | mosse)
  - Spec: `docs/specs/lesson-3col-layout.md`
- [x] FEAT-004 Import PGN in una lezione + analisi mosse con Stockfish 18
  - Subtask A: Import PGN → board popolata
  - Subtask B: Analisi mosse con Stockfish 18 (NNUE)
  - Spec: `docs/specs/FEAT-004-pgn-import-stockfish.md`
- [x] FEAT-005 Servizio spiegazione mosse in linguaggio naturale (locale, no LLM)
  - Subtask A: `explainService.ts` — detection pattern tattici (fork, pin, skewer, hanging, mate threat)
  - Subtask B: Template generator italiano — spiega blunder, missed tactics, eval
  - Subtask C: Integrazione UI — mostra spiegazione salvata come commento mossa
  - Spec: `docs/specs/FEAT-005-explain-service.md`
- [x] TAURI-001 Conversione Tauri del frontend esistente
  - Installed Rust 1.96 + Tauri CLI 2.11.3 + `@tauri-apps/api` 2.x
  - Created `src-tauri/` with Rust backend scaffold
  - Replaced `BrowserRouter` → `HashRouter` per compatibilità Tauri production
  - Build frontend (Vite) + backend (Cargo) entrambi passano
  - ADR: `docs/adr/0002-tauri-native-sf-llm.md`
- [x] TAURI-002 Sostituire Stockfish WASM con Stockfish 18 nativo via UCI
  - Spec: `docs/specs/TAURI-002-native-stockfish.md`
- [x] TAURI-003 Integrare LLM locale per commenti didattici
  - Spec: `docs/specs/TAURI-003-local-llm.md`
- [x] color the previous home in the chessboard, then remove the color after the next move. It aim to visualize the move and the home from the rhe pawn/piece come from. For example, if I move from e4 to e5, color e4. Then if I move from e5 to e6 uncolor e4 and color e5 and so on. (→ `docs/specs/last-move-origin-highlight.md`)
- [x] Tema dark app-wide (→ `docs/specs/dark-theme.md`)
- [x] Togliere dai commenti riferimenti a centipawn o ripetizioni tipo "per stockfish la mossa migliore era". Lasciamo solo la classificazione come buona mossa o cattiva mossa, quale sarebbe stata la mossa migliore senza dire "secondo stockfish" e lasciamo l'individuazione dei pattern tattici. Per quanto riguarda i punteggi come +1.5. -1 ecc...creiamo una barra verticale animata che mostra come è messo il bianco e il nero, come fanno gli altri siti di scacchi come chess.com o lichess.org.
- [x] Eliminare qualsiasi traccia di LLM e AI, non ne ho più bisogno. Cancella anche modello locale.

- Mi piacerebbe che quando viene trovato un matto (ad esempio il commento "matto in 5" o "matto in 1"), cliccando sulla frase "matto in 5" o "matto in 1" la scacchiera cambia mostrandomi la sequenza di mosse per quel matto. E posso ovviamente navigare tra quelle mosse. Solo quelle mosse, non quelle di tutta la partita, ma solo quelle relative al matto trovato. Un pulsante poi mi permette di tornare alla sequenza di mosse di tutta la partita. Il colore della scacchiera potrebbe essere più opaco quando si visualizza una sequenza di mosse di un matto specifico rispetto alla sequenza di mosse di tutta la partita. Fammi una proposta di come lo faresti.

## Todo
