use std::time::Duration;

fn endpoint(mode: &str, local: &str) -> Result<reqwest::Url, String> {
    if mode == "public" {
        return reqwest::Url::parse("https://api.languagetool.org/v2/check").map_err(|e| e.to_string());
    }
    if mode != "local" { return Err("Unknown proofreading mode".into()); }
    let url = reqwest::Url::parse(local).map_err(|e| e.to_string())?;
    if !matches!(url.scheme(), "http" | "https") ||
        !matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]" | "::1")) ||
        !url.username().is_empty() || url.password().is_some() || url.query().is_some() ||
        url.fragment().is_some() || url.path() != "/v2/check" {
        return Err("Local proofreading requires a loopback URL ending in /v2/check".into());
    }
    Ok(url)
}

#[tauri::command]
pub async fn proofread_text(mode: String, endpoint: String, text: String, language: String) -> Result<serde_json::Value, String> {
    let url = self::endpoint(&mode, &endpoint)?;
    if mode == "public" && text.len() > 20000 { return Err("The public API allows at most 20 KB per check".into()); }
    // No redirects, proxy forwarding, or public fallback in local mode.
    let client = reqwest::Client::builder().no_proxy()
        .redirect(reqwest::redirect::Policy::none()).timeout(Duration::from_secs(30))
        .build().map_err(|e| e.to_string())?;
    let response = client.post(url).form(&[("text", text), ("language", language)])
        .send().await.map_err(|e| format!("Proofreading connection failed: {e}"))?;
    if !response.status().is_success() {
        return Err(format!("Proofreading server returned HTTP {}", response.status()));
    }
    response.json().await.map_err(|_| "Proofreading server returned invalid JSON".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn local_mode_cannot_send_to_a_remote_host() {
        assert!(endpoint("local", "http://127.0.0.1:8081/v2/check").is_ok());
        assert!(endpoint("local", "http://[::1]:8081/v2/check").is_ok());
        assert!(endpoint("local", "https://api.languagetool.org/v2/check").is_err());
        assert!(endpoint("local", "http://localhost.example.com/v2/check").is_err());
        assert!(endpoint("local", "http://user:pass@localhost/v2/check").is_err());
    }
}
