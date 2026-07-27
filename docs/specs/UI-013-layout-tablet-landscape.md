# UI-013: Layout tablet landscape e invito alla rotazione

## Obiettivo di business

Consentire l'uso comodo delle viste Studio e Analisi su tablet in orientamento
landscape, incluso iPad Mini, mostrando contemporaneamente navigazione,
scacchiera e mosse e guidando chi usa un formato portrait verso l'esperienza
supportata.

## In ambito

- Attivazione del layout a tre colonne di Studio e Analisi con una variante
  `tablet-landscape` dedicata: larghezza minima `57rem` (`912px`), altezza
  minima `36rem` (`576px`), orientamento landscape e larghezza inferiore a
  `xl`.
- Profilo di larghezze dedicato ai tablet landscape, senza modificare i profili
  desktop esistenti a `xl` e `2xl`.
- Profilo `tablet-landscape-wide` da `70rem` (`1120px`) che mantiene la
  scacchiera compatibile con l'altezza disponibile e usa lo spazio orizzontale
  aggiuntivo per ampliare entrambe le sidebar.
- Altezza vincolata alla viewport e overflow interno delle sidebar nella
  variante `tablet-landscape` e dai breakpoint desktop.
- Empty state a schermo intero sulle route private in orientamento portrait e
  sotto `1280px`, con invito a ruotare il dispositivo.
- Animazione dell'indicatore di rotazione e alternativa statica per chi ha
  richiesto la riduzione dei movimenti.
- Mantenimento dell'accesso alle route pubbliche di autenticazione in portrait.

## Fuori ambito

- Un layout applicativo completo e ottimizzato per smartphone.
- La trasformazione delle sidebar in drawer, tab o pannelli a scomparsa.
- La riprogettazione touch di toolbar, navigazione o controlli della
  scacchiera.
- Modifiche ai breakpoint e alle larghezze desktop correnti a `xl` e `2xl`.
- Modifiche al layout stacked usato dai telefoni landscape che non raggiungono
  insieme larghezza e altezza minime della variante tablet.
- Modifiche a persistenza, API, autenticazione o modello dati.

Il supporto responsive completo per smartphone e registrato separatamente in
`docs/tech-debt/responsive-smartphone-layout.md` come debito tecnico Frontend
con priorita Medium.

## Requisiti funzionali

1. Quando la viewport landscape misura almeno `912px` per `576px`, Studio deve
   mostrare il layout a tre colonne con tracce tablet
   `10rem / minmax(25rem, 34rem) / 17rem`.
2. Quando la viewport landscape misura almeno `912px` per `576px`, Analisi deve
   mostrare il layout a tre colonne con tracce tablet
   `9rem / minmax(25rem, 34rem) / 17rem`.
3. Da `1120px` e sotto `1280px`, Studio e Analisi devono usare le tracce tablet
   ampie `12rem / minmax(25rem, 34rem) / 20rem`, riducendo lo spazio laterale
   inutilizzato senza ingrandire verticalmente la scacchiera.
4. Ai breakpoint `xl` e `2xl`, Studio e Analisi devono continuare a usare le
   larghezze desktop attuali, che prevalgono sul profilo tablet.
5. Nella variante `tablet-landscape` e dai breakpoint desktop, ogni
   `ViewportSidebar` deve usare l'altezza disponibile della viewport e
   mantenere lo scorrimento del proprio contenuto all'interno della colonna,
   senza allungare la pagina oltre il layout previsto.
6. Sulle route private, quando la viewport è in orientamento portrait e ha
   larghezza inferiore a `1280px`, il contenuto applicativo deve essere
   sostituito da un layer a schermo intero che invita a ruotare il dispositivo
   in landscape per visualizzare meglio scacchiera e mosse.
7. Il layer portrait deve mostrare un'indicazione visiva animata della rotazione
   e un testo comprensibile anche senza affidarsi all'animazione.
8. Se il sistema dichiara `prefers-reduced-motion: reduce`, l'indicazione di
   rotazione deve restare visibile ma non deve essere animata.
9. Le route pubbliche di login, invito e recupero password devono rimanere
   accessibili e utilizzabili in portrait senza mostrare il layer di rotazione.
10. Se una viewport landscape non raggiunge `912px` di larghezza o `576px` di
   altezza, l'app deve conservare il layout stacked esistente come fallback
   temporaneo.
11. Il passaggio tra portrait e landscape deve aggiornare il layout senza
    richiedere il ricaricamento della pagina.

## Requisiti non funzionali

### Usabilità e responsive design

- Il profilo tablet deve funzionare senza sovrapposizioni o tagli nelle
  viewport effettive dell'emulazione iPad Mini, oltre che a `1024x768` e
  `1133x744` CSS pixel.
- A `1133x744` e `1180x820` CSS pixel le sidebar devono sfruttare la larghezza
  disponibile lasciando soltanto il margine necessario al contenitore pagina.
- La scacchiera deve restare interamente visibile nella colonna centrale; le
  liste lunghe devono scorrere nelle rispettive sidebar.
- Il layer portrait deve coprire anche eventuali contenuti scrollabili e non
  deve lasciare controlli privati interagibili dietro di sé.

### Accessibilità

- Il messaggio di rotazione deve essere espresso come testo, con contrasto
  coerente con il tema e ordine di lettura comprensibile alle tecnologie
  assistive.
- Il comportamento deve rispettare `prefers-reduced-motion` senza rendere meno
  comprensibile l'invito.
- Il layer non deve introdurre focus su controlli nascosti né intrappolare il
  focus su elementi non interattivi.

### Prestazioni e compatibilità

- Il cambio di orientamento deve dipendere da CSS/media query e stato locale
  leggero, senza richieste di rete o ricalcoli applicativi costosi.
- Il comportamento deve basarsi sui CSS pixel della viewport e non su uno
  specifico user agent o modello di dispositivo.

## Impatto su dati e contratti

None.

## Regole di validazione

- Il layout tablet a tre colonne si applica soltanto con orientamento
  landscape, larghezza minima `912px`, altezza minima `576px` e sotto `xl`;
  dai breakpoint desktop continuano a valere le regole esistenti.
- Il profilo tablet ampio si applica da `1120px` e deve prevalere sul profilo
  tablet base fino al breakpoint `xl`.
- Il guard portrait si applica soltanto quando sono vere entrambe le
  condizioni: orientamento `portrait` e larghezza inferiore a `1280px`.
- Il guard portrait si applica soltanto alla shell privata; le route pubbliche
  di autenticazione ne sono escluse.
- I breakpoint `xl` e `2xl` devono sovrascrivere le tracce tablet con i valori
  desktop già esistenti.
- Sotto una delle dimensioni minime tablet non devono essere forzate tre
  colonne, anche se l'orientamento e landscape.
- Con `prefers-reduced-motion: reduce` non deve essere eseguita alcuna
  animazione di rotazione.

## Test attesi

- Unit test delle classi condivise di layout: verifica delle tracce Studio
  `10rem / minmax(25rem, 34rem) / 17rem` nella variante
  `tablet-landscape` e conservazione dei valori correnti a `xl` e `2xl`.
- Unit test delle classi condivise di layout: verifica delle tracce Analisi
  `9rem / minmax(25rem, 34rem) / 17rem` nella variante
  `tablet-landscape` e conservazione dei valori correnti a `xl` e `2xl`.
- Unit test delle classi condivise di layout: verifica delle tracce ampie
  `12rem / minmax(25rem, 34rem) / 20rem` nella variante
  `tablet-landscape-wide` per Studio e Analisi.
- Test di `ViewportSidebar`: altezza viewport e overflow interno sono attivi
  nella variante `tablet-landscape` e da `xl`.
- Test della shell privata: in portrait sotto `1280px` viene mostrato il
  messaggio di rotazione e il contenuto applicativo non è disponibile
  all'interazione.
- Test della shell privata: in landscape il messaggio scompare e il contenuto
  applicativo torna disponibile senza reload.
- Test delle route pubbliche: login, invito e recupero password restano
  renderizzati in portrait sotto `1280px`.
- Test accessibilità/CSS: con `prefers-reduced-motion: reduce` l'icona resta
  visibile senza animazione.
- Verifica visiva di Studio e Analisi a `1024x768` e `1133x744`: tre colonne,
  scacchiera leggibile, pannello mosse visibile e sidebar con scroll interno.
- Verifica visiva in portrait alle viewport corrispondenti: layer a schermo
  intero, testo leggibile e nessun contenuto privato interagibile.
- Verifica visiva su smartphone landscape sotto `576px` di altezza: layout
  stacked esistente senza regressioni.
- Esecuzione della suite, lint e build di produzione.

## Criteri di accettazione

- [ ] Studio e Analisi usano tre colonne nella variante `tablet-landscape` con
      le tracce tablet definite.
- [ ] A partire da `1120px` Studio e Analisi ampliano le sidebar e riducono lo
      spazio laterale inutilizzato.
- [ ] Un iPad Mini in landscape visualizza contemporaneamente scacchiera e
      mosse senza sovrapposizioni né scroll orizzontale della pagina.
- [ ] Le larghezze desktop a `xl` e `2xl` non cambiano.
- [ ] Le sidebar hanno altezza vincolata alla viewport e scroll interno nella
      variante tablet e dai breakpoint desktop.
- [ ] Le route private in portrait sotto `1280px` mostrano l'invito animato a
      ruotare il dispositivo e nascondono il contenuto applicativo.
- [ ] L'invito resta chiaro e statico quando è attiva la riduzione dei
      movimenti.
- [ ] Le route pubbliche di autenticazione restano utilizzabili in portrait.
- [ ] I telefoni landscape che non raggiungono le dimensioni tablet mantengono
      il fallback stacked.
- [ ] I test attesi, lint e build terminano senza errori introdotti dalla
      modifica.

## Domande aperte

Nessuna.
