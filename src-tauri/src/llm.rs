use anyhow::{Context, Result};
use serde_json::{json, Value};

pub struct LocalLlmClient {
    base_url: String,
    model: String,
    client: reqwest::Client,
}

impl LocalLlmClient {
    pub fn new(base_url: String, model: String) -> Self {
        LocalLlmClient {
            base_url: base_url.trim_end_matches('/').to_string(),
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
        log::info!(
            "[local-llm] prompting {} via {} (max_tokens={}, temp={})",
            self.model,
            self.base_url,
            max_tokens,
            temperature
        );

        let body = self.chat_body(system_prompt, user_prompt, max_tokens, temperature, None);
        let parsed = self.post_chat(body).await?;
        extract_content(&parsed)
    }

    pub async fn prompt_json(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        max_tokens: u32,
        temperature: f64,
    ) -> Result<Value> {
        log::info!(
            "[local-llm] prompting {} via {} (json, max_tokens={}, temp={})",
            self.model,
            self.base_url,
            max_tokens,
            temperature
        );

        let body = self.chat_body(system_prompt, user_prompt, max_tokens, temperature, Some("json"));
        let parsed = self.post_chat(body).await?;
        let content = extract_content(&parsed)?;
        serde_json::from_str(&content).context("failed to parse JSON content from local LLM")
    }

    pub async fn is_available(&self) -> bool {
        self.client
            .get(format!("{}/api/tags", self.base_url))
            .send()
            .await
            .map(|response| response.status().is_success())
            .unwrap_or(false)
    }

    fn chat_body(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        max_tokens: u32,
        temperature: f64,
        format: Option<&str>,
    ) -> Value {
        let mut body = json!({
            "model": self.model,
            "messages": [
                { "role": "system", "content": system_prompt },
                { "role": "user", "content": user_prompt }
            ],
            "stream": false,
            "options": {
                "num_predict": max_tokens,
                "temperature": temperature
            }
        });

        if let Some(format) = format {
            body["format"] = json!(format);
        }

        body
    }

    async fn post_chat(&self, body: Value) -> Result<Value> {
        let response = self
            .client
            .post(format!("{}/api/chat", self.base_url))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .context("failed to send request to local LLM")?;

        let status = response.status();
        let text = response.text().await.context("failed to read response body")?;

        if !status.is_success() {
            log::error!("[local-llm] HTTP {}: {}", status, text);
            anyhow::bail!("local LLM error ({}): {}", status, text);
        }

        serde_json::from_str(&text).context("failed to parse local LLM response")
    }
}

fn extract_content(parsed: &Value) -> Result<String> {
    let content = parsed["message"]["content"]
        .as_str()
        .or_else(|| parsed["choices"][0]["message"]["content"].as_str())
        .context("missing message.content in local LLM response")?;

    log::info!("[local-llm] response: {} chars", content.len());
    Ok(content.to_string())
}
