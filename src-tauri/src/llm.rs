use anyhow::{Context, Result};
use serde_json::{json, Value};

pub struct OpenRouterClient {
    api_key: String,
    model: String,
    client: reqwest::Client,
}

impl OpenRouterClient {
    pub fn new(api_key: String, model: String) -> Self {
        OpenRouterClient {
            api_key,
            model,
            client: reqwest::Client::new(),
        }
    }

    pub async fn prompt(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<String> {
        log::info!("[openrouter] prompting model {} (max_tokens={}, temp={})", self.model, max_tokens, temperature);

        let body = json!({
            "model": self.model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        });

        let response = self
            .client
            .post("https://openrouter.ai/api/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .context("failed to send request to OpenRouter")?;

        let status = response.status();
        let text = response.text().await.context("failed to read response body")?;

        if !status.is_success() {
            log::error!("[openrouter] HTTP {}: {}", status, text);
            anyhow::bail!("OpenRouter error ({}): {}", status, text);
        }

        let parsed: serde_json::Value =
            serde_json::from_str(&text).context("failed to parse OpenRouter response")?;

        let content = parsed["choices"][0]["message"]["content"]
            .as_str()
            .context("missing choices[0].message.content in OpenRouter response")?;

        log::info!("[openrouter] response: {} chars", content.len());
        Ok(content.to_string())
    }

    /// Come `prompt` ma richiede output JSON (`response_format: json_object`).
    /// Parsa e ritorna il `Value`. Il system/user prompt devono istruire il
    /// modello a produrre JSON valido.
    pub async fn prompt_json(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<Value> {
        log::info!(
            "[openrouter] prompting model {} (json, max_tokens={}, temp={})",
            self.model, max_tokens, temperature
        );

        let body = json!({
            "model": self.model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "response_format": { "type": "json_object" },
        });

        let response = self
            .client
            .post("https://openrouter.ai/api/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .context("failed to send request to OpenRouter")?;

        let status = response.status();
        let text = response.text().await.context("failed to read response body")?;

        if !status.is_success() {
            log::error!("[openrouter] HTTP {}: {}", status, text);
            anyhow::bail!("OpenRouter error ({}): {}", status, text);
        }

        let parsed: Value =
            serde_json::from_str(&text).context("failed to parse OpenRouter response")?;

        let content = parsed["choices"][0]["message"]["content"]
            .as_str()
            .context("missing choices[0].message.content in OpenRouter response")?;

        log::info!("[openrouter] json response: {} chars", content.len());
        serde_json::from_str(content).context("failed to parse JSON content from LLM")
    }
}