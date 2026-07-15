# FEAT-010: Riconoscimento aperture e creazione studi

## Obiettivo

Usare il database TSV in `docs/aperture/` per riconoscere le aperture durante
l'analisi di una partita, suggerire una continuazione motivata dai dati
Stockfish e permettere di trasformare ogni risultato in materiale di studio.

Ogni apertura aggiunta allo studio deve essere una scacchiera autonoma che
contiene l'intera sequenza di mosse dichiarata dal record TSV selezionato.

## Dati delle aperture

I file `a.tsv` ... `e.tsv` hanno le colonne:

```text
eco\tname\tpgn
```

- I TSV vengono caricati dinamicamente solo quando serve l'analisi delle
  aperture, così non entrano nel bundle iniziale.
- Ogni PGN viene convertito con `chess.js` in una sequenza normalizzata di mosse
  UCI. Il confronto non dipende quindi da suffissi SAN come `+` o `#`.
- Il parser scarta righe non valide senza bloccare l'analisi Stockfish e rende
  visibile un errore se il database non può essere caricato.

## Riconoscimento

Per ogni colore vengono prodotti due risultati:

- **Apertura giocata**: il record più profondo la cui intera sequenza è un
  prefisso esatto della partita e la cui ultima mossa appartiene al colore in
  esame. Se non esiste un record che termina su quel colore, si usa il record
  esatto più profondo raggiunto dalla partita.
- **Apertura suggerita**: alla prima deviazione dal libro del colore, si usa la
  miglior mossa Stockfish della posizione precedente. Se quella mossa è una
  continuazione presente nel database, viene scelta deterministicamente la
  linea più profonda che la contiene. Se non esiste una continuazione supportata
  dal database, il suggerimento coincide con l'apertura giocata.

Il termine "suggerita" non implica una valutazione assoluta del valore delle
aperture: i TSV non contengono statistiche o risultati. Il suggerimento è
ancorato alla posizione giocata, alla scelta Stockfish e alle linee disponibili.

I pareggi sono risolti in modo stabile: maggiore lunghezza della linea, poi ECO,
poi nome alfabetico.

## Persistenza

Il report viene salvato sulla `Board` di analisi e resta disponibile alla
riapertura della partita:

```ts
interface OpeningReference {
  eco: string;
  name: string;
  family: string;
  pgn: string;
}

interface OpeningReport {
  whitePlayed: OpeningReference | null;
  blackPlayed: OpeningReference | null;
  whiteSuggested: OpeningReference | null;
  blackSuggested: OpeningReference | null;
}
```

`family` è la parte stabile del nome prima del primo `:`; permette di
riconoscere, per esempio, `Sicilian Defense` e `Sicilian Defense: Dragon
Variation` come appartenenti alla stessa famiglia. I campi sono opzionali e non
indicizzati, quindi non richiedono una nuova versione dello schema Dexie.

## UI dell'analisi

La colonna sinistra resta dedicata esclusivamente ai dati PGN della partita.
La sidebar destra dell'analisi usa due tab:

- **Mosse**: tab predefinito; contiene commento Stockfish, spunto didattico,
  anteprima della linea di matto e notazione mosse già esistenti.
- **Aperture**: contiene il pannello con i quattro risultati e le azioni di
  creazione del materiale di studio.

Quando il report è disponibile, il tab Aperture mostra un indicatore visivo ma
non viene selezionato automaticamente, così l'analisi non interrompe la
navigazione delle mosse. Ogni tab usa lo spazio verticale della sidebar e il
proprio contenuto può scorrere senza nascondersi sotto la colonna delle
informazioni PGN.

Il pannello Aperture mostra:

- apertura giocata dal Bianco;
- apertura giocata dal Nero;
- apertura suggerita al Bianco;
- apertura suggerita al Nero.

Ogni nome è un pulsante. Il pannello distingue caricamento, assenza di
risultati ed errore con retry visibile. Il calcolo avviene dopo gli eval
Stockfish e non rende fallita l'analisi motore se il database delle aperture non
è disponibile.

## Creazione del materiale di studio

Al clic su un'apertura si apre un dialog di destinazione con due possibilità:

1. **Crea nuovo studio**
   - crea una `Lesson` in modalità `study`;
   - usa il nome dell'apertura come titolo iniziale dello studio;
   - crea al suo interno una Board con lo stesso nome;
   - popola la Board con l'intera sequenza PGN del record TSV, compresi FEN,
     ordine e catena `parentId` delle mosse.

2. **Aggiungi a uno studio esistente**
   - propone prima gli studi che contengono aperture della stessa `family`;
   - permette comunque di scegliere qualsiasi studio esistente;
   - non modifica mai il nome dello studio scelto;
   - aggiunge una nuova Board rinominata con il nome completo dell'apertura o
     variante selezionata;
   - la nuova Board contiene l'intera sequenza PGN del record TSV.

Esempio: se esiste lo studio `Sicilian Defense` e viene selezionata `Sicilian
Defense: Dragon Variation`, l'utente può creare un nuovo studio oppure
aggiungere allo studio esistente una Board chiamata `Sicilian Defense: Dragon
Variation`. Nel secondo caso `Sicilian Defense` non viene rinominato.

### Conflitti di nome

- Nuovo studio con titolo già esistente: chiedere se sovrascrivere quello
  studio oppure usare un nuovo nome; proporre automaticamente il primo suffisso
  libero, per esempio `(2)`.
- Aggiunta a studio esistente con Board omonima: chiedere se sovrascrivere solo
  quella Board oppure crearne una nuova con il primo suffisso libero.
- Ogni sovrascrittura è atomica e riguarda soltanto la destinazione confermata.

## Servizi

- `openingBookService.ts`: caricamento dinamico, parsing TSV/PGN e matching
  puro delle aperture.
- `openingStudyService.ts`: ricerca studi correlati, risoluzione nomi e
  transazioni Dexie per creare/sovrascrivere Lesson, Board e Move.
- Il servizio di studio salva sulle Board `openingEco`, `openingName` e
  `openingFamily`, usati per ritrovare gli studi correlati senza affidarsi solo
  al testo del titolo.

## TDD

1. Test parser e normalizzazione delle linee.
2. Test riconoscimento esatto per colore, deviazione e suggerimento Stockfish.
3. Test transazioni: nuovo studio, variante in studio esistente, conflitti e
   sequenza completa persistita.
4. Test del dialog e del pannello per scelta destinazione e retry visibile.
5. Implementazione minima, refactor, suite completa e build.

## Fuori ambito

- Traduzione in italiano dei nomi inglesi presenti nei TSV.
- Statistiche di popolarità o percentuale di vittorie delle aperture.
- Valutazione Stockfish completa di tutte le linee candidate del database.

## Definition of done

- I quattro risultati sono calcolati deterministicamente e persistiti.
- Ogni apertura cliccabile può creare uno studio o essere aggiunta come nuova
  scacchiera a uno studio esistente.
- Ogni scacchiera creata contiene la sequenza completa dell'apertura scelta.
- I conflitti di nome richiedono una scelta esplicita e non rinominano mai uno
  studio scelto come destinazione di una variante.
- Test, typecheck e build passano.
- Nessuna modifica preesistente viene committata e non viene creato alcun
  commit durante il task.
