# Grafico andamento partita

## Obiettivo

Mostrare sotto la scacchiera di analisi l'andamento della valutazione della
partita e permettere di navigare rapidamente tra le posizioni con un cursore
trascinabile.

## Ambito

- Il grafico e visibile soltanto nelle lezioni in modalita `analysis`.
- La prima posizione usa la valutazione salvata sulla `Board`; ogni punto
  successivo usa `evalCp` o `evalMate` della relativa `Move`.
- La scala e la stessa della barra verticale di valutazione: vantaggio Bianco
  verso l'alto, vantaggio Nero verso il basso, valori estremi saturati e matti
  agli estremi.
- La linea e bianca, con una leggera area grigia trasparente adatta al tema
  scuro. Non viene usato il viola del riferimento.
- Una linea orizzontale centrale rappresenta l'equilibrio.

## Badge

- Il grafico mostra soltanto le mosse classificate come migliori (`!!`, icona
  stella blu) o errori gravi (`??`, badge rosso).
- I marker riutilizzano forme e colori dei badge gia presenti nella notazione.
- Il calcolo di perdita, miglior mossa e classificazione e condiviso tra
  grafico, notazione e badge sulla scacchiera per evitare divergenze.
- Posizioni prive di valutazione non producono punti o marker; la linea non
  collega artificialmente segmenti separati da dati mancanti.

## Navigazione

- Il cursore verticale indica `historyIndex`, quindi resta sincronizzato con
  notazione, toolbar e navigazione da tastiera.
- Un controllo range trasparente sovrapposto al grafico mappa gli indici da
  `0` (posizione iniziale) a `moves.length` (ultima posizione).
- Trascinamento, click, touch e frecce della tastiera chiamano `goToMove` in
  tempo reale.
- Il controllo espone un'etichetta accessibile che indica posizione e mossa.

## Implementazione

- Estrarre un helper puro per calcolare annotazione e badge di una mossa dai
  dati prima/dopo, dal FEN e dalla miglior mossa UCI.
- Estrarre una funzione condivisa per convertire `evalCp`/`evalMate` nella
  percentuale visuale gia usata da `EvalBar`.
- Creare `GameEvaluationChart` come componente SVG responsivo senza nuove
  dipendenze.
- Integrare il componente nel ramo `analysis` di `LessonDetailPage`, sotto
  `ChessBoardView` e allineato alla larghezza della scacchiera.

## Test

- Scala condivisa per equilibrio, vantaggi, saturazione e matto.
- Classificazione condivisa di migliore mossa ed errore grave.
- Linea e segmenti con dati completi o mancanti.
- Marker limitati a migliori mosse ed errori gravi.
- Slider sincronizzato e navigazione all'indice richiesto.
- Test completi, lint, build e `git diff --check` passano.
