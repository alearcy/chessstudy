# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Il prodotto nasce come applicazione personale per un singolo scacchista italiano. L'utente vuole organizzare il proprio studio, analizzare le proprie partite e capire errori e alternative senza dipendere da un abbonamento a un servizio commerciale.

Non è previsto, per ora, di estendere il prodotto a un pubblico ampio, a organizzazioni o a flussi multiutente. Un eventuale ampliamento futuro resta una decisione aperta, non un obiettivo corrente.

## Product Purpose

Chessstudy permette di studiare scacchi creando studi strutturati e, soprattutto, di analizzare gratuitamente le partite con il supporto di un coach virtuale.

Il risultato atteso è che l'utente possa importare o ricostruire una partita, individuare i momenti critici, comprendere gli errori e trasformare l'analisi in materiale riutilizzabile per lo studio, mantenendo il prodotto sostenibile sui piani gratuiti dei servizi utilizzati.

## Positioning

Chessstudy combina nello stesso archivio personale:

- studi composti da più scacchiere, mosse, varianti e commenti;
- partite importate e analizzate nel browser con Stockfish;
- spiegazioni educative e indicazioni da coach virtuale derivate da fatti scacchistici verificabili.

La posizione di riferimento è rendere accessibile gratuitamente, per uso personale, il tipo di supporto all'analisi e alla comprensione delle partite che su piattaforme come Chess.com è associato a funzionalità a pagamento. Questo è un obiettivo di prodotto, non una dichiarazione di equivalenza completa tra i servizi.

## Operating Context

- L'applicazione è privata e l'accesso avviene tramite un account ricevuto su invito.
- L'interfaccia e i contenuti applicativi sono in italiano.
- L'uso principale avviene sul web da desktop o tablet in orientamento orizzontale.
- L'utente può partire da uno studio vuoto, da un PGN o da una partita importata da Chess.com o Lichess.
- Studi e analisi convivono nello stesso archivio personale e possono essere cercati, filtrati e riaperti nel tempo.

## Capabilities and Constraints

- Creazione e gestione di studi con più scacchiere, sequenze di mosse, varianti, commenti e annotazioni sulla scacchiera.
- Importazione di partite tramite PGN, Chess.com e Lichess.
- Analisi automatica nel browser con Stockfish 19 WASM, con modalità multi-thread quando supportata e fallback single-thread.
- Classificazione delle mosse, individuazione dei momenti critici e spiegazioni educative deterministiche basate sui risultati del motore e su diagnostiche scacchistiche.
- Esportazione degli studi e backup/ripristino dei dati tramite file.
- Persistenza e autenticazione tramite Supabase; distribuzione web tramite Cloudflare.
- Il client usa soltanto credenziali pubbliche appropriate al browser. Calcolo e funzionalità devono evitare, quando possibile, costi server ricorrenti.
- Il perimetro funzionale deve restare intenzionalmente contenuto per mantenere l'applicazione personale, manutenibile e compatibile con i piani gratuiti di Supabase e Cloudflare.
- Funzionalità sociali, collaborazione, marketplace, crescita pubblica e gestione di organizzazioni non fanno parte del perimetro corrente.

## Brand Commitments

- Nome del prodotto: **Chessstudy**.
- Lingua e voce: italiano chiaro, concreto ed educativo; le spiegazioni non devono presentare euristiche o commenti del coach come verità più certe dei dati scacchistici che li supportano.
- Asset principale esistente: `public/chessstudy.png`.

## Evidence on Hand

- Applicazione web funzionante con flussi di autenticazione, archivio di studi e analisi, scacchiera interattiva, importazioni, Stockfish nel browser, coach deterministico, esportazioni e backup.
- Implementazione del motore in `src/services/analysisService.ts`.
- Diagnostiche e spiegazioni educative in `src/services/coachDiagnostics.ts` e `src/services/explainService.ts`.
- Flussi principali in `src/pages/LessonsPage.tsx` e `src/pages/LessonDetailPage.tsx`.
- Logo del prodotto in `public/chessstudy.png`.
- Non sono disponibili testimonianze, benchmark pubblici, numeri di utilizzo o prove di equivalenza con prodotti commerciali; il lavoro futuro non deve inventarli.

## Product Principles

1. **Lo studio nasce dall'analisi.** Rendere semplice passare dalla partita ai momenti critici, dalle spiegazioni al materiale da ripassare.
2. **Gratis per architettura, non per promessa fragile.** Privilegiare calcolo nel browser, perimetro contenuto e uso responsabile dei piani gratuiti.
3. **La verità scacchistica viene prima della narrazione.** Stockfish e i fatti verificabili fondano il giudizio; il coach li traduce in indicazioni comprensibili senza sovrappromettere.
4. **Profondità personale prima dell'ampiezza.** Migliorare il flusso del singolo utente invece di aggiungere crescita, collaborazione o complessità non necessarie.
5. **I dati di studio devono restare recuperabili.** Persistenza, esportazione e backup sono parte del valore del prodotto, non funzioni accessorie.
