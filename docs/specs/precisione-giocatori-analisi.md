# Precisione dei giocatori nell'analisi

## Obiettivo

Mostrare per Bianco e Nero una percentuale sintetica di precisione dopo che
l'analisi Stockfish della partita e completa. Il valore deve essere
deterministico, derivato soltanto dalle valutazioni gia persistite e non deve
essere presentato come equivalente alla metrica proprietaria di altri servizi.

## Calcolo

- La posizione iniziale usa `Board.evalCp` o `Board.evalMate`; ogni posizione
  successiva usa la valutazione salvata sulla relativa `Move`.
- Una valutazione in centipawn viene trasformata in probabilita percentuale del
  Bianco con la funzione sigmoide
  `50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)`.
- Un matto a favore del Bianco vale `100`, un matto a favore del Nero vale `0`.
- Per ogni mossa si misura la perdita di probabilita dal punto di vista di chi
  muove; un miglioramento rispetto alla valutazione precedente viene limitato a
  perdita zero.
- La precisione della singola mossa e
  `103.1668 * exp(-0.04354 * perdita) - 3.1669`, limitata fra `0` e `100`.
- La precisione del giocatore e la media aritmetica delle proprie mosse,
  arrotondata all'intero piu vicino.
- Se manca la valutazione iniziale o quella di almeno una mossa, non viene
  mostrata alcuna percentuale. Un colore senza mosse analizzate non riceve un
  valore.

## Interfaccia

- La percentuale appare nella riga del relativo giocatore come
  `Precisione 93%`, accanto a nome ed ELO.
- La mappatura segue l'orientamento della scacchiera insieme ai dati del
  giocatore: ruotando la scacchiera si scambiano anche le percentuali.
- Il valore usa testo secondario e cifre tabulari; non introduce colori,
  punteggi celebrativi o elementi di gamification.
- Durante l'analisi e quando i dati sono incompleti la riga conserva il
  comportamento attuale senza placeholder di precisione.
- La modalita `study` non cambia.

## Implementazione

- Aggiungere un helper puro dedicato che riceve posizione iniziale e mosse
  valutate e restituisce i valori di Bianco e Nero.
- Calcolare il risultato in `LessonDetailPage` dai dati gia caricati, senza
  nuove colonne, migrazioni o scritture Supabase.
- Estendere `AnalysisPlayerLabel` con i due valori opzionali e lasciare al
  componente la scelta del colore corretto in base a posizione e orientamento.

## Test

- Precisione `100` per mosse senza perdita e riduzione per errori progressivi.
- Calcolo corretto dal punto di vista del Nero e gestione dei matti.
- Nessun risultato con analisi incompleta; supporto alle partite con numero
  dispari di semimosse.
- Visualizzazione e scambio delle percentuali con la rotazione della scacchiera.
- Test completi, lint, build e `git diff --check` passano.

## Fuori scope

- Persistenza della percentuale nel database.
- Confronto o promessa di equivalenza con Chess.com, Lichess o altre
  piattaforme.
- Classifiche, premi, storico della precisione o confronti fra partite.
