# UI-015 — Footer copyright e indicazioni open source

## Obiettivo

Aggiungere alla shell privata di Chessstudy un copyright discreto e sempre
aggiornato, senza sottrarre attenzione alla scacchiera o agli strumenti di
studio. Separare questa modifica visiva dalla scelta legale della licenza open
source, che richiede una decisione esplicita del proprietario del progetto.

## Comportamento

- Il footer appare nelle route applicative protette, sotto il contenuto della
  pagina.
- Il testo segue il formato `© <anno corrente> Alessandro Arcidiaco`.
- L'anno viene calcolato a runtime con `new Date().getFullYear()`.
- Le route pubbliche di autenticazione mantengono il layout attuale.
- Il guard portrait continua a sostituire interamente la shell privata.

## Interfaccia

- La shell usa un layout verticale flex con il contenuto principale espandibile,
  così il footer resta in fondo alle pagine corte e segue il contenuto nelle
  pagine lunghe.
- Il footer usa testo caption neutro, una linea capillare superiore e lo stesso
  contenitore centrato da 96rem della shell.
- Non vengono introdotti colori decorativi, link o nuove azioni.

## Licenza e credits

Il progetto è distribuito sotto GNU GPL versione 3 o successiva, coerentemente
con Chessground (`GPL-3.0-or-later`) e con la distribuzione Stockfish WASM
(`GPL-3.0`). Il file `LICENSE` contiene l'intestazione di copyright di
Alessandro Arcidiaco, la dichiarazione `GPL-3.0-or-later` e il testo integrale
della GPLv3.

`THIRD_PARTY_NOTICES.md` documenta le dipendenze runtime dirette e Stockfish,
con versioni bloccate, licenze, attribuzioni e URL upstream. Conserva inoltre
i testi delle licenze permissive applicabili e rimanda ai file già distribuiti
per licenza e sorgente corrispondente di Stockfish.

## Verifica

- Test del rendering del testo con anno corrente nella shell privata.
- Conferma che la route pubblica non erediti il footer.
- `npm test`, `npm run lint`, `npm run build` e controllo del diff.
- Verifica dell'integrità del testo GPL e dei metadati elencati nei notice.
- Conferma visiva del footer in una route privata desktop o tablet landscape.
