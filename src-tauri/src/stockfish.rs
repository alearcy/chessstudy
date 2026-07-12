use anyhow::{Context, Result};
use serde::Serialize;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use tokio::sync::Mutex;

/// Risultato di un'analisi Stockfish, normalizzato al POV del Bianco.
#[derive(Debug, Clone, Serialize)]
pub struct AnalysisResult {
    pub fen: String,
    pub depth: u32,
    /// Centesimi di pedone, POV Bianco (null se mate o non disponibile).
    pub score_cp: Option<i32>,
    /// Mosse a mate, POV Bianco (+ Bianco matta, - Bianco viene mattato).
    pub score_mate: Option<i32>,
    /// Miglior mossa UCI (es. "e2e4"), null se posizione terminale.
    pub best_move_uci: Option<String>,
}

/// Engine UCI wrapper — spawna Stockfish 18 come child process e comunica via stdin/stdout.
pub struct Engine {
    child: Mutex<ChildProcess>,
    binary_path: String,
}

/// Stato interno che wrappa stdin/stdout del child.
struct ChildProcess {
    stdin: Box<dyn Write + Send>,
    stdout_lines: Box<dyn Iterator<Item = std::io::Result<String>> + Send>,
}

impl Engine {
    /// Crea un nuovo engine, spawnando il binario e inizializzando UCI.
    pub fn new(binary_path: &str) -> Result<Self> {
        let mut child = Command::new(binary_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .with_context(|| format!("failed to spawn stockfish at {}", binary_path))?;

        let stdin = Box::new(child.stdin.take().context("failed to capture stdin")?);
        let reader = BufReader::new(child.stdout.take().context("failed to capture stdout")?);
        let stdout_lines = Box::new(reader.lines());

        let mut proc = ChildProcess {
            stdin,
            stdout_lines,
        };

        // Handshake UCI iniziale
        send_command(&mut proc, "uci")?;
        wait_for_line(&mut proc, "uciok")?;

        send_command(&mut proc, "setoption name MultiPV value 1")?;
        send_command(&mut proc, "isready")?;
        wait_for_line(&mut proc, "readyok")?;

        log::info!("Stockfish engine ready (binary: {})", binary_path);

        Ok(Engine {
            child: Mutex::new(proc),
            binary_path: binary_path.to_string(),
        })
    }

    /// Analizza una posizione FEN a profondità e thread configurabili.
    pub fn analyze(
        &self,
        fen: &str,
        depth: u32,
        threads: u32,
        multipv: u32,
    ) -> Result<AnalysisResult> {
        let mut proc = self.child.blocking_lock();
        let depth = depth.clamp(1, 30);
        let threads = threads.clamp(1, 32);
        let multipv = multipv.clamp(1, 3);

        // Determina lato al tratto dal FEN per normalizzazione.
        let side_to_move = fen.split_whitespace().nth(1).unwrap_or("w");
        let black_to_move = side_to_move == "b";

        send_command(
            &mut *proc,
            &format!("setoption name Threads value {}", threads),
        )?;
        send_command(
            &mut *proc,
            &format!("setoption name MultiPV value {}", multipv),
        )?;
        send_command(&mut *proc, &format!("position fen {}", fen))?;
        send_command(&mut *proc, &format!("go depth {}", depth))?;

        let mut best_cp: Option<i32> = None;
        let mut best_mate: Option<i32> = None;
        let mut best_depth: u32 = 0;

        loop {
            let line = read_line(&mut *proc)?;
            let trimmed = line.trim();

            if trimmed.starts_with("info") && trimmed.contains(" score ") {
                if let Some(cap) = capture_regex(trimmed, "depth (\\d+)") {
                    best_depth = cap.parse().unwrap_or(best_depth);
                }
                if let Some(cap) = capture_regex(trimmed, "score cp (-?\\d+)") {
                    best_cp = Some(cap.parse().unwrap_or(0));
                    best_mate = None;
                } else if let Some(cap) = capture_regex(trimmed, "score mate (-?\\d+)") {
                    best_mate = Some(cap.parse().unwrap_or(0));
                    best_cp = None;
                }
            } else if trimmed.starts_with("bestmove") {
                let best_move_uci = capture_regex(trimmed, "bestmove (\\S+)")
                    .filter(|m| *m != "(none)")
                    .map(|m| m.to_string());

                // Normalizza al POV Bianco.
                let score_cp = best_cp.map(|cp| if black_to_move { -cp } else { cp });
                let score_mate = best_mate.map(|m| if black_to_move { -m } else { m });

                return Ok(AnalysisResult {
                    fen: fen.to_string(),
                    depth: best_depth,
                    score_cp,
                    score_mate,
                    best_move_uci,
                });
            }
        }
    }

    /// Richiede il path del binario (per diagnostica).
    pub fn binary_path(&self) -> &str {
        &self.binary_path
    }
}

impl Drop for Engine {
    fn drop(&mut self) {
        // Il child viene terminato automaticamente quando esce dallo scope.
        // Qui non possiamo bloccare async, ma il Mutex è sync quindi va bene.
        if let Ok(mut proc) = self.child.try_lock() {
            let _ = writeln!(proc.stdin, "quit");
            let _ = proc.stdin.flush();
        }
    }
}

// --- helper interni ---

fn send_command(proc: &mut ChildProcess, cmd: &str) -> Result<()> {
    writeln!(proc.stdin, "{}", cmd)?;
    proc.stdin.flush()?;
    Ok(())
}

fn read_line(proc: &mut ChildProcess) -> Result<String> {
    proc.stdout_lines
        .next()
        .unwrap_or_else(|| {
            Err(std::io::Error::new(
                std::io::ErrorKind::UnexpectedEof,
                "engine stdout closed",
            ))
        })
        .map_err(Into::into)
}

fn wait_for_line(proc: &mut ChildProcess, expected: &str) -> Result<()> {
    loop {
        let line = read_line(proc)?;
        if line.trim() == expected {
            return Ok(());
        }
    }
}

/// Cattura il primo gruppo di una regex applicata a una stringa.
fn capture_regex<'a>(line: &'a str, pattern: &str) -> Option<&'a str> {
    // Regex minimalista: supporta solo pattern semplici come "abc (\\d+)".
    let prefix_end = pattern.find('(')?;
    let prefix = &pattern[..prefix_end];
    let suffix_start = pattern[prefix_end..]
        .find(')')
        .map(|i| prefix_end + i + 1)?;

    let prefix_start = line.find(prefix)?;
    let line_after_prefix = &line[prefix_start + prefix.len()..];
    let suffix = &pattern[suffix_start..];

    if suffix.is_empty() {
        // Prendi tutto fino allo spazio o fine stringa.
        let end = line_after_prefix
            .find(' ')
            .unwrap_or(line_after_prefix.len());
        Some(&line_after_prefix[..end])
    } else if let Some(end) = line_after_prefix.find(suffix) {
        Some(&line_after_prefix[..end])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_regex() {
        assert_eq!(
            capture_regex("info depth 15 score cp 42 nodes 1000", "depth (\\d+)"),
            Some("15")
        );
        assert_eq!(
            capture_regex("info depth 15 score cp -42 nodes 1000", "score cp (-?\\d+)"),
            Some("-42")
        );
        assert_eq!(
            capture_regex("bestmove e2e4 ponder e7e5", "bestmove (\\S+)"),
            Some("e2e4")
        );
        assert_eq!(
            capture_regex("bestmove (none)", "bestmove (\\S+)"),
            Some("(none)")
        );
    }
}
