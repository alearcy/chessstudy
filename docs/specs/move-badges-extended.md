# Badge notazione — Classificazione mosse

## Obiettivo
Ogni mossa analizzata mostra un badge di classificazione, stile chess.com semplificato a 5 tier.

## Classificazione

| Simbolo | Nome IT | Colore | Condizione |
|---------|---------|--------|------------|
| ⭐ | Migliore | `rgb(59,130,246)` blu | Mossa giocata = best move Stockfish |
| ✅ | Buona | `rgb(34,197,94)` verde | cpLoss 0–49 |
| ?! | Imprecisa | `rgb(202,138,4)` giallo | cpLoss 50–99 |
| ? | Errore | `rgb(234,88,12)` arancio | cpLoss 100–299 |
| ?? | Errore grave | `rgb(220,38,38)` rosso | cpLoss ≥ 300 |

- cpLoss: differenza eval prima/dopo mossa, POV giocatore che muove
- Valori positivi = perdita (mossa peggiore della best)
- "Migliore" ⭐ ha precedenza su tutte (se mossa coincide con best move, mostra ⭐)
- cpLoss null → nessun badge (dati eval mancanti)

## Priorità badge

1. `⭐` se `isBestMove` (override totale)
2. Altrimenti classifica per cpLoss

## Calcolo cpLoss

- `beforeScore = evalScore(evalCp, evalMate)` (POV Bianco)
- `afterScore = evalScore(evalCp, evalMate)` (POV Bianco)
- Mossa bianca: `cpLoss = beforeScore - afterScore`
- Mossa nera: `cpLoss = afterScore - beforeScore` (nega per POV nero)
- `evalScore`: mate → `±100000 - n`, else cp

## Rilevazione "Migliore"

Per ogni mossa `i`:
- Posizione prima della mossa: eval di `board` (i=0) o `moves[i-1]` (i>0)
- `bestMoveUci` di quella posizione vs mossa giocata (`moves[i].moveNotation` SAN)
- Confronto: conversione UCI→SAN via chess.js (`load` FEN, `move` UCI, leggi SAN)
- Se SAN corrisponde (strippando `+`/`#`) → ⭐

## File

1. **`src/services/analysisService.ts`** — `moveClassification(cpLoss, isBestMove?)` → `MoveBadge | null`
2. **`src/services/explainService.ts`** — `classifySeverity(cpLoss, isBestMove?)` → `Severity` (allineato a 5 tier)
3. **`src/components/board/MoveNotation.tsx`** — `EvalBadge` rendering, `badgeTitles` map
4. **`src/components/board/ChessBoard.tsx`** — board badge rendering
5. **`src/pages/LessonDetailPage.tsx`** — calcolo `moveBadge` con cpLoss POV corretto

## Note

- 5 tier instead of 7: rimossi `!!` (Brillante), `!` (Grande), `!?` (Interessante). Richiederebbero multi-PV + sacrifice detection (3x più lento). 5 tier affidabili basati su cpLoss + isBestMove.
- Soglia `✅` buona `cpLoss < 50` (0.5 pedoni) — generosa, allineata a Lichess "good".
- Soglia `?!` imprecisa 50–99 — stretta, match Lichess inaccuracy.
- Soglia `?` errore 100–299 — match Lichess mistake.
- Soglia `??` blunder `≥ 300` — match Lichess blunder.
