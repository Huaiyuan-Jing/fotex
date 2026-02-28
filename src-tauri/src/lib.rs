// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;

/// Use the crate root (src-tauri, where Cargo.toml and src/ live) so main.tex/main.pdf go there.
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

#[derive(Deserialize)]
struct ReadTextFilePayload {
    path: String,
}

#[derive(Serialize)]
struct ReadTextFileResult {
    content: String,
}

/// Read arbitrary UTF-8 text file by path (for file tree / open).
#[tauri::command]
fn read_text_file(payload: ReadTextFilePayload) -> Result<ReadTextFileResult, String> {
    let content = fs::read_to_string(&payload.path).map_err(|e| e.to_string())?;
    Ok(ReadTextFileResult { content })
}

#[derive(Deserialize)]
struct WriteTextFilePayload {
    path: String,
    content: String,
}

#[derive(Serialize)]
struct WriteTextFileResult {
    ok: bool,
}

/// Write text file (for save).
#[tauri::command]
fn write_text_file(payload: WriteTextFilePayload) -> Result<WriteTextFileResult, String> {
    fs::write(&payload.path, &payload.content).map_err(|e| e.to_string())?;
    Ok(WriteTextFileResult { ok: true })
}

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


/// Read main.pdf as base64 for embedding in the frontend (avoids asset protocol / iframe crash).
#[tauri::command]
fn read_main_pdf_base64() -> Result<String, String> {
    let dir = src_tauri_dir()?;
    let path = dir.join("main.pdf");
    let bytes = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &bytes,
    ))
}


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

#[derive(Deserialize)]
struct FileFilter {
    name: String,
    extensions: Vec<String>,
}

#[derive(Deserialize)]
struct PickFilePayload {
    filters: Option<Vec<FileFilter>>,
}

#[derive(Serialize)]
struct PickFileResult {
    path: String,
    name: String,
}

#[tauri::command]
fn pick_file(app_handle: tauri::AppHandle, payload: PickFilePayload) -> Result<PickFileResult, String> {
    let mut builder = app_handle.dialog().file();
    if let Some(ref filters) = payload.filters {
        for f in filters {
            let ext_refs: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
            builder = builder.add_filter(&f.name, ext_refs.as_slice());
        }
    }
    let file_path = builder.blocking_pick_file();
    let path_str = file_path
        .ok_or_else(|| "No file selected".to_string())?
        .to_string();
    let name = Path::new(&path_str)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();
    Ok(PickFileResult {
        path: path_str,
        name,
    })
}

#[derive(Deserialize)]
struct CopyPdfToWorkspacePayload {
    #[serde(rename = "srcPath")]
    src_path: String,
}

#[derive(Serialize)]
struct CopyPdfToWorkspaceResult {
    #[serde(rename = "dstPath")]
    dst_path: String,
}

#[tauri::command]
fn copy_pdf_to_workspace(payload: CopyPdfToWorkspacePayload) -> Result<CopyPdfToWorkspaceResult, String> {
    let dir = src_tauri_dir()?;
    let dst = dir.join("uploaded.pdf");
    fs::copy(&payload.src_path, &dst).map_err(|e| e.to_string())?;
    Ok(CopyPdfToWorkspaceResult {
        dst_path: dst.to_string_lossy().into_owned(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())

        .plugin(tauri_plugin_dialog::init()) 
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            read_tex,
            read_main_pdf_base64,
            compile_latex,
            ask_ollama,
            read_folder,
            pick_file,
            copy_pdf_to_workspace,
        ])

        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}