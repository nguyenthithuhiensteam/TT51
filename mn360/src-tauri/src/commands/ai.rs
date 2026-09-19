use serde::{Deserialize, Serialize};

/// Yêu cầu gọi AI Gateway — khóa API chỉ tồn tại trong bộ nhớ của lệnh này khi thực thi,
/// không bao giờ được ghi vào log hay lưu trong mã nguồn.
#[derive(Debug, Deserialize)]
pub struct AiRequest {
    pub provider: String,
    pub api_key: String,
    pub model: String,
    pub system_prompt: String,
    pub user_prompt: String,
}

#[derive(Debug, Serialize)]
pub struct AiResponse {
    pub content: String,
}

#[tauri::command]
pub async fn ai_generate(req: AiRequest) -> Result<AiResponse, String> {
    if req.api_key.trim().is_empty() {
        return Err("Chưa cấu hình khóa API cho nhà cung cấp AI.".into());
    }
    let client = reqwest::Client::new();
    let content = match req.provider.as_str() {
        "openai" => call_openai(&client, &req).await,
        "gemini" => call_gemini(&client, &req).await,
        "claude" => call_claude(&client, &req).await,
        other => Err(format!("Nhà cung cấp AI không được hỗ trợ: {other}")),
    }?;
    Ok(AiResponse { content })
}

async fn call_openai(client: &reqwest::Client, req: &AiRequest) -> Result<String, String> {
    let body = serde_json::json!({
        "model": req.model,
        "messages": [
            { "role": "system", "content": req.system_prompt },
            { "role": "user", "content": req.user_prompt },
        ],
    });
    let resp = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(&req.api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("[mang] Không gọi được OpenAI: {e}"))?;
    let status = resp.status();
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("[mang] Phản hồi không hợp lệ từ OpenAI: {e}"))?;
    if !status.is_success() {
        let message = json["error"]["message"].as_str().unwrap_or("Lỗi không xác định");
        return Err(format!("[{}] OpenAI báo lỗi: {message}", status.as_u16()));
    }
    json["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Không đọc được nội dung phản hồi từ OpenAI".to_string())
}

async fn call_gemini(client: &reqwest::Client, req: &AiRequest) -> Result<String, String> {
    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        req.model, req.api_key
    );
    let body = serde_json::json!({
        "systemInstruction": { "parts": [{ "text": req.system_prompt }] },
        "contents": [{ "parts": [{ "text": req.user_prompt }] }],
    });
    let resp = client
        .post(url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("[mang] Không gọi được Gemini: {e}"))?;
    let status = resp.status();
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("[mang] Phản hồi không hợp lệ từ Gemini: {e}"))?;
    if !status.is_success() {
        let message = json["error"]["message"].as_str().unwrap_or("Lỗi không xác định");
        return Err(format!("[{}] Gemini báo lỗi: {message}", status.as_u16()));
    }
    json["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Không đọc được nội dung phản hồi từ Gemini".to_string())
}

async fn call_claude(client: &reqwest::Client, req: &AiRequest) -> Result<String, String> {
    let body = serde_json::json!({
        "model": req.model,
        "max_tokens": 1024,
        "system": req.system_prompt,
        "messages": [{ "role": "user", "content": req.user_prompt }],
    });
    let resp = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &req.api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("[mang] Không gọi được Claude: {e}"))?;
    let status = resp.status();
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("[mang] Phản hồi không hợp lệ từ Claude: {e}"))?;
    if !status.is_success() {
        let message = json["error"]["message"].as_str().unwrap_or("Lỗi không xác định");
        return Err(format!("[{}] Claude báo lỗi: {message}", status.as_u16()));
    }
    json["content"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Không đọc được nội dung phản hồi từ Claude".to_string())
}
