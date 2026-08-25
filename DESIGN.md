---
name: Chessstudy
description: Un banco di lavoro scacchistico calmo, preciso e ordinato per studiare e capire le partite.
colors:
  graphite-base: "oklch(0.145 0 0)"
  graphite-raised: "oklch(0.205 0 0)"
  limestone-surface: "oklch(0.269 0 0)"
  canvas-primary: "oklch(0.922 0 0)"
  canvas-text: "oklch(0.985 0 0)"
  limestone-text: "oklch(0.708 0 0)"
  limestone-ring: "oklch(0.556 0 0)"
  hairline: "oklch(1 0 0 / 10%)"
  input-line: "oklch(1 0 0 / 15%)"
  tactical-red: "oklch(0.704 0.191 22.216)"
  tactic-sky: "#0284c7"
  tactic-fuchsia: "#c026d3"
  tactic-orange: "#ea580c"
  tactic-emerald: "#059669"
  tactic-violet: "#7c3aed"
  tactic-rose: "#e11d48"
  tactic-amber: "#d97706"
  tactic-teal: "#0d9488"
  move-best: "rgb(59, 130, 246)"
  move-good: "rgb(34, 197, 94)"
  move-imprecision: "rgb(202, 138, 4)"
  move-mistake: "rgb(234, 88, 12)"
  move-blunder: "rgb(220, 38, 38)"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.333
    letterSpacing: "normal"
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.25
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  caption:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.025em"
  move-notation:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  "2xl": "32px"
components:
  button-primary:
    backgroundColor: "{colors.canvas-primary}"
    textColor: "{colors.graphite-raised}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "oklch(0.922 0 0 / 90%)"
    textColor: "{colors.graphite-raised}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.canvas-text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.canvas-text}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "6px 8px"
    height: "32px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.canvas-text}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.canvas-text}"
    rounded: "{rounded.xl}"
    padding: "24px"
  dialog:
    backgroundColor: "{colors.graphite-base}"
    textColor: "{colors.canvas-text}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Chessstudy

## Overview

**Creative North Star: "Il Banco del Coach"**

Chessstudy è un banco di lavoro digitale per osservare, annotare e capire: non una sala giochi e non una dashboard aziendale. L'ambiente scuro riduce il rumore attorno alla scacchiera, mentre la gerarchia compatta mantiene sempre vicini mosse, commenti e strumenti. Il carattere è calmo, preciso e ordinato.

I componenti devono risultare precisi e rassicuranti. Bordi sottili, superfici tonali e ombre contenute separano gli strumenti senza teatralità; il colore compare quando porta informazione scacchistica o segnala uno stato. Gli accenti corallo e oro del logo restano una firma del marchio, non una licenza per colorare indiscriminatamente l'interfaccia.

**Key Characteristics:**

- Campo di lavoro scuro e neutro, con contrasto chiaro e controllato.
- Densità operativa adatta a scacchiera, mosse e pannelli affiancati.
- Profondità strutturale discreta: bordi prima, ombre leggere dopo.
- Colore saturo riservato a tattiche, qualità delle mosse e stati semantici.
- Controlli compatti, leggibili e immediatamente riconoscibili.

## Colors

La palette combina Grafite, Tela e Calcare; il Rosso tattico e lo spettro delle annotazioni entrano soltanto quando comunicano significato.

### Primary

- **Tela primaria** (`canvas-primary`): riempie le azioni principali nel tema scuro e crea una gerarchia netta senza introdurre un colore di marca artificiale.
- **Testo tela** (`canvas-text`): sostiene testo ad alto contrasto, icone e contenuti principali.

### Secondary

- **Rosso tattico** (`tactical-red`): indica errori, azioni distruttive e stati che richiedono attenzione. Non è un accento decorativo.

### Tertiary

- **Spettro tattico** (`tactic-sky`, `tactic-fuchsia`, `tactic-orange`, `tactic-emerald`, `tactic-violet`, `tactic-rose`, `tactic-amber`, `tactic-teal`): distingue categorie tattiche adiacenti senza trasformarle in priorità globali.
- **Scala qualità mossa** (`move-best`, `move-good`, `move-imprecision`, `move-mistake`, `move-blunder`): conserva la semantica scacchistica dalle mosse migliori agli errori gravi.

### Neutral

- **Grafite base** (`graphite-base`): sfondo dominante dell'applicazione.
- **Grafite rialzata** (`graphite-raised`): pannelli, carte e superfici flottanti.
- **Calcare di superficie** (`limestone-surface`): hover, tab inattive e separazioni tonali.
- **Calcare testuale** (`limestone-text`): testo secondario e metadati.
- **Calcare di focus** (`limestone-ring`): anelli di focus e indicatori di interazione.
- **Linea capillare** (`hairline`) e **linea input** (`input-line`): confini a basso contrasto su superfici scure.

**The Graphite Field Rule.** Grafite resta il campo dominante; Tela chiarisce contenuto e azione, ma non diventa una seconda superficie di sfondo estesa.

**The Semantic Color Rule.** Ogni colore saturo deve spiegare una tattica, una valutazione o uno stato. Se non aggiunge significato, resta neutro.

**The Logo Boundary Rule.** Corallo e oro appartengono al logo finché non vengono deliberatamente estratti in una futura evoluzione del sistema.

## Typography

**Display Font:** nessun display font dedicato
**Body Font:** system sans (`ui-sans-serif`, `system-ui`, `sans-serif`)
**Label/Mono Font:** system mono per la notazione (`ui-monospace`, `SFMono-Regular`, `Menlo`, `Monaco`, `Consolas`, `monospace`)

**Character:** la tipografia è neutra e immediata. La gerarchia nasce soprattutto da peso, dimensione e densità, lasciando alla notazione monospaziata il compito di rendere le mosse rapidamente confrontabili.

### Hierarchy

- **Headline** (700, 24px, 1.333): titolo della lezione e messaggi di orientamento a schermo intero.
- **Title** (600, 18px, 1): titoli di dialoghi e blocchi principali.
- **Body** (400, 14px, 1.25): testo operativo, descrizioni e contenuti dei pannelli.
- **Label** (500, 14px, 1.25): pulsanti, campi, tab e controlli.
- **Caption** (500, 12px, 1, tracking 0.025em): metadati, sezioni compatte ed etichette in maiuscolo quando già previste.
- **Move notation** (400, 16px, 1.5): SAN, numeri di mossa e valori tecnici correlati.

**The One Family Rule.** Usa il system sans per tutta l'interfaccia; una nuova famiglia tipografica richiede una decisione di identità, non una scelta locale.

**The Chess Data Rule.** Riserva il monospaziato a notazione, FEN, valutazioni e dati tecnici confrontabili; non usarlo per titoli o call to action.

## Layout

Il guscio applicativo usa un contenitore centrato con larghezza massima di 96rem. L'header mantiene 24px di padding orizzontale e 16px verticale; il contenuto principale usa 16px. Le superfici di autenticazione si restringono a circa 28rem per mantenere i moduli leggibili e raccolti.

Le pagine operative privilegiano griglie e pannelli affiancati: scacchiera, barra di valutazione, mosse e commenti devono rimanere leggibili nello stesso campo visivo. Il ritmo ricorrente è 4/8/12/16/24/32px, con 8-12px tra controlli correlati e 16-24px tra gruppi funzionali.

L'esperienza privata è progettata per desktop e tablet in orizzontale. La variante tablet landscape parte da 57rem di larghezza e 36rem di altezza; sopra 70rem aumenta lo spazio disponibile. I pannelli verticali possono occupare `calc(100dvh - 13rem)` e scorrere internamente. In verticale, il guard di orientamento sostituisce l'interfaccia con un invito chiaro a ruotare il dispositivo.

**The One-Viewport Rule.** Sulla superficie di analisi, scacchiera e strumenti essenziali devono restare coordinati nello stesso viewport; lo scroll interno appartiene ai pannelli lunghi, non alla struttura principale.

**The Compact Control Rule.** Le azioni ricorrenti usano controlli da 24-36px; riserva altezze maggiori alle azioni di ingresso che spiegano anche il proprio scopo.

## Elevation & Depth

Il sistema usa profondità strutturale discreta. I bordi a basso contrasto definiscono quasi tutte le superfici; ombre piccole sostengono carte e controlli, mentre dialoghi e menu ricevono elevazione più netta. Il grafico di valutazione usa un'ombra interna perché rappresenta un'area incassata e interattiva.

### Shadow Vocabulary

- **Controllo minimo** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): input e pulsanti outline.
- **Superficie calma** (`0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): carte, tab selezionate e indicatori compatti.
- **Menu strutturale** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): menu contestuali e popover.
- **Dialogo** (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): dialoghi modali.
- **Area incassata** (`inset 0 2px 4px 0 rgb(0 0 0 / 0.05)`): grafici o letture tecniche integrate.

**The Border-First Rule.** A riposo, separa con bordo o tono. Aggiungi ombra solo quando una superficie è selezionata, flottante o realmente sovrapposta.

## Shapes

La forma di base è rettangolare con angoli morbidamente curvi. I controlli usano soprattutto 8px; dialoghi e pannelli integrati usano 10px; le carte principali arrivano a 14px. I chip tattici sono pillole complete, mentre badge e righe di notazione restano più compatti.

Le cornici sono sottili e poco contrastate. Cerchi perfetti sono riservati a icone, indicatori e piccoli badge sovrapposti; non diventano il linguaggio dominante dei contenitori.

**The Nested Radius Rule.** Un elemento annidato deve avere un raggio uguale o inferiore al contenitore che lo ospita.

## Components

### Buttons

- **Shape:** rettangolo compatto e rassicurante con raggio medio (8px).
- **Primary:** superficie Tela con testo Grafite; altezza standard 36px e padding orizzontale 16px.
- **Hover / Focus:** lieve riduzione dell'opacità al passaggio; bordo di focus e anello esterno da 3px al 50% del colore Calcare.
- **Outline:** sfondo Grafite base, bordo capillare e ombra minima; al passaggio assume il tono Calcare di superficie.
- **Ghost:** trasparente a riposo, superficie Calcare soltanto al passaggio; la variante icona può scendere a 24px.
- **Destructive:** Rosso tattico con testo chiaro; deve restare legato ad azioni irreversibili o errori.

### Chips

- **Style:** pillola con bordo colorato, riempimento della stessa tinta a bassa opacità e testo da 12px.
- **State:** selezionata usa il colore pieno, testo bianco e un anello tonale; non selezionata resta leggera.
- **Role:** i chip tattici distinguono concetti scacchistici, non categorie di navigazione generiche.

### Cards / Containers

- **Corner Style:** carte principali a 14px; contenitori operativi più compatti a 8-10px.
- **Background:** Grafite rialzata sul campo Grafite base.
- **Shadow Strategy:** ombra calma e bordo capillare; hover tramite cambio tonale o del bordo, non tramite grandi spostamenti.
- **Internal Padding:** 16px nelle righe d'archivio; 24px nelle carte e nei dialoghi completi.

### Inputs / Fields

- **Style:** altezza 36px, sfondo trasparente, bordo input al 15%, raggio 8px e padding orizzontale 12px.
- **Focus:** il bordo assume Calcare di fuoco e compare un anello esterno da 3px al 50%.
- **Error / Disabled:** Rosso tattico per bordo e anello; opacità 50% per lo stato disabilitato.

### Navigation

L'header è essenziale: logo a sinistra, identità dell'account e azioni iconiche a destra. Le tab locali usano un binario Calcare con elemento selezionato Grafite base e ombra calma. Le righe selezionabili cambiano tono, non scala.

### Dialogs and Menus

I dialoghi sono centrati, larghi quanto il contenuto richiede e limitati alla viewport con 16px di margine minimo. Usano overlay nero al 50%, raggio 10px, padding 24px e ombra dialogo. I menu sono più compatti: padding 4px, righe da 32px circa e raggio 8px.

### Chess Workspace

La scacchiera resta il centro visivo. Barra di valutazione, andamento partita, notazione e pannelli laterali usano neutrali scuri così i colori di pezzi, frecce, tattiche e classificazioni conservano priorità. La mossa corrente usa una tinta primaria leggera; la notazione usa il font monospaziato e scrolla mantenendo visibile la selezione.

## Do's and Don'ts

### Do:

- **Do** mantenere Grafite come campo dominante e usare Tela per testo e azioni prioritarie.
- **Do** usare il ritmo 4/8/12/16/24/32px e raggi coerenti da 8-14px.
- **Do** rendere visibili focus, caricamento, errore, selezione e disabilitazione.
- **Do** riservare i colori saturi a tattiche, qualità delle mosse e stati semantici.
- **Do** mantenere scacchiera e strumenti essenziali coordinati nel viewport desktop o tablet landscape.

### Don't:

- **Don't** introdurre neon, bagliori, gradienti spettacolari o cromie da interfaccia gaming.
- **Don't** usare gamification vistosa, trofei o ricompense decorative per sostituire il feedback didattico.
- **Don't** trasformare corallo e oro del logo in accenti globali senza una decisione esplicita di evoluzione dell'identità.
- **Don't** aggiungere ombre grandi a superfici che possono essere separate con bordo o tono.
- **Don't** usare font decorativi, serif o monospaziati fuori dai ruoli già stabiliti.
