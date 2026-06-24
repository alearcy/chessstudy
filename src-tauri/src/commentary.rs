use crate::llm::LlmEngine;
use anyhow::Result;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CommentaryResult {
    pub summary: String,
    pub details: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CommentaryInput {
    pub fen_before: String,
    pub fen_after: String,
    pub played_san: String,
    pub played_by: String,
    pub white_name: Option<String>,
    pub black_name: Option<String>,
    pub eval_cp: Option<i32>,
    pub eval_mate: Option<i32>,
    pub eval_depth: u32,
    pub after_eval_cp: Option<i32>,
    pub after_eval_mate: Option<i32>,
    pub best_move_san: Option<String>,
}

const SYSTEM_PROMPT: &str = "Sei un insegnante di scacchi italiano. Spieghi le mosse ai principianti.

LINGUA:
- Rispondi SOLO in italiano corretto. Nessun'altra lingua, nessuna parola straniera.
- Presta massima attenzione ai termini scacchistici: usa esattamente il vocabolario qui sotto.

VOCABOLARIO SCACCHISTICO (obbligatorio, esatto):
- pezzo (MAI \"pezza\", MAI \"pedina\" per indicare un pezzo)
- pedone (il soldato di base; NON confonderlo con gli altri pezzi)
- casa (la casella; MAI \"cella\", MAI \"quadro\", MAI \"casella\" è tollerato ma preferisci \"casa\")
- catturare / prendere (NON \"mangiare\" riferito a un pezzo va evitato, usa \"catturare\")
- scacco, scacco matto, matto
- donna, torre, alfiere, cavallo, re
- arrocco, promozione, en passant
- sviluppo, centro, controllo, difesa, attacco, iniziativa, materiale, vantaggio, svantaggio
- forchetta, inchiodatura, infilata, scoperta

NOTAZIONE ITALIANA (obbligatoria):
R=Re, D=Donna, T=Torre, A=Alfiere, C=Cavallo.
Esempi: Cc3, Axf7, Tfe1, 0-0, exd5.
NON scrivere \"Cavallo\" seguito dalla casa (es. NON \"Cavallob4\"), usa \"Cb4\".
NON usare notazione inglese (NON \"Nf3\", NON \"Bxc6\", NON \"Rxe1\").

TERZA PERSONA E NOMI GIOCATORI (obbligatorio):
- Parla SEMPRE in TERZA PERSONA. NON dare del \"tu\" a nessuno, NON usare \"hai\", \"avresti\", \"la tua mossa\".
- Usa il nome del giocatore che trovi nel prompt (es. \"Marco\", \"alearcy\"). Se il nome non è disponibile, usa \"il Bianco\" o \"il Nero\".
- Verbi al passato prossimo per la mossa giocata: \"ha giocato\", \"ha spinto\", \"ha catturato\", \"ha sacrificato\".
- Verbi al condizionale passato per la mossa suggerita: \"avrebbe giocato\", \"avrebbe mantenuto\", \"sarebbe stata\".

DUE MOSSE DISTINTE — struttura obbligatoria:
Quando ti do una \"Mossa giocata\" E una \"Mossa migliore suggerita da Stockfish\",
sono DUE mosse DIVERSE. Non confonderle MAI e non mescolare i loro effetti.

1) La MOSSA GIOCATA è quella che è stata realmente fatta sulla scacchiera dal giocatore.
   Parla all'INDICATIVO passato: \"<Nome> ha giocato X\", \"con X <Nome> ha…\", oppure descrivi cosa fa X.
   Attribuisci a X solo gli effetti che X ha realmente prodotto.

2) La MOSSA SUGGERITA NON è stata giocata: esiste solo come alternativa.
   Parla SEMPRE al CONDIZIONALE: \"con Y <Nome> avrebbe…\", \"Y avrebbe…\", \"<Nome> avrebbe dovuto giocare Y\".
   NON dire MAI che la mossa suggerita \"è stata giocata\", \"gioca\", \"controlla\" (all'indicativo).

REGOLA: se citi un vantaggio, attribuiscilo alla mossa giusta.
Il vantaggio della mossa suggerita va espresso al condizionale e riferito a Y.
Gli effetti reali della posizione vanno riferiti a X all'indicativo.

FORMATO OUTPUT (esattamente così, nient'altro):
Prima riga: [CLASSIFICAZIONE]
Seconda riga: spiegazione di massimo 2-3 frasi.

Se c'è una mossa suggerita DIVERSA da quella giocata, struttura la spiegazione in due parti nette:
- prima una frase sulla mossa giocata (indicativo, inizia con \"<Nome> ha giocato X\" o \"Con X <Nome> ha\");
- poi una frase sulla mossa suggerita (condizionale, inizia con \"Con Y <Nome> avrebbe\" o \"Y avrebbe\").
Usa sempre le lettere della notazione (X e Y) per tenere distinte le due mosse.

Classificazioni: [OTTIMA] [BUONA] [IMPRECISIONE] [ERRORE] [PESSATA]

DIVIETI ASSOLUTI:
- NON aggiungere note, pensieri, ragionamenti o meta-commenti.
- NON scrivere \"Nota:\", \"Correggo\", \"Adatto\", \"Basandomi su\".
- NON spiegare come hai formulato la risposta.
- NON ripetere lo stesso concetto o la stessa frase.
- NON usare il \"tu\": niente \"hai\", \"avresti\", \"tua\". Sempre terza persona con il nome del giocatore.

ESEMPI (supponi Bianco=Marco, Nero=Luca):
[OTTIMA]
Marco ha giocato e4: occupa il centro e apre la diagonale all'Alfiere. Segue i principi di apertura.

[IMPRECISIONE]
Con e3 Marco ha spinto il pedone ma rinuncia a controllare il centro. Con Af4 Marco avrebbe sviluppato l'Alfiere in posizione attiva e messo pressione sulla diagonale.

[PESSATA]
Con Axh7 Marco ha sacrificato l'Alfiere senza compenso e Luca para facilmente, mantenendo il vantaggio di materiale. Con Axh6 Marco avrebbe conservato il pezzo e tenuto la posizione equilibrata.";

pub fn generate(engine: &LlmEngine, input: &CommentaryInput) -> Result<CommentaryResult> {
    let italian_played = san_to_italian(&input.played_san);
    let italian_best = input.best_move_san.as_ref().map(|b| san_to_italian(b));

    let user_prompt = build_user_prompt(input, &italian_played, italian_best.as_deref());
    log::info!("[commentary] invoking LLM for {}", input.played_san);
    let response = engine.prompt(SYSTEM_PROMPT, &user_prompt, 200)?;
    log::info!("[commentary] raw response: {}", &response);

    let (severity, details) = parse_response(&response, &input.played_san);
    let summary = build_summary(&italian_played, &severity);
    log::info!("[commentary] -> severity={} summary={}", severity, summary);

    Ok(CommentaryResult { summary, details, severity })
}

pub fn generate_batch(
    engine: &LlmEngine,
    inputs: &[CommentaryInput],
) -> Result<Vec<CommentaryResult>> {
    inputs.iter().map(|inp| generate(engine, inp)).collect()
}

fn build_user_prompt(input: &CommentaryInput, played_san: &str, best_move_san: Option<&str>) -> String {
    let eval_before = format_eval(input.eval_cp, input.eval_mate);
    let eval_after = format_eval(input.after_eval_cp, input.after_eval_mate);

    // Nomi dei giocatori: preferisci il nome PGN, fallback a "il Bianco"/"il Nero".
    let white = input.white_name.as_deref().filter(|s| !s.is_empty()).unwrap_or("il Bianco");
    let black = input.black_name.as_deref().filter(|s| !s.is_empty()).unwrap_or("il Nero");
    let player = if input.played_by == "w" { white } else { black };

    let mut prompt = format!(
        "Posizione prima (FEN): {}\n\
         Posizione dopo (FEN): {}\n\
         Eval prima: {}\n\
         Eval dopo: {}\n\
         Giocatore Bianco: {}\n\
         Giocatore Nero: {}\n\
         Mossa giocata da {}: {}\n",
        input.fen_before, input.fen_after, eval_before, eval_after, white, black, player, played_san,
    );

    if let Some(best) = best_move_san {
        if best == played_san {
            prompt.push_str(&format!(
                "Mossa migliore suggerita da Stockfish: (nessuna alternativa — {} ha giocato la mossa migliore)\n",
                player
            ));
        } else {
            prompt.push_str(&format!(
                "Mossa migliore suggerita da Stockfish: {}  (NON è stata giocata: è l'alternativa che {} avrebbe potuto giocare, da commentare al condizionale)\n",
                best, player
            ));
        }
    } else {
        prompt.push_str("Mossa migliore suggerita da Stockfish: (non disponibile)\n");
    }

    prompt.push_str(&format!(
        "\nSpiega la mossa giocata nel formato indicato. Parla in terza persona usando il nome del giocatore ({}). Ricorda: due mosse distinte, indicativo per la mossa giocata, condizionale per quella suggerita.",
        player
    ));
    prompt
}

/// Converte una mossa in notazione SAN inglese (chess.js / Stockfish: K,Q,R,B,N)
/// nella notazione italiana (R,D,T,A,C).
///
/// Mappatura: K→R (Re), Q→D (Donna), R→T (Torre), B→A (Alfiere), N→C (Cavallo).
/// Le mosse di pedone (iniziano con a-h minuscolo) e le catture `x`, `+`, `#` restano
/// invariate. L'arrocco O-O/O-O-O viene normalizzato a 0-0/0-0-0. La promozione
/// `=Q` diventa `=D`, ecc.
fn san_to_italian(san: &str) -> String {
    fn map_piece(c: char) -> char {
        match c {
            'K' => 'R',
            'Q' => 'D',
            'R' => 'T',
            'B' => 'A',
            'N' => 'C',
            other => other,
        }
    }

    let bytes = san.as_bytes();
    let mut out = String::with_capacity(san.len());
    let mut i = 0;

    // Primo carattere: se è una lettera di pezzo inglese, convertila.
    if let Some(&b0) = bytes.first() {
        let c0 = b0 as char;
        if "KQRBN".contains(c0) {
            out.push(map_piece(c0));
            i = 1;
        }
    }

    // Resto: gestisce promozione `=X` e normalizza l'arrocco O → 0.
    while i < bytes.len() {
        let c = bytes[i] as char;
        if c == '=' && i + 1 < bytes.len() {
            out.push('=');
            out.push(map_piece(bytes[i + 1] as char));
            i += 2;
            continue;
        }
        if c == 'O' {
            out.push('0');
        } else {
            out.push(c);
        }
        i += 1;
    }

    out
}

fn format_eval(cp: Option<i32>, mate: Option<i32>) -> String {
    if let Some(m) = mate {
        if m > 0 {
            format!("Matto in {} per il Bianco", m)
        } else {
            format!("Matto in {} per il Nero", m.abs())
        }
    } else if let Some(c) = cp {
        let pawns = c as f64 / 100.0;
        if c >= 0 {
            format!("+{:.1} (Bianco)", pawns)
        } else {
            format!("{:.1} (Nero)", pawns.abs())
        }
    } else {
        "N/D".to_string()
    }
}

fn parse_response(response: &str, _played_san: &str) -> (String, String) {
    let cleaned = response.trim();

    let severity = if cleaned.contains("[PESSATA]") {
        "blunder"
    } else if cleaned.contains("[ERRORE]") {
        "mistake"
    } else if cleaned.contains("[IMPRECISIONE]") {
        "inaccuracy"
    } else if cleaned.contains("[BUONA]") {
        "good"
    } else if cleaned.contains("[OTTIMA]") {
        "best"
    } else {
        "good"
    };

    // Pulisci tag e meta-commenti, rimuovi righe duplicate.
    let mut seen = std::collections::HashSet::new();
    let details = cleaned
        .replace("[PESSATA]", "")
        .replace("[ERRORE]", "")
        .replace("[IMPRECISIONE]", "")
        .replace("[BUONA]", "")
        .replace("[OTTIMA]", "")
        // NOTE: non rimuoviamo la notazione della mossa giocata dal testo:
        // tenere visibili sia la mossa giocata (X) sia quella suggerita (Y) è
        // ciò che rende chiara la distinzione tra le due mosse.
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|t| {
            !t.is_empty()
                && !t.starts_with('*')
                && !t.starts_with("Nota:")
                && !t.starts_with("Correggo")
                && !t.starts_with("Adatto")
                && !t.starts_with("Basandomi")
        })
        .filter(|t| seen.insert(t.clone()))
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string();

    (severity.to_string(), details)
}

fn build_summary(played_san: &str, severity: &str) -> String {
    let (symbol, label) = match severity {
        "blunder" => ("??", "Errore grave!"),
        "mistake" => ("?", "Errore"),
        "inaccuracy" => ("?!", "Imprecisione"),
        "best" => ("⭐", "Mossa eccellente"),
        _ => ("✅", "Buona mossa"),
    };
    format!("{} {} — {}", symbol, played_san, label)
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_dedup() {
        let (sev, det) = parse_response(
            "[ERRORE]\nLa mossa perde un pezzo.\nLa mossa perde un pezzo.\n*Nota: adattato*",
            "cxb5",
        );
        assert_eq!(sev, "mistake");
        assert_eq!(det, "La mossa perde un pezzo.");
    }

    #[test]
    fn test_san_to_italian_pieces() {
        // Lettere pezzo: K→R, Q→D, R→T, B→A, N→C
        assert_eq!(san_to_italian("Nf3"), "Cf3");
        assert_eq!(san_to_italian("Bxf7"), "Axf7");
        assert_eq!(san_to_italian("Rxe1"), "Txe1");
        assert_eq!(san_to_italian("Kg1"), "Rg1");
        assert_eq!(san_to_italian("Qd5"), "Dd5");
    }

    #[test]
    fn test_san_to_italian_pawn_and_castling() {
        // Mosse di pedone: invariate.
        assert_eq!(san_to_italian("e4"), "e4");
        assert_eq!(san_to_italian("exd5"), "exd5");
        // Arrocco: O → 0.
        assert_eq!(san_to_italian("O-O"), "0-0");
        assert_eq!(san_to_italian("O-O-O"), "0-0-0");
    }

    #[test]
    fn test_san_to_italian_promotion() {
        // Promozione: =Q → =D, =R → =T, =N → =C.
        assert_eq!(san_to_italian("e8=Q"), "e8=D");
        assert_eq!(san_to_italian("a1=R"), "a1=T");
        assert_eq!(san_to_italian("b8=N"), "b8=C");
    }

    #[test]
    fn test_san_to_italian_check_and_mate() {
        // Scacco (+) e scacco matto (#) invariati.
        assert_eq!(san_to_italian("Qh5+"), "Dh5+");
        assert_eq!(san_to_italian("Qxf7#"), "Dxf7#");
    }
}