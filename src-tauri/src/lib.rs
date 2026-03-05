
use regex::Regex;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt; 

const OLLAMA_CHAT: &str = "http://desktop.tailf23c91.ts.net:11434/api/chat";
const OLLAMA_MODEL: &str = "gemma3:12b";

fn src_tauri_dir() -> Result<PathBuf, String> {
    let output_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if !output_dir.exists() {
        return Err(format!(
            "src-tauri dir does not exist: {}",
            output_dir.display()
        ));
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

#[tauri::command]
fn write_text_file(payload: WriteTextFilePayload) -> Result<WriteTextFileResult, String> {
    fs::write(&payload.path, &payload.content).map_err(|e| e.to_string())?;
    Ok(WriteTextFileResult { ok: true })
}

#[derive(Serialize)]
struct ReadTexResult {
    content: String,
    #[serde(rename = "texPath")]
    tex_path: Option<String>,
    #[serde(rename = "workspaceDir")]
    workspace_dir: Option<String>,
}

#[tauri::command]
fn read_tex() -> Result<ReadTexResult, String> {
    let dir = src_tauri_dir()?;
    let path = dir.join("main.tex");
    match fs::read_to_string(&path) {
        Ok(s) => Ok(ReadTexResult {
            content: s,
            tex_path: Some(path.to_string_lossy().into_owned()),
            workspace_dir: Some(dir.to_string_lossy().into_owned()),
        }),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(ReadTexResult {
            content: DEFAULT_TEX.to_string(),
            tex_path: None,
            workspace_dir: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

#[derive(Deserialize)]
struct ReadPdfPayload {
    path: String,
}

#[tauri::command]
fn read_pdf_base64(payload: ReadPdfPayload) -> Result<String, String> {
    let path = if payload.path.trim().is_empty() {
        src_tauri_dir()?.join("main.pdf")
    } else {
        PathBuf::from(payload.path)
    };

    let bytes = fs::read(&path).map_err(|e| format!("Cannot read pdf: {}", e))?;
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &bytes,
    ))
}

#[tauri::command]
async fn compile_latex(
    app_handle: tauri::AppHandle,
    content: String,
    tex_path: Option<String>, 
) -> Result<String, String> {
    let (actual_tex_path, work_dir, file_name) = match tex_path {
        Some(path_str) if !path_str.trim().is_empty() => {
            let p = PathBuf::from(path_str);
            let dir = p.parent().unwrap_or(Path::new("")).to_path_buf();
            let name = p
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into_owned();
            (p, dir, name)
        }
        _ => {
            let dir = src_tauri_dir()?;
            let p = dir.join("main.tex");
            (p, dir, "main.tex".to_string())
        }
    };

    fs::write(&actual_tex_path, content).map_err(|e| e.to_string())?;

    let sidecar_command = app_handle
        .shell()
        .sidecar("tectonic")
        .map_err(|e| format!("Failed to create sidecar: {}", e))?
        .args(["-X", "compile", &file_name])
        .current_dir(&work_dir);

    let output = sidecar_command
        .output()
        .await
        .map_err(|e| format!("Tectonic execution error: {}", e))?;

    if output.status.success() {
        let pdf_path = actual_tex_path.with_extension("pdf");
        Ok(pdf_path.to_string_lossy().into_owned())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        Err(format!("Fail to compile: {}", err_msg))
    }
}

#[derive(Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OllamaMessage {
    content: String,
}

#[derive(Deserialize)]
struct OllamaResponse {
    message: OllamaMessage,
}

#[derive(Deserialize)]
struct OllamaTagsResponse {
    models: Vec<OllamaModelTag>,
}

#[derive(Deserialize)]
struct OllamaModelTag {
    name: String,
}

#[derive(Serialize)]
struct OllamaListModelsResult {
    models: Vec<String>,
}

#[derive(Serialize)]
struct OllamaOptions {
    num_predict: Option<i32>,
    temperature: Option<f32>,
}

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    options: Option<OllamaOptions>,
}

#[tauri::command]
async fn ollama_list_models(base_url: String) -> Result<OllamaListModelsResult, String> {
    let client = Client::new();
    // 自动清理末尾多余的斜杠并拼接路径
    let url = format!("{}/api/tags", base_url.trim_end_matches('/'));

    let res = client.get(&url).send().await.map_err(|e| format!("Network error: {}", e))?;

    if res.status().is_success() {
        let body: OllamaTagsResponse = res.json().await.map_err(|e| format!("JSON error: {}", e))?;
        let models = body.models.into_iter().map(|m| m.name).collect();
        Ok(OllamaListModelsResult { models })
    } else {
        Err(format!("Ollama error: {}", res.status()))
    }
}

#[derive(Serialize)]
struct OllamaGenerateResult {
    text: String,
}

#[tauri::command]
async fn ollama_generate(
    base_url: String,
    model: String,
    messages: Vec<Message>,
) -> Result<OllamaGenerateResult, String> {
    let client = Client::new();
    let url = format!("{}/api/chat", base_url.trim_end_matches('/'));

    let payload = OllamaRequest {
        model,
        messages,
        stream: false,
        options: Some(OllamaOptions {
            num_predict: Some(8192), 
            temperature: Some(0.2),
        }),
    };

    let res = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

    if res.status().is_success() {
        let body: OllamaResponse = res.json().await.map_err(|e| e.to_string())?;
        let final_text = clean_output(&body.message.content);
        Ok(OllamaGenerateResult { text: final_text })
    } else {
        Err(format!("Ollama error: {}", res.status()))
    }
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
        options: Some(OllamaOptions {
            num_predict: Some(4096), 
            temperature: Some(0.2),
        }),
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
    let prompt = format!(
        "Fix this LaTeX compile error.\nError: {}\n\nCode:\n{}\n",
        error_msg, snippet
    );
    ask_ollama(prompt).await
}

#[tauri::command]
async fn to_latex_formula(snippet: String) -> Result<String, String> {
    let prompt: String = format!(
        "Convert the text into latex formula. Only output the latex expression. \n{}",
        snippet
    );
    ask_ollama(prompt).await
}

#[tauri::command]
async fn autocomplete_latex(prefix: String) -> Result<String, String> {
    let prompt = format!(
        "Continue this LaTeX snippet. Output only the continuation, not the original:\n{}",
        prefix
    );
    ask_ollama(prompt).await
}

fn clean_output(s: &str) -> String {
    let re_think = Regex::new(r"(?s)<think>.*?</think>").unwrap();
    let stripped = re_think.replace_all(s, "");

    let re_code = Regex::new(r"(?s)```(?:latex|tex|txt)?\s*\n(.*?)(?:```|$)").unwrap();

    if let Some(caps) = re_code.captures(&stripped) {
        caps.get(1).map_or(stripped.to_string(), |m| m.as_str().trim().to_string())
    } else {
        let mut res = stripped.trim();
        if res.starts_with("```") {
            res = res.trim_start_matches("```latex")
                     .trim_start_matches("```tex")
                     .trim_start_matches("```");
        }
        res.trim_end_matches("```").trim().to_string()
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
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
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
    Ok(FileNode {
        name,
        path: path_str,
        is_dir,
        children,
    })
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
async fn pick_file(
    app_handle: tauri::AppHandle,
    payload: PickFilePayload,
) -> Result<PickFileResult, String> {
    let mut builder = app_handle.dialog().file();

    if let Some(ref filters) = payload.filters {
        for f in filters {
            let ext_refs: Vec<&str> = f.extensions.iter().map(String::as_str).collect();
            builder = builder.add_filter(&f.name, ext_refs.as_slice());
        }
    }

    let (tx, rx) = tokio::sync::oneshot::channel();

    builder.pick_file(move |file_path| {
        let _ = tx.send(file_path);
    });

    let file_path = rx
        .await
        .map_err(|_| "Dialog closed or failed".to_string())?;

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
fn copy_pdf_to_workspace(
    payload: CopyPdfToWorkspacePayload,
) -> Result<CopyPdfToWorkspaceResult, String> {
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
            read_pdf_base64,
            ask_ollama,
            pick_file,
            copy_pdf_to_workspace,
            read_tex,
            compile_latex,
            read_folder,
            fix_latex_error,
            to_latex_formula,
            autocomplete_latex,
            ollama_list_models,
            ollama_generate
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
