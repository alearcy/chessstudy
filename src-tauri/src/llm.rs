use anyhow::{bail, Context, Result};
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaChatMessage, LlamaChatTemplate, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use std::num::NonZeroU32;
use std::path::{Path, PathBuf};

const DEFAULT_CONTEXT_TOKENS: u32 = 4096;
const DEFAULT_THREADS: i32 = 4;

pub struct LocalLlmClient {
    backend: LlamaBackend,
    model: LlamaModel,
    model_path: PathBuf,
}

#[cfg(test)]
#[test]
fn parses_json_with_trailing_commas() {
    let value = parse_json_content(
        r#"{
  "panoramica": "ok",
  "giudizio": "bene",
  "momentiChiave": [
    { "indice": 2, "commento": "bene", },
  ],
}"#,
    )
    .unwrap();

    assert_eq!(value["momentiChiave"][0]["indice"], 2);
}

#[cfg(test)]
#[test]
fn parses_json_from_uppercase_markdown_fence() {
    let value = parse_json_content(
        r#"```JSON
{"panoramica":"ok","giudizio":"bene","momentiChiave":[]}
```"#,
    )
    .unwrap();

    assert_eq!(value["panoramica"], "ok");
}

impl LocalLlmClient {
    pub fn new(model_path: impl AsRef<Path>) -> Result<Self> {
        let model_path = model_path.as_ref().to_path_buf();
        if !model_path.exists() {
            bail!("modello GGUF non trovato: {}", model_path.display());
        }

        let backend = LlamaBackend::init().context("failed to initialize llama.cpp backend")?;
        let model_params = LlamaModelParams::default()
            .with_n_gpu_layers(0)
            .with_use_mmap(true);
        let model = LlamaModel::load_from_file(&backend, &model_path, &model_params)
            .with_context(|| format!("failed to load GGUF model {}", model_path.display()))?;

        log::info!("[local-llm] loaded GGUF model {}", model_path.display());
        Ok(Self {
            backend,
            model,
            model_path,
        })
    }

    pub fn model_path(&self) -> &Path {
        &self.model_path
    }

    pub fn is_available(&self) -> bool {
        self.model_path.exists()
    }

    pub fn prompt(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<String> {
        log::info!(
            "[local-llm] prompting embedded model {} (max_tokens={}, temp={})",
            self.model_path.display(),
            max_tokens,
            temperature
        );

        let prompt = self.build_chat_prompt(system_prompt, user_prompt)?;
        self.complete(&prompt, max_tokens, temperature)
    }

    pub fn prompt_json(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<serde_json::Value> {
        let json_instruction =
            "\n\nRispondi con un solo oggetto JSON valido. Nessun testo fuori dal JSON.";
        let prompt =
            self.build_chat_prompt(system_prompt, &format!("{user_prompt}{json_instruction}"))?;
        let content = self.complete(&prompt, max_tokens, temperature)?;
        match parse_json_content(&content) {
            Ok(value) => Ok(value),
            Err(error) => {
                log::warn!(
                    "[local-llm] JSON parse failed, asking model to repair output: {}",
                    error
                );
                let repair_prompt = self.build_json_repair_prompt(&content);
                let repaired_content = self.complete(&repair_prompt, max_tokens.min(2000), 0.0)?;
                parse_json_content(&repaired_content)
                    .context("failed to parse JSON content from embedded LLM")
            }
        }
    }

    fn build_chat_prompt(&self, system_prompt: &str, user_prompt: &str) -> Result<String> {
        let messages = [
            LlamaChatMessage::new("system".to_string(), system_prompt.to_string())?,
            LlamaChatMessage::new("user".to_string(), user_prompt.to_string())?,
        ];

        if let Ok(template) = self.model.chat_template(None) {
            match self.model.apply_chat_template(&template, &messages, true) {
                Ok(prompt) => return Ok(prompt),
                Err(error) => {
                    log::warn!(
                        "[local-llm] model chat template failed, falling back to Gemma format: {}",
                        error
                    );
                }
            }
        }

        if let Ok(template) = LlamaChatTemplate::new("gemma") {
            match self.model.apply_chat_template(&template, &messages, true) {
                Ok(prompt) => return Ok(prompt),
                Err(error) => {
                    log::warn!(
                        "[local-llm] built-in Gemma chat template failed, using manual prompt: {}",
                        error
                    );
                }
            }
        }

        Ok(self.build_manual_gemma_prompt(system_prompt, user_prompt))
    }

    fn build_manual_gemma_prompt(&self, system_prompt: &str, user_prompt: &str) -> String {
        let combined_user_prompt = format!("{}\n\n{}", system_prompt.trim(), user_prompt.trim());
        let file_name = self
            .model_path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_lowercase();

        if file_name.contains("gemma-4") || file_name.contains("gemma4") {
            format!(
                "<|turn>user\n{}<turn|>\n<|turn>model\n",
                combined_user_prompt
            )
        } else {
            format!(
                "<start_of_turn>user\n{}<end_of_turn>\n<start_of_turn>model\n",
                combined_user_prompt
            )
        }
    }

    fn build_json_repair_prompt(&self, content: &str) -> String {
        let truncated = content.chars().take(12_000).collect::<String>();
        let system_prompt = "Converti il testo dell'assistente in un solo oggetto JSON valido. Non aggiungere spiegazioni. Usa solo queste chiavi: panoramica, giudizio, momentiChiave. momentiChiave contiene oggetti con indice numerico e commento stringa.";
        let user_prompt = format!(
            "Testo da convertire in JSON valido:\n\n{}\n\nRispondi solo con JSON valido.",
            truncated
        );
        self.build_chat_prompt(system_prompt, &user_prompt)
            .unwrap_or_else(|_| format!("{}\n\n{}", system_prompt, user_prompt))
    }

    fn complete(&self, prompt: &str, max_tokens: u32, temperature: f64) -> Result<String> {
        let prompt_tokens = self
            .model
            .str_to_token(prompt, AddBos::Always)
            .context("failed to tokenize prompt")?;
        if prompt_tokens.is_empty() {
            bail!("prompt tokenization produced no tokens");
        }

        let n_ctx = DEFAULT_CONTEXT_TOKENS.max(prompt_tokens.len() as u32 + max_tokens + 16);
        let context_params = LlamaContextParams::default()
            .with_n_ctx(NonZeroU32::new(n_ctx))
            .with_n_batch(n_ctx)
            .with_n_threads(DEFAULT_THREADS)
            .with_n_threads_batch(DEFAULT_THREADS);
        let mut context = self
            .model
            .new_context(&self.backend, context_params)
            .context("failed to create llama.cpp context")?;

        let mut batch = LlamaBatch::new(prompt_tokens.len(), 1);
        batch
            .add_sequence(&prompt_tokens, 0, false)
            .context("failed to prepare prompt batch")?;
        context
            .decode(&mut batch)
            .context("failed to decode prompt")?;

        let mut sampler = if temperature <= 0.0 {
            LlamaSampler::greedy()
        } else {
            LlamaSampler::chain_simple([
                LlamaSampler::temp(temperature as f32),
                LlamaSampler::top_p(0.9, 1),
                LlamaSampler::dist(0xC0FFEE),
            ])
        };
        sampler.accept_many(&prompt_tokens);

        let mut output = String::new();
        let mut decoder = encoding_rs::UTF_8.new_decoder();
        let mut position = prompt_tokens.len() as i32;
        for _ in 0..max_tokens {
            let token = sampler.sample(&context, -1);
            if self.model.is_eog_token(token) {
                break;
            }

            output.push_str(
                &self
                    .model
                    .token_to_piece(token, &mut decoder, true, None)
                    .context("failed to convert token to string")?,
            );
            sampler.accept(token);

            let mut next = LlamaBatch::new(1, 1);
            next.add(token, position, &[0], true)
                .context("failed to prepare generation batch")?;
            context
                .decode(&mut next)
                .context("failed to decode token")?;
            position += 1;
        }

        let output = output.trim().to_string();
        log::info!("[local-llm] response: {} chars", output.len());
        Ok(output)
    }
}

fn parse_json_content(content: &str) -> Result<serde_json::Value> {
    let trimmed = content.trim();
    let mut candidates = vec![trimmed.to_string()];

    if let Some(unfenced) = strip_markdown_json_fence(trimmed) {
        candidates.push(unfenced);
    }

    if let Some(json) = extract_json_object(trimmed) {
        candidates.push(json);
    }

    for candidate in candidates {
        if let Ok(value) = serde_json::from_str(&candidate) {
            return Ok(value);
        }

        let repaired = repair_json_candidate(&candidate);
        if repaired != candidate {
            if let Ok(value) = serde_json::from_str(&repaired) {
                return Ok(value);
            }
        }
    }

    serde_json::from_str(trimmed).context("failed to parse JSON response")
}

fn strip_markdown_json_fence(content: &str) -> Option<String> {
    let trimmed = content.trim();
    let without_opening = trimmed
        .strip_prefix("```json")
        .or_else(|| trimmed.strip_prefix("```JSON"))
        .or_else(|| trimmed.strip_prefix("```"))?;
    let without_closing = without_opening.trim().strip_suffix("```")?;
    Some(without_closing.trim().to_string())
}

fn repair_json_candidate(content: &str) -> String {
    let mut repaired = String::with_capacity(content.len());
    let mut chars = content.chars().peekable();
    let mut in_string = false;
    let mut escaped = false;

    while let Some(ch) = chars.next() {
        if in_string {
            repaired.push(ch);
            if escaped {
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                in_string = false;
            }
            continue;
        }

        match ch {
            '"' => {
                in_string = true;
                repaired.push(ch);
            }
            ',' => {
                let mut lookahead = chars.clone();
                while matches!(lookahead.peek(), Some(next) if next.is_whitespace()) {
                    lookahead.next();
                }
                if !matches!(lookahead.peek(), Some('}' | ']')) {
                    repaired.push(ch);
                }
            }
            _ => repaired.push(ch),
        }
    }

    repaired
}

fn extract_json_object(content: &str) -> Option<String> {
    let bytes = content.as_bytes();
    let mut start = None;
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (idx, &byte) in bytes.iter().enumerate() {
        if start.is_none() {
            if byte == b'{' {
                start = Some(idx);
                depth = 1;
            }
            continue;
        }

        if in_string {
            if escaped {
                escaped = false;
            } else if byte == b'\\' {
                escaped = true;
            } else if byte == b'"' {
                in_string = false;
            }
            continue;
        }

        match byte {
            b'"' => in_string = true,
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    let start = start?;
                    return content.get(start..=idx).map(str::to_string);
                }
            }
            _ => {}
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::parse_json_content;

    #[test]
    fn parses_plain_json() {
        let value = parse_json_content(r#"{"panoramica":"ok","momentiChiave":[]}"#).unwrap();
        assert_eq!(value["panoramica"], "ok");
    }

    #[test]
    fn extracts_json_from_markdown_fence() {
        let value = parse_json_content(
            r#"```json
{"panoramica":"ok","giudizio":"bene","momentiChiave":[]}
```"#,
        )
        .unwrap();
        assert_eq!(value["giudizio"], "bene");
    }

    #[test]
    fn extracts_json_after_extra_text_and_ignores_braces_in_strings() {
        let value = parse_json_content(
            r#"Ecco l'analisi:
{"panoramica":"struttura {centrale} stabile","giudizio":"ok","momentiChiave":[{"indice":2,"commento":"bene"}]}
Fine."#,
        )
        .unwrap();
        assert_eq!(value["momentiChiave"][0]["indice"], 2);
    }
}
