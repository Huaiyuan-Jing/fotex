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

/** Read UTF-8 text file. */
export async function readTextFile(payload: ReadTextFilePayload): Promise<ReadTextFileResult> {
  return invoke<ReadTextFileResult>("read_text_file", payload as unknown as Record<string, unknown>);
}

/** Write text file. */
export async function writeTextFile(payload: WriteTextFilePayload): Promise<WriteTextFileResult> {
  return invoke<WriteTextFileResult>("write_text_file", payload as unknown as Record<string, unknown>);
}

/** Read temp.tex from src-tauri; used to init the editor. */
export async function readTempTex(): Promise<string> {
  return invoke<string>("read_tex");
}

/** Read temp.pdf as base64 for embedding (avoids asset protocol). */
export async function readTempPdfBase64(): Promise<string> {
  return invoke<string>("read_temp_pdf_base64");
}

/** Compile LaTeX via lib.rs compile_latex (uses tectonic sidecar). Returns absolute PDF path on success. */
export async function compileTex(payload: CompileTexPayload): Promise<CompileTexResult> {
  const content = payload.texContent ?? "";
  try {
    const pdfPath = await invoke<string>("compile_latex", { content });
    return { success: true, pdfPath, log: "Compiled successfully." };
  } catch (e) {
    return { success: false, log: String(e) };
  }
}

/** Open file picker; optional filters e.g. [{ name: "PDF", extensions: ["pdf"] }]. */
export async function pickFile(payload: PickFilePayload = {}): Promise<PickFileResult> {
  return invoke<PickFileResult>("pick_file", payload as unknown as Record<string, unknown>);
}

/** Copy a PDF into workspace; returns destination path. */
export async function copyPdfToWorkspace(
  payload: CopyPdfToWorkspacePayload
): Promise<CopyPdfToWorkspaceResult> {
  return invoke<CopyPdfToWorkspaceResult>("copy_pdf_to_workspace", payload as unknown as Record<string, unknown>);
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
