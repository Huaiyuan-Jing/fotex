// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::process::Command;

#[tauri::command]
fn compile_latex(content: String) -> Result<String, String> {
    let tex_path = "temp.tex";
    fs::write(tex_path, content).map_err(|e| e.to_string())?;

    let output = Command::new("tectonic")
        .arg("-X")
        .arg("compile")
        .arg(tex_path)
        .output()
        .map_err(|e| format!("Cannot find tectonic: {}", e))?;

    if output.status.success() {
        Ok("Successful compile!".into())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Fail to compile: {}", err_msg))
    }
}

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    prompt: String,
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaResponse {
    response: String,
}

#[tauri::command]
async fn ask_ollama(prompt: String) -> Result<String, String> {
    let client = Client::new();
    let url = "http://desktop.tailf23c91.ts.net:11434/api/generate";

    let payload = OllamaRequest {
        model: "gemma3:12b".to_string(),
        prompt,
        stream: false,
    };

    let res = client
        .post(url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    if res.status().is_success() {
        let body: OllamaResponse = res.json().await.map_err(|e| e.to_string())?;
        Ok(body.response)
    } else {
        Err(format!("Ollama error: {}", res.status()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![compile_latex, ask_ollama])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
