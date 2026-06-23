use anyhow::{Context, Result};
use std::num::NonZero;
use std::path::Path;

/// LLM inference engine wrapping llama-cpp-2 v0.1.150.
/// Chat template: Gemma 4 format (<bos><|turn>role\n...<turn|>).
pub struct LlmEngine {
    model: llama_cpp_2::model::LlamaModel,
    _backend: llama_cpp_2::llama_backend::LlamaBackend,
}

const N_CTX: NonZero<u32> = match NonZero::new(4096) {
    Some(v) => v,
    None => panic!("N_CTX is zero"),
};

impl LlmEngine {
    pub fn load(model_path: &Path) -> Result<Self> {
        let backend = llama_cpp_2::llama_backend::LlamaBackend::init()
            .context("failed to init llama backend")?;

        let model_params = llama_cpp_2::model::params::LlamaModelParams::default();
        let model = llama_cpp_2::model::LlamaModel::load_from_file(
            &backend, model_path, &model_params,
        )
        .with_context(|| format!("failed to load model from {:?}", model_path))?;

        log::info!("LLM model loaded: {} params", model.n_params());
        Ok(LlmEngine { model, _backend: backend })
    }

    pub fn prompt(
        &self,
        system_prompt: &str,
        user_prompt: &str,
        max_tokens: u32,
    ) -> Result<String> {
        use llama_cpp_2::context::params::LlamaContextParams;
        use llama_cpp_2::llama_batch::LlamaBatch;

        // Chat template Gemma 4:
        // <bos><|turn>system\n...<turn|>\n<|turn>user\n...<turn|>\n<|turn>model\n
        let full_prompt = format!(
            "<bos><|turn>system\n{}<turn|>\n<|turn>user\n{}<turn|>\n<|turn>model\n",
            system_prompt, user_prompt
        );

        log::info!("[llm] prompt: {} chars", full_prompt.len());

        let ctx_params = LlamaContextParams::default().with_n_ctx(Some(N_CTX));
        let mut ctx = self
            .model
            .new_context(&self._backend, ctx_params)
            .context("failed to create llama context")?;

        // Tokenize — NON aggiungere <bos>, già incluso nel prompt.
        let tokens = self
            .model
            .str_to_token(&full_prompt, llama_cpp_2::model::AddBos::Never)
            .context("failed to tokenize prompt")?;

        let n = tokens.len();
        log::info!("[llm] tokenized: {} tokens", n);
        anyhow::ensure!(n > 0, "tokenization produced 0 tokens");

        // Batch iniziale: prompt completo.
        // L'ultimo token deve avere logits=true per permettere il sampling.
        let mut batch = LlamaBatch::new(n, 1);
        for (i, token) in tokens.iter().enumerate() {
            let is_last = i == n - 1;
            batch.add(*token, i as i32, &[0], is_last)?;
        }
        ctx.decode(&mut batch)
            .context("failed to decode prompt")?;

        // Generazione autoregressiva.
        let mut output = String::new();
        let eos_token = self.model.token_eos();
        let mut pos = n as i32;

        // Sampler chain: temperatura 0.3 + top-p 0.9 + distribuzione.
        // Bassa temperatura = output più deterministico e coerente.
        let mut sampler = llama_cpp_2::sampling::LlamaSampler::chain([
            llama_cpp_2::sampling::LlamaSampler::temp(0.3),
            llama_cpp_2::sampling::LlamaSampler::top_p(0.9, 1),
            llama_cpp_2::sampling::LlamaSampler::dist(42),
        ], false);

        for _ in 0..max_tokens {
            let new_token = sampler.sample(&ctx, -1);

            if new_token == eos_token {
                break;
            }

            let piece = self.model.token_to_str(
                new_token,
                llama_cpp_2::model::Special::Tokenize,
            )?;
            output.push_str(&piece);
            sampler.accept(new_token);

            let mut next = LlamaBatch::new(1, 1);
            next.add(new_token, pos, &[0], true)?;
            ctx.decode(&mut next)
                .context("failed to decode token")?;
            pos += 1;
        }

        let cleaned = output
            .replace("<turn|>", "")
            .trim()
            .to_string();
        Ok(cleaned)
    }
}

unsafe impl Send for LlmEngine {}
unsafe impl Sync for LlmEngine {}