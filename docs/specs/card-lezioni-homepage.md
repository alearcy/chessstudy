# UI-002: Card compatte delle lezioni in homepage

## Obiettivo

Rendere più compatto l'elenco delle lezioni in homepage e mostrare, per le
partite importate, la piattaforma indicata dal PGN.

## Layout

- Il titolo `Lezioni` sopra la homepage viene rimosso.
- Ogni card usa due righe compatte.
- Prima riga: icona e titolo a sinistra; preferito, modifica ed elimina a
  destra.
- Seconda riga: data di creazione e, se disponibile, fonte della partita.
- La descrizione non viene mostrata nell'elenco; resta disponibile nel modello
  e nella pagina di dettaglio.
- Un titolo lungo viene troncato senza spostare le azioni su una nuova riga.

## Fonte PGN

La fonte viene derivata in lettura dagli header `Site` e, come fallback,
`Link` della prima scacchiera della lezione. Non viene aggiunto un nuovo campo
persistito, così anche le partite già importate ricevono l'etichetta.

- URL o valori riferiti a `lichess.org` sono mostrati come `Lichess`.
- URL o valori riferiti a `chess.com` sono mostrati come `Chess.com`.
- Per altre URL viene mostrato il dominio senza `www.`.
- Per valori PGN non URL viene mantenuto il testo originale.
- Valori vuoti o `?` non producono alcuna etichetta.

La query paginata carica in un'unica lettura le scacchiere delle sole lezioni
della pagina corrente, evitando una query separata per ogni card.

## Verifica

- Test repository per fonte Lichess, Chess.com, fallback e assenza.
- Test homepage per assenza del titolo, struttura a due righe e posizione delle
  azioni.
- Suite completa e build.

