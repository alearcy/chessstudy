# UI-012: Controlli touch della scacchiera di Studio

## Obiettivo

Ripristinare nella toolbar della scacchiera di Studio i selettori `Muovi`,
`Frecce`, `Evidenzia` e `Gomma`, così le interazioni restano disponibili anche
su schermi touch. Le gesture mouse già presenti e la navigazione da tastiera
non vengono rimosse.

## Comportamento

- `Muovi` è la modalità predefinita e consente drag and drop e selezione dei
  pezzi.
- `Frecce` consente di trascinare con mouse o touch dalla casa di partenza a
  quella di arrivo. Ripetere la stessa freccia la rimuove.
- `Evidenzia` consente di toccare o cliccare una casa. Ripetere la selezione la
  rimuove.
- `Gomma` elimina un'evidenziazione con un tocco e una freccia ripercorrendola
  dalla casa di partenza a quella di arrivo.
- Il selettore attivo è visibile e comunicato con `aria-pressed`.
- La selezione di uno strumento non mostra cursori speciali o indicatori di
  caricamento sopra la scacchiera.
- La toolbar resta su una sola riga durante il cambio di strumento; alle
  larghezze intermedie usa le sole icone e, se necessario, scorre
  orizzontalmente senza mandare a capo l'azione di ripristino.
- Le gesture mouse esistenti per le annotazioni continuano a funzionare in
  modalità `Muovi`.
- I selettori non sono mostrati nella modalità Analisi, che resta read-only.
- Frecce ed evidenziazioni continuano a usare il callback atomico già esistente,
  così la persistenza per posizione non cambia.

## Verifica

- Test del rendering e dello stato accessibile dei quattro selettori.
- Test delle interazioni touch per aggiungere e rimuovere frecce e case.
- Test di non regressione per gesture Studio e read-only Analisi.
- Test mirati, lint e build.

## Fuori ambito

- Scelta del colore delle annotazioni da una palette touch.
- Modifiche alla navigazione da tastiera.
