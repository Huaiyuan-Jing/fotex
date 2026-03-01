
// Project / editor state
export type CompileStatus = "idle" | "compiling" | "success" | "error";
export type ActivePdfTab = "compiled" | "uploaded";
export type AssistantStatus = "idle" | "thinking" | "error";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// Tauri command payloads and returns
export interface ReadTextFilePayload {
  path: string;
}
export interface ReadTextFileResult {
  content: string;
}

export interface WriteTextFilePayload {
  path: string;
  content: string;
}
export interface WriteTextFileResult {
  ok: boolean;
}

export interface CompileTexPayload {
  texPath?: string;
  texContent?: string;
  workdir?: string;
}
export interface CompileTexResult {
  success: boolean;
  pdfPath?: string;
  log: string;
}

export interface PickFilePayload {
  filters?: { name: string; extensions: string[] }[];
}
export interface PickFileResult {
  path: string;
  name: string;
}

export interface CopyPdfToWorkspacePayload {
  srcPath: string;
}
export interface CopyPdfToWorkspaceResult {
  dstPath: string;
}

export interface OllamaListModelsResult {
  models: string[];
}

export interface OllamaMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
export interface OllamaGeneratePayload {
  model: string;
  messages: OllamaMessage[];
  stream?: boolean;
}
export interface OllamaGenerateResult {
  text: string;
}
