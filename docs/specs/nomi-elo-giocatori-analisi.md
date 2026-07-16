# Nomi ed ELO dei giocatori nella scacchiera di analisi

## Obiettivo

Mostrare i dati dei giocatori vicino ai rispettivi lati della scacchiera nelle
lezioni in modalita `analysis`, lasciando la barra di valutazione come unico
indicatore visivo della posizione.

## Comportamento

- Con orientamento Bianco, il giocatore Nero appare sopra la scacchiera e il
  giocatore Bianco sotto.
- Quando la scacchiera viene ruotata, anche le due righe giocatore si scambiano
  per restare associate al lato visibile corretto.
- Il nome proviene dai campi `Board.whiteName` e `Board.blackName`.
- L'ELO proviene dagli header PGN `WhiteElo` e `BlackElo`, gia conservati in
  `Board.headers` anche per le partite importate da Lichess e Chess.com.
- Quando presente, l'ELO segue il nome tra parentesi, senza l'etichetta
  testuale `Elo` (per esempio `Garry Kasparov (2812)`).
- Nome ed ELO sono mostrati solo quando presenti e valorizzati. Valori assenti,
  vuoti o `?` non producono placeholder, simboli o etichette sostitutive.
- Se per un giocatore non e disponibile alcun dato, la relativa riga non viene
  renderizzata.
- La riga del giocatore superiore viene renderizzata sotto la toolbar della
  scacchiera e immediatamente prima della tavola; non sopra i controlli.
- La valutazione numerica e la profondita vengono rimosse solo dal layout
  `analysis`; la barra verticale resta visibile e accessibile.
- Il layout delle lezioni `study` non cambia.

## Implementazione

- Un componente presentazionale dedicato normalizza e visualizza nome ed ELO
  per il lato superiore e inferiore in base all'orientamento.
- `LessonDetailPage` prepara le due etichette dai dati della scacchiera
  selezionata e le passa agli slot superiore e inferiore di `ChessBoardView`.
- Non vengono aggiunti campi al database e non sono necessarie migrazioni.

## Test

- Visualizzazione di nomi ed ELO disponibili.
- Formato dell'ELO tra parentesi e assenza della parola `Elo`.
- Posizionamento dell'etichetta superiore dopo la toolbar e prima della tavola.
- Omissione indipendente di nome, ELO e intera riga quando assenti o `?`.
- Scambio corretto delle righe dopo il cambio di orientamento.
- Test e build completi del progetto.

## Fuori scope

- Modifica o inserimento manuale dei dati giocatore.
- Persistenza di campi ELO separati dagli header PGN.
- Modifiche al layout della modalita `study`.
