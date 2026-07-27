# TD-002: Layout responsive completo per smartphone

**Status:** Open
**Priority:** Medium
**Area:** Frontend / Responsive
**Created:** 2026-07-20
**Related task:** UI-013

## Problema

Le pagine applicative sono progettate per desktop e tablet landscape. Non
esiste ancora un layout dedicato alle larghezze da smartphone che renda
comodamente accessibili scacchiera, lista delle scacchiere, notazione, note e
azioni senza comprimere o impilare eccessivamente i contenuti.

## Workaround corrente

- Sotto 1280 CSS px in orientamento portrait la shell privata viene sostituita
  da un invito a ruotare il dispositivo in landscape.
- In landscape, le viewport che non raggiungono insieme `912px` di larghezza e
  `576px` di altezza mantengono il layout incolonnato preesistente, senza
  un'esperienza smartphone ottimizzata.
- Le route pubbliche di autenticazione restano accessibili anche in portrait.

Il codice del guard portrait deve mantenere un riferimento a questo file.

## Impatto

- L'applicazione non e utilizzabile in portrait dopo l'accesso.
- Su smartphone landscape scacchiera, mosse e azioni richiedono scroll e non
  sono organizzate secondo le priorita di uno schermo piccolo.
- Il workaround non sostituisce una progettazione mobile completa e non deve
  essere esteso con ulteriori eccezioni locali.

## Piano di risoluzione

1. Definire la gerarchia mobile tra scacchiera, mosse, note e liste laterali.
2. Trasformare le sidebar in drawer, sheet o tab accessibili da touch.
3. Rendere toolbar e controlli compatibili con safe area e viewport ridotti.
4. Gestire portrait e landscape senza bloccare la shell applicativa.
5. Verificare navigazione tastiera, screen reader e `prefers-reduced-motion`.
6. Aggiungere test e verifiche visive da 320 a 932 CSS px.

## Criteri di risoluzione

- Tutte le funzioni principali sono utilizzabili su smartphone portrait e
  landscape senza il guard di orientamento.
- Scacchiera e notazione restano leggibili e raggiungibili con un flusso touch
  esplicito.
- Non esistono overflow orizzontali involontari alle viewport supportate.
- Test, lint, build e verifica responsive passano.
