// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf}; // 合并了 Path 和 PathBuf 的引用
use tauri_plugin_shell::ShellExt;

const OLLAMA_CHAT: &str = "http://desktop.tailf23c91.ts.net:11434/api/chat";
const OLLAMA_MODEL: &str = "gemma3:12b";

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

/// Read tex from src-tauri; returns default content if file does not exist.
#[tauri::command]
fn read_tex() -> Result<String, String> {
    let dir = src_tauri_dir()?;
    let path = dir.join("main.tex"); // 注意这里读的是 main.tex，与你的 compile_latex 保持一致
    match fs::read_to_string(&path) {
        Ok(s) => Ok(s),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(DEFAULT_TEX.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

// --- 修改：支持动态工作目录的编译函数 ---
#[tauri::command]
async fn compile_latex(
    app_handle: tauri::AppHandle, 
    content: String, 
    work_dir: Option<String> // 新增可选参数，前端不传或传 null 时起效
) -> Result<String, String> {
    // 1. 如果有 work_dir 就用它，否则回退到 src_tauri_dir()
    let output_dir = match work_dir {
        Some(dir) if !dir.trim().is_empty() => PathBuf::from(dir),
        _ => src_tauri_dir()?,
    };

    // 2. 将文件命名为 main.tex 存放在目标文件夹中
    let tex_path = output_dir.join("main.tex");
    let pdf_path = output_dir.join("main.pdf");
    fs::write(&tex_path, content).map_err(|e| e.to_string())?;

    // 3. 运行编译并指定当前运行目录为 output_dir
    let sidecar_command = app_handle
        .shell()
        .sidecar("tectonic")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .args(["-X", "compile", "main.tex"]) // 直接编译 main.tex
        .current_dir(&output_dir);           // 关键：切换工作目录

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
struct Message {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<Message>,  
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaMessage {
    content: String,
}

#[derive(Deserialize)]
struct OllamaResponse {
    message: OllamaMessage,  
}

#[tauri::command]
async fn ask_ollama(prompt: String) -> Result<String, String> {
    let client = Client::new();
    let url = OLLAMA_CHAT.to_string();


    let messages = vec![
        Message {
            role: "system".to_string(),
            content: "You are a LaTeX assistant. Output ONLY raw LaTeX. No markdown fences, no explanations unless asked.".to_string(),
        },
        Message {
            role: "user".to_string(),
            content: prompt,
        },
    ];

    let payload = OllamaRequest {
        model: OLLAMA_MODEL.to_string(),
        messages,
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
        Ok(clean_output(&body.message.content))
    } else {
        Err(format!("Ollama error: {}", res.status()))
    }
}

#[tauri::command]
async fn fix_latex_error(snippet: String, error_msg: String) -> Result<String, String> {
    let prompt = format!("Fix this LaTeX compile error.\nError: {}\n\nCode:\n{}", error_msg, snippet);
    ask_ollama(prompt).await
}

async fn to_latex_formula(snippet: String) -> Result<String, String> {
    let prompt: String = format!("Convert the text into latex formula. Only output the latex expression. \n{}", snippet);
    ask_ollama(prompt).await
}

#[tauri::command]
async fn autocomplete_latex(prefix: String) -> Result<String, String> {
    let prompt = format!("Continue this LaTeX snippet. Output only the continuation, not the original:\n{}", prefix);
    ask_ollama(prompt).await
}


fn clean_output(s: &str) -> String {
    s.trim()
     .trim_start_matches("```latex")
     .trim_start_matches("```")
     .trim_end_matches("```")
     .trim()
     .to_string()
}

#[derive(Serialize)]
struct FileNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Vec<FileNode>,
}

fn build_tree(path: &Path) -> Result<FileNode, String> {
    let name = path.file_name().unwrap_or_default().to_string_lossy().into_owned();
    let is_dir = path.is_dir();
    let path_str = path.to_string_lossy().into_owned();
    let mut children = Vec::new();

    if is_dir {
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.flatten() {
                if !entry.file_name().to_string_lossy().starts_with('.') {
                    if let Ok(child_node) = build_tree(&entry.path()) {
                        children.push(child_node);
                    }
                }
            }
        }
        children.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    }
    Ok(FileNode { name, path: path_str, is_dir, children })
}

#[tauri::command]
fn read_folder(path: String) -> Result<FileNode, String> {
    build_tree(Path::new(&path))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init()) 
        .invoke_handler(tauri::generate_handler![
            read_tex, // ✅ 记得在这里注册！否则前端无法调用
            compile_latex, 
            ask_ollama, 
            read_folder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}