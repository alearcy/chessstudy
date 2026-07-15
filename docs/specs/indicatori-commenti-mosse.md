# UI-003: Indicatori dei commenti nella notazione mosse

## Obiettivo

Mostrare l'icona del messaggio solo quando aggiunge informazione utile.

## Comportamento

- In modalità `analysis` l'icona non viene mostrata: i commenti automatici
  accompagnano sistematicamente le mosse e l'indicatore sarebbe ridondante.
- In modalità `study` l'icona viene mostrata soltanto quando `Move.comment`
  contiene una nota scritta dall'utente.
- `stockfishComment` e `analysisComment` non attivano mai l'icona nello Studio.

`MoveNotation` riceve una prop esplicita per abilitare gli indicatori delle note
utente. Il default è disabilitato; `LessonDetailPage` la abilita soltanto nel
percorso Studio.

## Verifica

- Test componente: nessuna icona con soli commenti automatici.
- Test componente: icona visibile nello Studio soltanto sulla mossa con
  `comment` non vuoto.
- Suite completa e build.

