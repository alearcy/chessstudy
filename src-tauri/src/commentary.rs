use crate::llm::LocalLlmClient;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct CommentaryResult {
    pub summary: String,
    pub details: String,
    pub severity: String,
}

#[cfg(test)]
#[test]
fn lossy_game_analysis_keeps_all_comments_and_fills_missing() {
    let input = GameAnalysisInput {
        white_name: "Bianco".to_string(),
        black_name: "Nero".to_string(),
        result: Some("1-0".to_string()),
        key_swings: vec![],
        moves: vec![
            test_game_analysis_move(0, 1, "Bianco", "e4", "BUONA"),
            test_game_analysis_move(1, 1, "Nero", "e5", "ERRORE"),
            test_game_analysis_move(2, 2, "Bianco", "Cf3", "ERRORE GRAVE"),
        ],
    };
    let value = serde_json::json!({
        "panoramica": "Panoramica LLM",
        "giudizio": "Giudizio LLM",
        "momentiChiave": [
            { "indice": 0, "commento": "Non va tenuto" },
            { "indice": 1, "commento": "Commento LLM valido" },
            { "indice": 2, "commento": "" }
        ]
    });

    let result = parse_game_analysis_json_lossy(&value, &input);

    assert_eq!(result.overview, "Panoramica LLM");
    assert_eq!(result.judgment, "Giudizio LLM");
    assert_eq!(result.move_comments.len(), 3);
    assert_eq!(result.move_comments[0].index, 0);
    assert_eq!(result.move_comments[0].comment, "Non va tenuto");
    assert_eq!(result.move_comments[1].index, 1);
    assert_eq!(result.move_comments[1].comment, "Commento LLM valido");
    assert_eq!(result.move_comments[2].index, 2);
    assert!(result.move_comments[2].comment.contains("Stockfish"));
}

#[cfg(test)]
fn test_game_analysis_move(
    index: u32,
    move_number: u32,
    player: &str,
    san_italian: &str,
    classification: &str,
) -> GameAnalysisMove {
    GameAnalysisMove {
        move_number,
        index,
        fen_before: "startpos".to_string(),
        fen_after: "startpos".to_string(),
        san_italian: san_italian.to_string(),
        player: player.to_string(),
        eval_before: "+0.2".to_string(),
        eval_after: "-1.4".to_string(),
        eval_before_cp: Some(20),
        eval_after_cp: Some(-140),
        eval_drop_cp: 160,
        classification: classification.to_string(),
        best_san_italian: Some("Cf6".to_string()),
        best_move_lan: Some("g8f6".to_string()),
        stockfish_comment: Some("Stockfish suggeriva Cf6.".to_string()),
        diagnosis: Some(MoveDiagnosis {
            r#type: "generic_eval_loss".to_string(),
            confidence: 0.4,
            facts: vec![
                format!("La mossa giocata e' {}.", san_italian),
                "La continuazione piu precisa era Cf6.".to_string(),
                "La mossa peggiora in modo importante la posizione.".to_string(),
            ],
            principle: "Controlla catture, scacchi e minacce immediate.".to_string(),
            must_mention: vec!["Cf6".to_string()],
        }),
    }
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

pub fn generate(client: &LocalLlmClient, input: &CommentaryInput) -> Result<CommentaryResult> {
    let italian_played = san_to_italian(&input.played_san);
    let italian_best = input.best_move_san.as_ref().map(|b| san_to_italian(b));

    let user_prompt = build_user_prompt(input, &italian_played, italian_best.as_deref());
    log::info!("[commentary] invoking LLM for {}", input.played_san);
    let response = client.prompt(SYSTEM_PROMPT, &user_prompt, 200, 0.3)?;
    log::info!("[commentary] raw response: {}", &response);

    let (severity, details) = parse_response(&response, &input.played_san);
    let summary = build_summary(&italian_played, &severity);
    log::info!("[commentary] -> severity={} summary={}", severity, summary);

    Ok(CommentaryResult {
        summary,
        details,
        severity,
    })
}

pub fn generate_batch(
    client: &LocalLlmClient,
    inputs: &[CommentaryInput],
) -> Result<Vec<CommentaryResult>> {
    let mut results = Vec::with_capacity(inputs.len());
    for inp in inputs {
        results.push(generate(client, inp)?);
    }
    Ok(results)
}

// ============================================================================
// Game analysis (one-shot)
// ============================================================================

#[allow(dead_code)]
const GAME_ANALYSIS_SYSTEM_PROMPT: &str = "Sei un Grande Maestro di scacchi italiano con decenni di esperienza. Analizzi partite complete e offri commenti strategici di alto livello, accessibili anche a giocatori intermedi.

RUOLO:
- Analizzi l'intera partita combinando la cronaca delle mosse (PGN) con l'analisi del motore scacchistico Stockfish.
- Identifichi i momenti decisivi, gli errori strategici e tattici, le occasioni mancate.
- Per ogni errore, spieghi COSA è successo, PERCHÉ Stockfish lo considera un errore in parole semplici, e quale mossa alternativa Stockfish avrebbe suggerito.
- Spieghi i piani dei giocatori e come si sono evoluti durante la partita.
- Dai un giudizio complessivo sulla qualità del gioco e sulle lezioni da imparare.

REGOLA FONDAMENTALE (non violarla mai):
- Il risultato della partita e i nomi dei giocatori sono indicati esattamente all'inizio del prompt (Bianco=Nome, Nero=Nome, Risultato). Basati SOLO su quei dati.
- Se il risultato è \"1-0\", ha vinto il Bianco. Se è \"0-1\", ha vinto il Nero. Se è \"1/2-1/2\", è patta.
- NON inventare un risultato diverso da quello indicato.
- Le valutazioni numeriche sono dal punto di vista del Bianco: + significa vantaggio Bianco, - significa vantaggio Nero.

LINGUA:
- Rispondi SOLO in italiano corretto.
- Usa esattamente il vocabolario scacchistico italiano: pezzo, pedone, casa, donna, torre, alfiere, cavallo, re, catturare, scacco, matto, arrocco, promozione, sviluppo, centro, iniziativa.
- MAI usare \"pedina\" per indicare un pezzo che non sia un pedone.

NOTAZIONE ITALIANA (obbligatoria):
R=Re, D=Donna, T=Torre, A=Alfiere, C=Cavallo. Esempi: Cc3, Axf7, 0-0, exd5.

TERZA PERSONA (obbligatorio):
- Usa SEMPRE la terza persona con i nomi dei giocatori.
- MAI dare del \"tu\": niente \"hai\", \"avresti\", \"la tua mossa\".

CITAZIONE MOSSE:
- Le mosse giocate vanno citate in notazione italiana, testo normale (NO link markdown, NO parentesi quadre). Esempio: Axf7, e4, 0-0.
- Le mosse suggerite da Stockfish (NON giocate) vanno in *corsivo*: *Ac4*.
- NON usare MAI link markdown per le mosse. NON usare la sintassi `[testo](#move-...)`.

OUTPUT: un SOLO oggetto JSON valido (nessun testo fuori dal JSON). Schema:

{
  \"panoramica\": \"<markdown: apertura, struttura pedonale, piani strategici>\",
  \"giudizio\": \"<markdown: valutazione finale e lezioni da imparare>\",
  \"momentiChiave\": [
    { \"indice\": <int 0-based = [IDX] della mossa GIOCATa a cui si riferisce il commento>, \"commento\": \"<markdown: cosa è successo, perché, cosa si sarebbe dovuto giocare>\" }
  ]
}

REGOLE momentiChiave:
- Includi SOLO mosse con classificazione ERRORE o ERRORE GRAVE. NON commentare OTTIMA, BUONA o IMPRECISIONE.
- Se nella partita non ci sono mosse ERRORE o ERRORE GRAVE, usa \"momentiChiave\": [].
- `indice` DEVE essere un indice [IDX] presente nell'elenco mosse e DEVE riferirsi alla mossa GIOCATa.
- Se il commento riguarda una mossa suggerita da Stockfish (NON giocata), il commento va comunque sulla mossa GIOCATa di quel turno (il suggerimento è un'alternativa, si commenta nel contesto della posizione).
- Ogni commento deve spiegare PERCHE' Stockfish considera quella mossa un errore: perdita di valutazione, mossa alternativa, debolezza tattica nata (inchiodatura, forchetta, pezzo sospeso, re esposto, casa debole) o piano strategico mancato.
- Se il prompt contiene \"Commento Stockfish\", usa quelle tattiche concrete come base del commento. Non sostituirle con frasi generiche.
- Usa il PGN e la sequenza della partita per ampliare il commento quando il contesto chiarisce una tattica o una strategia mancata.
- Usa **grassetto** per concetti chiave e giocatori, - per elenchi puntati.
- Sii denso e sintetico.

DIVIETI ASSOLUTI:
- NON aggiungere meta-commenti o spiegare come hai formulato la risposta.
- NON ripetere lo stesso concetto più volte.
- NON essere prolisso: sii denso e informativo.
- NON usare il \"tu\" in nessuna forma.
- NON usare notazione inglese (Nf3, Bxc6).
- NON citare mosse suggerite da Stockfish senza *corsivo*.
- NON usare link markdown per le mosse.
- NON usare formule vaghe come \"probabilmente\", \"debolezza strutturale\" o \"non era la piu' corretta\" se non spieghi la tattica o il piano preciso.
- NON produrre testo fuori dal JSON.";
const COMPACT_GAME_ANALYSIS_SYSTEM_PROMPT: &str = "Sei un coach di scacchi per principianti.

Devi generare un'analisi in italiano semplice usando SOLO i dati forniti.
Non devi analizzare la posizione autonomamente.
Non devi inventare varianti.
Usa i facts dentro diagnosis: sono gia' la diagnosi scacchistica.

Non devi usare frasi generiche come:
- \"hai indebolito la posizione\"
- \"hai perso iniziativa\"
- \"mossa poco precisa\"
- \"la posizione peggiora\"
- \"il tuo avversario ottiene gioco\"

Non parlare mai di centipawn, eval, punteggi numerici o valori tipo +1.2/-0.8.
Un principiante non conosce questi dati: traduci sempre la valutazione in parole semplici
come \"peggiora molto\", \"peggiora in modo importante\" o \"La continuazione piu precisa era ...\".

Per ogni momento chiave:
- spiega l'errore concreto;
- cita almeno un pezzo, una casa, una minaccia o una mossa concreta;
- usa diagnosis.facts e diagnosis.principle;
- dai una regola pratica per il futuro;
- massimo 80 parole.

Restituisci solo JSON valido:
{
  \"panoramica\": \"stringa breve, massimo 80 parole\",
  \"giudizio\": \"stringa breve, massimo 50 parole\",
  \"momentiChiave\": [
    {
      \"index\": 0,
      \"titolo\": \"stringa breve\",
      \"spiegazione\": \"stringa massimo 80 parole\",
      \"consiglio\": \"stringa breve\"
    }
  ]
}

Regole:
- momentiChiave deve contenere una voce per ogni criticalMoves ricevuta;
- ogni voce deve usare lo stesso index della mossa critica;
- non aggiungere mosse non presenti nei dati;
- non nominare FEN;
- non nominare centipawn, eval o valori numerici della valutazione;
- non usare Markdown;
- restituisci solo JSON puro.";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MoveDiagnosis {
    pub r#type: String,
    pub confidence: f32,
    pub facts: Vec<String>,
    pub principle: String,
    pub must_mention: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GameAnalysisMove {
    pub move_number: u32,
    pub index: u32,
    pub fen_before: String,
    pub fen_after: String,
    pub san_italian: String,
    pub player: String,
    pub eval_before: String,
    pub eval_after: String,
    pub eval_before_cp: Option<i32>,
    pub eval_after_cp: Option<i32>,
    pub eval_drop_cp: i32,
    pub classification: String,
    pub best_san_italian: Option<String>,
    pub best_move_lan: Option<String>,
    pub stockfish_comment: Option<String>,
    pub diagnosis: Option<MoveDiagnosis>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct GameAnalysisInput {
    pub white_name: String,
    pub black_name: String,
    pub result: Option<String>,
    pub moves: Vec<GameAnalysisMove>,
    pub key_swings: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameAnalysisMoveComment {
    pub index: u32,
    pub comment: String,
    pub source: String,
}

/// Risultato strutturato dell'analisi partita.
/// `overview` + `judgment` finiscono in `Board.gameAnalysis` (concatenati);
/// `move_comments` vengono distribuiti sui `Move.aiComment` correlati.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameAnalysisResult {
    pub overview: String,
    pub judgment: String,
    pub move_comments: Vec<GameAnalysisMoveComment>,
    pub source: String,
    pub raw_llm_output: Option<serde_json::Value>,
}

pub fn analyze_game(
    client: &LocalLlmClient,
    input: &GameAnalysisInput,
) -> Result<GameAnalysisResult> {
    let user_prompt = build_compact_game_analysis_prompt(input);
    log::info!(
        "[commentary] invoking game analysis LLM ({} moves)",
        input.moves.len()
    );
    let value = match client.prompt_json(
        COMPACT_GAME_ANALYSIS_SYSTEM_PROMPT,
        &user_prompt,
        game_analysis_max_tokens(input),
        0.15,
    ) {
        Ok(value) => value,
        Err(error) => {
            log::warn!(
                "[commentary] game analysis JSON failed, using Stockfish fallback: {}",
                error
            );
            return Ok(build_stockfish_game_analysis_fallback(input));
        }
    };
    log::info!("[commentary] game analysis json parsed");
    let result = parse_game_analysis_json_lossy(&value, input);
    Ok(GameAnalysisResult {
        overview: result.overview,
        judgment: result.judgment,
        move_comments: result.move_comments,
        source: result.source,
        raw_llm_output: Some(value),
    })
}

/// Parsa il JSON restituito dal LLM in `GameAnalysisResult`.
/// Tollerante sui tipi (es. indice come stringa) ma rigoroso sulle chiavi.
fn parse_game_analysis_json_lossy(
    value: &serde_json::Value,
    input: &GameAnalysisInput,
) -> GameAnalysisResult {
    let fallback = build_stockfish_game_analysis_fallback(input);
    let overview = json_string(value, "panoramica")
        .or_else(|| json_string(value, "overview"))
        .filter(|text| !text.trim().is_empty())
        .unwrap_or_else(|| fallback.overview.clone());
    let judgment = json_string(value, "giudizio")
        .or_else(|| json_string(value, "judgment"))
        .filter(|text| !text.trim().is_empty())
        .unwrap_or_else(|| fallback.judgment.clone());

    let mut move_comments = value
        .get("momentiChiave")
        .or_else(|| value.get("moveComments"))
        .and_then(|items| items.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(parse_game_analysis_move_comment_lossy)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    move_comments = move_comments
        .into_iter()
        .map(|comment| {
            if contains_banned_generic_phrase(&comment.comment) {
                fallback_comment_for_index(input, comment.index).unwrap_or(comment)
            } else {
                comment
            }
        })
        .collect();
    let mut covered_indexes = move_comments
        .iter()
        .map(|comment| comment.index)
        .collect::<Vec<_>>();

    for comment in fallback.move_comments {
        if !covered_indexes.contains(&comment.index) {
            covered_indexes.push(comment.index);
            move_comments.push(comment);
        }
    }

    move_comments.sort_by_key(|comment| comment.index);

    GameAnalysisResult {
        overview,
        judgment,
        move_comments,
        source: "llm".to_string(),
        raw_llm_output: Some(value.clone()),
    }
}

fn fallback_comment_for_index(
    input: &GameAnalysisInput,
    index: u32,
) -> Option<GameAnalysisMoveComment> {
    input
        .moves
        .iter()
        .find(|m| m.index == index)
        .and_then(build_stockfish_move_comment)
}

fn parse_game_analysis_move_comment_lossy(
    item: &serde_json::Value,
) -> Option<GameAnalysisMoveComment> {
    let index = item
        .get("indice")
        .or_else(|| item.get("index"))
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_str().and_then(|text| text.parse::<u64>().ok()))
        })? as u32;
    let comment = json_string(item, "commento")
        .or_else(|| json_string(item, "comment"))
        .or_else(|| {
            let explanation = json_string(item, "spiegazione")?;
            let advice = json_string(item, "consiglio").unwrap_or_default();
            let title = json_string(item, "titolo").unwrap_or_default();
            Some(
                [title, explanation, advice]
                    .into_iter()
                    .filter(|part| !part.trim().is_empty())
                    .collect::<Vec<_>>()
                    .join(" "),
            )
        })?;
    let comment = comment.trim().to_string();
    if comment.is_empty() {
        return None;
    }

    Some(GameAnalysisMoveComment {
        index,
        comment,
        source: "llm".to_string(),
    })
}

fn json_string(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

const BANNED_GENERIC_PHRASES: &[&str] = &[
    "hai indebolito la posizione",
    "indebolisce la posizione",
    "perdi iniziativa",
    "perde iniziativa",
    "mossa poco precisa",
    "la posizione peggiora",
];

fn contains_banned_generic_phrase(text: &str) -> bool {
    let lower = text.to_lowercase();
    BANNED_GENERIC_PHRASES
        .iter()
        .any(|phrase| lower.contains(phrase))
}

#[allow(dead_code)]
fn parse_game_analysis_json(value: &serde_json::Value) -> Result<GameAnalysisResult> {
    let overview = value
        .get("panoramica")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let judgment = value
        .get("giudizio")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();

    let mut move_comments = Vec::new();
    if let Some(arr) = value.get("momentiChiave").and_then(|v| v.as_array()) {
        for entry in arr {
            let index = entry
                .get("indice")
                .and_then(|v| v.as_u64())
                .or_else(|| {
                    entry
                        .get("indice")
                        .and_then(|v| v.as_str())
                        .and_then(|s| s.parse::<u64>().ok())
                })
                .unwrap_or(0) as u32;
            let comment = entry
                .get("commento")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if !comment.is_empty() {
                move_comments.push(GameAnalysisMoveComment {
                    index,
                    comment,
                    source: "llm".to_string(),
                });
            }
        }
    }

    Ok(GameAnalysisResult {
        overview,
        judgment,
        move_comments,
        source: "llm".to_string(),
        raw_llm_output: Some(value.clone()),
    })
}

fn build_compact_game_analysis_prompt(input: &GameAnalysisInput) -> String {
    let critical_moves = critical_game_analysis_moves(input);
    let payload = serde_json::json!({
        "players": {
            "white": input.white_name,
            "black": input.black_name,
        },
        "result": input.result.as_deref().unwrap_or("non indicato"),
        "criticalMoves": critical_moves
            .iter()
            .map(|m| {
                serde_json::json!({
                    "index": m.index,
                    "moveNumber": m.move_number,
                    "player": m.player,
                    "san": m.san_italian,
                    "classification": m.classification,
                    "bestSan": m.best_san_italian,
                    "diagnosis": m.diagnosis,
                })
            })
            .collect::<Vec<_>>(),
    });

    format!(
        "Analizza questa partita per un giocatore principiante.\n\nDati partita:\n{}\n\nFormato obbligatorio: JSON puro con panoramica, giudizio, momentiChiave. momentiChiave deve contenere una voce per ogni criticalMoves ricevuta e usare lo stesso index.",
        payload
    )
}

fn critical_game_analysis_moves(input: &GameAnalysisInput) -> Vec<&GameAnalysisMove> {
    let mut critical = input
        .moves
        .iter()
        .filter(|m| is_error_classification(&m.classification))
        .collect::<Vec<_>>();
    critical.sort_by(|a, b| b.eval_drop_cp.cmp(&a.eval_drop_cp));
    critical.truncate(5);
    critical.sort_by_key(|m| m.index);
    critical
}

fn game_analysis_max_tokens(input: &GameAnalysisInput) -> u32 {
    let critical_count = critical_game_analysis_moves(input).len() as u32;
    (420 + critical_count.saturating_mul(60)).min(700)
}

#[allow(dead_code)]
fn build_game_analysis_prompt(input: &GameAnalysisInput) -> String {
    let mut p = format!(
        "Analizza questa partita:\n\nBianco: {}\nNero: {}\n",
        input.white_name, input.black_name
    );
    if let Some(ref r) = input.result {
        let winner = match r.as_str() {
            "1-0" => format!("{} (Bianco) ha vinto", input.white_name),
            "0-1" => format!("{} (Nero) ha vinto", input.black_name),
            "1/2-1/2" => "Patta".to_string(),
            _ => format!("Risultato: {}", r),
        };
        p.push_str(&format!("Risultato: {} — {}\n", r, winner));
    }
    p.push_str(&format!("\nPGN: {}\n", build_pgn_line(&input.moves)));
    p.push_str("\nMosse (con analisi Stockfish):\n");
    p.push_str("(Valutazione: + vantaggio Bianco, - vantaggio Nero. [IDX] = indice 0-based della mossa, per riferire il commento in momentiChiave)\n\n");
    for m in &input.moves {
        let best = m
            .best_san_italian
            .as_ref()
            .map(|b| format!(" → Stockfish suggeriva {}", b))
            .unwrap_or_default();
        let stockfish_comment = format_stockfish_comment(m.stockfish_comment.as_deref());
        p.push_str(&format!(
            "[{}] {}. {}: {} ({}→{}) {}{}{}\n",
            m.index,
            m.move_number,
            m.player,
            m.san_italian,
            m.eval_before,
            m.eval_after,
            m.classification,
            best,
            stockfish_comment
        ));
    }
    if !input.key_swings.is_empty() {
        p.push_str("\nPrincipali cambi di valutazione:\n");
        for s in &input.key_swings {
            p.push_str(&format!("- {}\n", s));
        }
    }
    p.push_str("\nMosse commentabili in momentiChiave (SOLO queste, perche' Stockfish le classifica ERRORE o ERRORE GRAVE):\n");
    let mut has_commentable = false;
    for m in input
        .moves
        .iter()
        .filter(|m| is_error_classification(&m.classification))
    {
        has_commentable = true;
        let best = m
            .best_san_italian
            .as_ref()
            .map(|b| format!(" Stockfish suggeriva *{}*.", b))
            .unwrap_or_default();
        let stockfish_comment = format_stockfish_comment(m.stockfish_comment.as_deref());
        p.push_str(&format!(
            "- [{}] {}. {}: {} ({} -> {}) {}.{}{} Commenta il perche' usando tattiche concrete, prima di tutto quelle del Commento Stockfish.\n",
            m.index,
            m.move_number,
            m.player,
            m.san_italian,
            m.eval_before,
            m.eval_after,
            m.classification,
            best,
            stockfish_comment
        ));
    }
    if !has_commentable {
        p.push_str("- Nessuna. Usa \"momentiChiave\": [].\n");
    }
    p.push_str("\nProduci un oggetto JSON valido con chiavi \"panoramica\", \"giudizio\", \"momentiChiave\". Per \"momentiChiave\" usa SOLO gli indici elencati in \"Mosse commentabili\". Ogni commento deve spiegare dove Stockfish indica l'errore, PERCHE' e quale alternativa (in *corsivo*) avrebbe evitato il problema. Se c'e' un Commento Stockfish, devi trasformare quelle righe in spiegazione didattica concreta: quale pezzo inchioda, quale pezzo e' inchiodato, contro quale pezzo/re, e perche' questo nasce dalla mossa giocata. Puoi ampliare con tattiche o strategia dedotte dal PGN e dai dati Stockfish, ma non inventare mosse non supportate dai dati.");
    p
}

fn format_stockfish_comment(comment: Option<&str>) -> String {
    let Some(comment) = comment.map(str::trim).filter(|comment| !comment.is_empty()) else {
        return String::new();
    };
    let sanitized = comment
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ");
    format!(" Commento Stockfish: {}", sanitized)
}

fn build_pgn_line(moves: &[GameAnalysisMove]) -> String {
    if moves.is_empty() {
        return "(nessuna mossa)".to_string();
    }

    let mut pgn = Vec::new();
    for (i, m) in moves.iter().enumerate() {
        if i % 2 == 0 {
            pgn.push(format!("{}. {}", m.move_number, m.san_italian));
        } else {
            pgn.push(m.san_italian.clone());
        }
    }
    pgn.join(" ")
}

fn is_error_classification(classification: &str) -> bool {
    matches!(classification.trim(), "ERRORE" | "ERRORE GRAVE")
}

pub fn build_stockfish_game_analysis_fallback(input: &GameAnalysisInput) -> GameAnalysisResult {
    let move_comments = input
        .moves
        .iter()
        .filter_map(build_stockfish_move_comment)
        .collect::<Vec<_>>();
    let judgment = if move_comments.is_empty() {
        "Stockfish non ha marcato mosse come ERRORE o ERRORE GRAVE.".to_string()
    } else {
        "I commenti evidenziano solo mosse classificate da Stockfish come ERRORE o ERRORE GRAVE."
            .to_string()
    };

    GameAnalysisResult {
        overview: "Analisi generata dai dati Stockfish disponibili.".to_string(),
        judgment,
        move_comments,
        source: "fallback".to_string(),
        raw_llm_output: None,
    }
}

fn build_stockfish_move_comment(m: &GameAnalysisMove) -> Option<GameAnalysisMoveComment> {
    if let Some(diagnosis) = &m.diagnosis {
        let facts = diagnosis
            .facts
            .iter()
            .map(String::as_str)
            .filter(|fact| !fact.trim().is_empty())
            .take(3)
            .collect::<Vec<_>>();
        if !facts.is_empty() {
            let text = format!(
                "{} Regola pratica: {}",
                facts.join(" "),
                diagnosis.principle
            );
            return Some(GameAnalysisMoveComment {
                index: m.index,
                comment: text,
                source: "diagnosis_fallback".to_string(),
            });
        }
    }

    let comment = m.stockfish_comment.as_deref()?.trim();
    if comment.is_empty() {
        return None;
    }
    let best = m
        .best_san_italian
        .as_ref()
        .map(|best| {
            format!(
                " Stockfish suggeriva *{}* per evitare questo problema.",
                best
            )
        })
        .unwrap_or_default();
    let tactics = clean_stockfish_comment(comment);
    let text = format!(
        "Con {} **{}** ha peggiorato la posizione: per questo la mossa e' classificata come {}.{} Il motivo tattico concreto e': {}",
        m.san_italian,
        m.player,
        m.classification,
        best,
        tactics
    );

    Some(GameAnalysisMoveComment {
        index: m.index,
        comment: text,
        source: "stockfish_fallback".to_string(),
    })
}

fn clean_stockfish_comment(comment: &str) -> String {
    comment
        .lines()
        .map(|line| line.trim().trim_start_matches('•').trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("; ")
}

/// Versione pubblica del traduttore SAN per l'uso da commands.rs.
pub fn san_to_italian_public(san: &str) -> String {
    san_to_italian(san)
}

fn build_user_prompt(
    input: &CommentaryInput,
    played_san: &str,
    best_move_san: Option<&str>,
) -> String {
    let eval_before = format_eval(input.eval_cp, input.eval_mate);
    let eval_after = format_eval(input.after_eval_cp, input.after_eval_mate);

    // Nomi dei giocatori: preferisci il nome PGN, fallback a "il Bianco"/"il Nero".
    let white = input
        .white_name
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("il Bianco");
    let black = input
        .black_name
        .as_deref()
        .filter(|s| !s.is_empty())
        .unwrap_or("il Nero");
    let player = if input.played_by == "w" { white } else { black };

    let mut prompt = format!(
        "Posizione prima (FEN): {}\n\
         Posizione dopo (FEN): {}\n\
         Eval prima: {}\n\
         Eval dopo: {}\n\
         Giocatore Bianco: {}\n\
         Giocatore Nero: {}\n\
         Mossa giocata da {}: {}\n",
        input.fen_before,
        input.fen_after,
        eval_before,
        eval_after,
        white,
        black,
        player,
        played_san,
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

    #[test]
    fn test_stockfish_fallback_uses_concrete_tactics() {
        let input = GameAnalysisInput {
            white_name: "Bianco".to_string(),
            black_name: "Nero".to_string(),
            result: None,
            moves: vec![
                test_game_move(0, "e4", "BUONA"),
                test_game_move(1, "e5", "ERRORE"),
            ],
            key_swings: vec![],
        };

        let result = build_stockfish_game_analysis_fallback(&input);

        assert_eq!(result.move_comments.len(), 2);
        assert_eq!(result.move_comments[0].index, 0);
        assert_eq!(result.move_comments[1].index, 1);
        assert!(result.move_comments[1].comment.contains("inchioda"));
        assert!(!result.move_comments[1].comment.contains("probabilmente"));
    }

    fn test_game_move(index: u32, san: &str, classification: &str) -> GameAnalysisMove {
        GameAnalysisMove {
            move_number: index / 2 + 1,
            index,
            fen_before: "startpos".to_string(),
            fen_after: "startpos".to_string(),
            san_italian: san.to_string(),
            player: if index % 2 == 0 { "Bianco" } else { "Nero" }.to_string(),
            eval_before: "+0.2 (Bianco)".to_string(),
            eval_after: "-1.4 (Nero)".to_string(),
            eval_before_cp: Some(20),
            eval_after_cp: Some(-140),
            eval_drop_cp: 160,
            classification: classification.to_string(),
            best_san_italian: Some("Cf3".to_string()),
            best_move_lan: Some("g1f3".to_string()),
            stockfish_comment: Some("• ♝ inchioda ♟ contro ♞.".to_string()),
            diagnosis: Some(MoveDiagnosis {
                r#type: "generic_eval_loss".to_string(),
                confidence: 0.4,
                facts: vec![
                    format!("La mossa giocata e' {}.", san),
                    "La continuazione piu precisa era Cf3.".to_string(),
                    "Il motivo tattico concreto e': inchioda un pezzo sulla diagonale.".to_string(),
                    "La mossa peggiora in modo importante la posizione."
                        .to_string(),
                ],
                principle: "Controlla catture, scacchi e minacce immediate.".to_string(),
                must_mention: vec!["Cf3".to_string()],
            }),
        }
    }
}
