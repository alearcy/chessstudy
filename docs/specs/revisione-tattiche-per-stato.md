# FEAT-014: Revisione tattica per stato

## Obiettivo

Trasformare i pattern tattici dell'analisi in momenti didattici distinti:
`Mancata`, `Concessa` e `Trovata`. Le prime due categorie guidano la
revisione; le tattiche trovate compaiono soltanto come conferma positiva
selettiva.

## Modello

- `TacticalPattern` espone lo stato obbligatorio
  `missed | conceded | found`.
- Una tattica mancata conserva anche l'alternativa necessaria alla preview:
  SAN della mossa migliore e FEN dopo quella mossa.
- Lo stato e l'eventuale alternativa restano nel JSON `Move.tactics`; non
  serve una nuova colonna Supabase.
- I JSON storici privi di stato non vengono etichettati in modo arbitrario:
  sono ricostruiti dai FEN e dalle valutazioni Stockfish già persistite.
- La chiave stabile del pattern include stato, tipo e case, così pattern
  geometricamente uguali ma didatticamente diversi non collidono.

## Classificazione deterministica

Per ogni mossa si confrontano la posizione precedente, quella realmente
raggiunta e, quando diversa, quella ottenuta applicando `bestMoveUci`.

1. `Mancata`: la mossa migliore crea un pattern nuovo per chi muove, mentre la
   mossa giocata non lo crea. Conserva la posizione alternativa.
2. `Concessa`: una mossa imprecisa, errata o gravemente errata crea un pattern
   nuovo e concreto per l'avversario nella posizione reale.
3. `Trovata`: una mossa migliore o buona crea un pattern nuovo e concreto per
   chi muove nella posizione reale.

Il confronto usa tipo e case, non il testo della descrizione. L'ordine
restituito è sempre `missed`, `conceded`, `found`.

Per ridurre il rumore:

- mancate e concesse ammettono forchette, infilate, scacchi doppi, minacce di
  matto, attacchi di scoperta, pezzi intrappolati, pezzi indifesi e
  inchiodature assolute;
- trovate ammettono soltanto pattern forzanti o con conseguenza concreta:
  forchette, infilate, scacchi doppi, minacce di matto, attacchi di scoperta e
  pezzi intrappolati;
- una mossa conserva al massimo due occasioni mancate, due concesse e una
  trovata, con un massimo complessivo di tre pattern.

La classificazione resta coaching deterministico derivato da FEN, mossa
migliore e valutazioni già calcolate. Non viene presentata come una nuova
valutazione Stockfish.

## Direzione UX

**THESIS.** La revisione mette in primo piano ciò che si poteva imparare e usa
il successo come conferma rara, non come catalogo di medaglie.

**OWN-WORLD.** Il pattern mantiene il colore tattico esistente; stato, icona,
bordo e tono del contenitore comunicano la categoria su superfici Grafite.

**STORY.** L'utente riconosce subito se ha perso, concesso o trovato
un'occasione, osserva la posizione pertinente e torna senza ambiguità alla
partita.

**FIRST VIEWPORT.** Il commento della mossa resta compatto nella sidebar; il
chip precede la spiegazione. Una preview mancata usa la scacchiera principale
e un avviso contestuale immediatamente sotto di essa.

**FORM.** Estensione locale in modalità Operate della superficie di Analisi:
nessun nuovo mondo visivo, nessuna gamification e nessuna modifica a
`DESIGN.md`.

## Interazione e gerarchia visiva

- Etichette definitive: `Mancata · Forchetta`, `Concessa · Forchetta`,
  `Trovata · Forchetta`.
- Lo stato non modifica il colore assegnato al tipo di pattern.
- `Mancata`: icona occasione, bordo tratteggiato e tono ambra.
- `Concessa`: icona attenzione e contenitore rosso/corallo.
- `Trovata`: spunta e contenitore positivo più discreto.
- Il chip mantiene `aria-pressed`, selezione singola e deselezione al secondo
  clic.
- Selezionare `Concessa` o `Trovata` evidenzia le case sulla posizione reale.
- Selezionare `Mancata` mostra la FEN alternativa con il messaggio
  `Se avessi giocato <SAN>…` e un comando `Torna alla partita`. La preview è
  temporanea e non modifica storia, annotazioni o persistenza.

## Percorso di revisione

- `Prossimo momento importante` naviga prima le mosse con tattiche mancate,
  poi quelle concesse e infine quelle trovate, mantenendo l'ordine cronologico
  dentro ogni gruppo.
- Il riepilogo distingue `Da allenare` (mancate e concesse) e `Cose fatte
  bene` (trovate), senza punteggi, trofei o animazioni celebrative.
- Se non esistono tattiche selezionate dalla classificazione, il percorso non
  mostra controlli vuoti.

## Compatibilità e persistenza

- `tacticalPatternsFromJson` valida stato, case e alternativa.
- Backup, import e mapper Supabase continuano a usare il campo JSON esistente.
- Le analisi storiche vengono ricostruite soltanto se hanno FEN ed evaluation
  sufficienti; in caso contrario non viene inventato uno stato.
- La conversione da Analisi a Studio continua a copiare soltanto la linea di
  mosse, come stabilito da UI-011.

## Test e verifica

- Test RED/GREEN per nascita, confronto e priorità dei tre stati.
- Test parser/mapper per payload aggiornato e compatibilità storica.
- Test componenti per etichette, icone, accessibilità e preview alternativa.
- Test del percorso di revisione e del riepilogo.
- `npm test`, `npm run lint`, `npm run build`, `git diff --check`.
- Verifica visiva desktop e iPad Mini landscape prima della chiusura.

