import { invoke } from "@tauri-apps/api/core";
import type {
  ReadTextFilePayload,
  ReadTextFileResult,
  WriteTextFilePayload,
  WriteTextFileResult,
  CompileTexPayload,
  CompileTexResult,
  PickFilePayload,
  PickFileResult,
  CopyPdfToWorkspacePayload,
  CopyPdfToWorkspaceResult,
  OllamaListModelsResult,
  OllamaGeneratePayload,
  OllamaGenerateResult,
} from "../state/types";

export interface ReadPdfPayload { path: string; }

/** Read UTF-8 text file. */
export async function readTextFile(payload: ReadTextFilePayload): Promise<ReadTextFileResult> {
  // ✅ 修改这里：套上 { payload }
  return invoke<ReadTextFileResult>("read_text_file", { payload });
}

/** Write text file. */
export async function writeTextFile(payload: WriteTextFilePayload): Promise<WriteTextFileResult> {
  // ✅ 修改这里：套上 { payload }
  return invoke<WriteTextFileResult>("write_text_file", { payload });
}

/** Open file picker; optional filters e.g. [{ name: "PDF", extensions: ["pdf"] }]. */
export async function pickFile(payload: PickFilePayload = {}): Promise<PickFileResult> {
  // ✅ 修改这里：套上 { payload }
  return invoke<PickFileResult>("pick_file", { payload });
}

/** Copy a PDF into workspace; returns destination path. */
export async function copyPdfToWorkspace(
  payload: CopyPdfToWorkspacePayload
): Promise<CopyPdfToWorkspaceResult> {
  // ✅ 修改这里：套上 { payload }
  return invoke<CopyPdfToWorkspaceResult>("copy_pdf_to_workspace", { payload });
}

/** Result of reading main.tex: content and optional path info when file exists. */
export interface ReadMainTexResult {
  content: string;
  texPath?: string;
  workspaceDir?: string;
}

/** Read main.tex from src-tauri; used to init the editor. When file exists, returns path/workspace for compile. */
export async function readMainTex(): Promise<ReadMainTexResult> {
  return invoke<ReadMainTexResult>("read_tex");
}

/** 传入真实的 PDF 路径读取 Base64 数据 */
export async function readPdfBase64(payload: ReadPdfPayload): Promise<string> {
  // 注意套上 { payload }
  return invoke<string>("read_pdf_base64", { payload });
}

/** Compile LaTeX via lib.rs compile_latex. Returns absolute PDF path on success. */
export async function compileTex(payload: CompileTexPayload): Promise<CompileTexResult> {
  const content = payload.texContent ?? "";
  const texPath = payload.texPath; // 取出具体的 tex 文件路径

  try {
    const pdfPath = await invoke<string>("compile_latex", {
      content,
      texPath: texPath ?? null, // Tauri 会自动将驼峰 texPath 映射为 Rust 的 tex_path
    });
    return { success: true, pdfPath, log: "Compiled successfully." };
  } catch (e) {
    return { success: false, log: String(e) };
  }
}


/** Read folder tree (name, path, is_dir, children). */
export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}
export async function readFolder(path: string): Promise<FileNode> {
  return invoke<FileNode>("read_folder", { path });
}

/** List available Ollama models. Stub: lib.rs uses fixed model gemma3:12b. */
export async function ollamaListModels(): Promise<OllamaListModelsResult> {
  return { models: ["gemma3:12b"] };
}

/** Generate via lib.rs ask_ollama: single prompt, fixed model. Messages formatted as conversation. */
export async function ollamaGenerate(
  payload: OllamaGeneratePayload
): Promise<OllamaGenerateResult> {
  const prompt = payload.messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");
  const text = await invoke<string>("ask_ollama", { prompt });
  return { text };
}
