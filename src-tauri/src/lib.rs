// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri_plugin_shell::ShellExt;

/// Use the crate root (src-tauri, where Cargo.toml and src/ live) so temp.tex/temp.pdf go there.
fn src_tauri_dir() -> Result<PathBuf, String> {
    let output_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if !output_dir.exists() {
        return Err(format!("src-tauri dir does not exist: {}", output_dir.display()));
    }
    Ok(output_dir)
}

const DEFAULT_TEX: &str = r"\documentclass{article}
\begin{document}
Hello, LaTeX.
\end{document}
";

/// Read temp.tex from src-tauri; returns default content if file does not exist.
#[tauri::command]
fn read_temp_tex() -> Result<String, String> {
    let dir = src_tauri_dir()?;
    let path = dir.join("temp.tex");
    match fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(DEFAULT_TEX.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

/// Read temp.pdf as base64 for embedding in the frontend (avoids asset protocol / iframe crash).
#[tauri::command]
fn read_temp_pdf_base64() -> Result<String, String> {
    let dir = src_tauri_dir()?;
    let path = dir.join("temp.pdf");
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &bytes,
    ))
}

#[tauri::command]
async fn compile_latex(app_handle: tauri::AppHandle, content: String) -> Result<String, String> {
    let output_dir = src_tauri_dir()?;
    let tex_path = output_dir.join("temp.tex");
    let pdf_path = output_dir.join("temp.pdf");
    fs::write(&tex_path, content).map_err(|e| e.to_string())?;

    let sidecar_command = app_handle
        .shell()
        .sidecar("tectonic")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .args(["-X", "compile", "temp.tex"])
        .current_dir(&output_dir);

    let output = sidecar_command
        .output()
        .await
        .map_err(|e| format!("Tectonic execution error: {}", e))?;

    if output.status.success() {
        Ok(pdf_path.to_string_lossy().into_owned())
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
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![read_temp_tex, read_temp_pdf_base64, compile_latex, ask_ollama])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
