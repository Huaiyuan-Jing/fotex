import { create } from "zustand";
import type {
  CompileStatus,
  ActivePdfTab,
  AssistantStatus,
  Message,
} from "./types";
import * as tauri from "../lib/tauri";
import {
  PROMPT_FORMULA,
  userPromptFormula,
  PROMPT_FIX_ERROR,
  userPromptFixError,
  PROMPT_COMPLETE,
  userPromptComplete,
} from "../lib/prompts";

const DEFAULT_TEX = `\\documentclass{article}
\\begin{document}
Hello, LaTeX.
\\end{document}
`;

export interface ProjectState {
  // Project / editor
  workspaceDir: string | undefined;
  texPath: string | undefined;
  texContent: string;
  dirty: boolean;
  compileStatus: CompileStatus;
  compileLog: string;
  compiledPdfPath: string | undefined;
  uploadedPdfPath: string | undefined;
  activePdfTab: ActivePdfTab;
  selectionText: string | undefined;
  cursorContext: string | undefined;
  lastSavedAt: number | undefined;
  // Assistant
  ollamaModel: string;
  ollamaModels: string[];
  ollamaReady: boolean;
  assistantMessages: Message[];
  assistantStatus: AssistantStatus;
  assistantError: string | undefined;
  // Toast / UI
  toastMessage: string | undefined;
  toastVariant: "info" | "error" | "success";
  // Pending editor updates (editor consumes and clears)
  pendingReplaceSelection: string | undefined;
  pendingInsertAtCursor: string | undefined;
}

export interface ProjectActions {
  setTexContent: (content: string) => void;
  setSelection: (text: string | undefined) => void;
  setCursorContext: (context: string | undefined) => void;
  setActivePdfTab: (tab: ActivePdfTab) => void;
  setOllamaModel: (model: string) => void;
  setToast: (message: string | undefined, variant?: "info" | "error" | "success") => void;

  loadModels: () => Promise<void>;
  loadTempTex: () => Promise<void>;
  openFile: () => Promise<void>;
  saveFile: () => Promise<boolean>;
  compile: () => Promise<void>;
  uploadPdf: () => Promise<void>;

  sendChat: (content: string) => Promise<void>;
  promptFormula: () => Promise<void>;
  promptFixError: () => Promise<void>;
  promptComplete: () => Promise<void>;
  applyFormulaToEditor: (latex: string) => void;
  appendAtCursor: (latex: string) => void;
  clearPendingReplace: () => void;
  clearPendingInsert: () => void;

  clearAssistant: () => void;
}

type Store = ProjectState & ProjectActions;

export const useProjectStore = create<Store>((set, get) => ({
  workspaceDir: undefined,
  texPath: undefined,
  texContent: DEFAULT_TEX,
  dirty: false,
  compileStatus: "idle",
  compileLog: "",
  compiledPdfPath: undefined,
  uploadedPdfPath: undefined,
  activePdfTab: "compiled",
  selectionText: undefined,
  cursorContext: undefined,
  lastSavedAt: undefined,
  ollamaModel: "gemma3:12b",
  ollamaModels: [],
  ollamaReady: false,
  assistantMessages: [],
  assistantStatus: "idle",
  assistantError: undefined,
  toastMessage: undefined,
  toastVariant: "info",
  pendingReplaceSelection: undefined,
  pendingInsertAtCursor: undefined,

  setTexContent: (content) =>
    set({ texContent: content, dirty: true }),

  setSelection: (text) => set({ selectionText: text }),
  setCursorContext: (context) => set({ cursorContext: context }),
  setActivePdfTab: (tab) => set({ activePdfTab: tab }),
  setOllamaModel: (model) => set({ ollamaModel: model }),
  setToast: (message, variant = "info") =>
    set({ toastMessage: message, toastVariant: variant ?? "info" }),

  loadModels: async () => {
    try {
      const { models } = await tauri.ollamaListModels();
      set({
        ollamaModels: models ?? [],
        ollamaReady: true,
        assistantError: undefined,
      });
      if (models?.length && !models.includes(get().ollamaModel)) {
        set({ ollamaModel: models[0] });
      }
    } catch {
      set({ ollamaModels: [], ollamaReady: false, assistantError: "Ollama not running" });
    }
  },

  loadTempTex: async () => {
    try {
      const content = await tauri.readTempTex();
      set({ texContent: content, dirty: false });
    } catch {
      set({ texContent: DEFAULT_TEX });
    }
  },

  openFile: async () => {
    try {
      const { path, name } = await tauri.pickFile({
        filters: [{ name: "LaTeX", extensions: ["tex"] }],
      });
      const { content } = await tauri.readTextFile({ path });
      const workspaceDir = path.replace(/[\\/][^\\/]*$/, "");
      set({
        texPath: path,
        workspaceDir: workspaceDir || undefined,
        texContent: content,
        dirty: false,
        lastSavedAt: undefined,
      });
      get().setToast(`Opened ${name}`, "success");
    } catch (e) {
      get().setToast(String(e), "error");
    }
  },

  saveFile: async () => {
    const { texPath, texContent } = get();
    if (!texPath) {
      get().setToast("No file open. Use Open to select a .tex file.", "error");
      return false;
    }
    try {
      const { ok } = await tauri.writeTextFile({ path: texPath, content: texContent });
      if (ok) {
        set({ dirty: false, lastSavedAt: Date.now() });
        get().setToast("Saved", "success");
        return true;
      }
    } catch (e) {
      get().setToast(String(e), "error");
    }
    return false;
  },

  compile: async () => {
    const { texPath, texContent, workspaceDir } = get();
    set({ compileStatus: "compiling" });
    try {
      const payload: Parameters<typeof tauri.compileTex>[0] = workspaceDir
        ? { workdir: workspaceDir }
        : {};
      if (texPath) payload.texPath = texPath;
      else payload.texContent = texContent;
      const result = await tauri.compileTex(payload);
      set({
        compileStatus: result.success ? "success" : "error",
        compileLog: result.log,
        compiledPdfPath: result.pdfPath ?? get().compiledPdfPath,
      });
      if (result.success) get().setToast("Compiled", "success");
      else get().setToast("Compile failed", "error");
    } catch (e) {
      set({
        compileStatus: "error",
        compileLog: String(e),
      });
      get().setToast(String(e), "error");
    }
  },

  uploadPdf: async () => {
    try {
      const { path } = await tauri.pickFile({
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      const { dstPath } = await tauri.copyPdfToWorkspace({ srcPath: path });
      set({ uploadedPdfPath: dstPath, activePdfTab: "uploaded" });
      get().setToast("PDF added to workspace", "success");
    } catch (e) {
      get().setToast(String(e), "error");
    }
  },

  sendChat: async (content) => {
    const { ollamaModel, assistantMessages, ollamaReady } = get();
    if (!ollamaReady) {
      get().setToast("Ollama not running. Start ollama serve and ensure a model is available.", "error");
      return;
    }
    const next: Message[] = [...assistantMessages, { role: "user", content }];
    set({ assistantMessages: next, assistantStatus: "thinking", assistantError: undefined });
    try {
      const { text } = await tauri.ollamaGenerate({
        model: ollamaModel,
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      });
      set({
        assistantMessages: [...next, { role: "assistant", content: text }],
        assistantStatus: "idle",
      });
    } catch (e) {
      set({
        assistantStatus: "error",
        assistantError: String(e),
      });
      get().setToast(String(e), "error");
    }
  },

  promptFormula: async () => {
    const { selectionText, ollamaReady, ollamaModel, assistantMessages } = get();
    if (!selectionText?.trim()) {
      get().setToast("Select some text first.", "info");
      return;
    }
    if (!ollamaReady) {
      get().setToast("Ollama not running.", "error");
      return;
    }
    const userContent = userPromptFormula(selectionText);
    const messages: Message[] = [
      { role: "system", content: PROMPT_FORMULA },
      { role: "user", content: userContent },
    ];
    set({ assistantStatus: "thinking", assistantError: undefined });
    try {
      const { text } = await tauri.ollamaGenerate({
        model: ollamaModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const latex = text.trim().replace(/^```\w*\n?|\n?```$/g, "").trim();
      set({
        assistantStatus: "idle",
        assistantMessages: [
          ...assistantMessages,
          { role: "user", content: `To formula: ${selectionText}` },
          { role: "assistant", content: latex },
        ],
      });
      get().applyFormulaToEditor(latex);
    } catch (e) {
      set({ assistantStatus: "error", assistantError: String(e) });
      get().setToast(String(e), "error");
    }
  },

  promptFixError: async () => {
    const { compileLog, texContent, ollamaReady, ollamaModel, assistantMessages } = get();
    if (!compileLog?.trim()) {
      get().setToast("Compile first to get a log.", "info");
      return;
    }
    if (!ollamaReady) {
      get().setToast("Ollama not running.", "error");
      return;
    }
    const userContent = userPromptFixError(compileLog, texContent);
    const messages: Message[] = [
      { role: "system", content: PROMPT_FIX_ERROR },
      { role: "user", content: userContent },
    ];
    set({ assistantStatus: "thinking", assistantError: undefined });
    try {
      const { text } = await tauri.ollamaGenerate({
        model: ollamaModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      set({
        assistantStatus: "idle",
        assistantMessages: [
          ...assistantMessages,
          { role: "user", content: "Fix error" },
          { role: "assistant", content: text },
        ],
      });
    } catch (e) {
      set({ assistantStatus: "error", assistantError: String(e) });
      get().setToast(String(e), "error");
    }
  },

  promptComplete: async () => {
    const { cursorContext, ollamaReady, ollamaModel, assistantMessages } = get();
    if (!cursorContext?.trim()) {
      get().setToast("Place cursor in document for context.", "info");
      return;
    }
    if (!ollamaReady) {
      get().setToast("Ollama not running.", "error");
      return;
    }
    const userContent = userPromptComplete(cursorContext);
    const messages: Message[] = [
      { role: "system", content: PROMPT_COMPLETE },
      { role: "user", content: userContent },
    ];
    set({ assistantStatus: "thinking", assistantError: undefined });
    try {
      const { text } = await tauri.ollamaGenerate({
        model: ollamaModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const latex = text.trim().replace(/^```\w*\n?|\n?```$/g, "").trim();
      set({
        assistantStatus: "idle",
        assistantMessages: [
          ...assistantMessages,
          { role: "user", content: "Complete paragraph" },
          { role: "assistant", content: latex },
        ],
      });
      get().appendAtCursor(latex);
    } catch (e) {
      set({ assistantStatus: "error", assistantError: String(e) });
      get().setToast(String(e), "error");
    }
  },

  applyFormulaToEditor: (latex) => {
    set({ pendingReplaceSelection: latex, selectionText: undefined });
    get().setToast("Formula applied", "success");
  },

  appendAtCursor: (latex) => {
    set({ pendingInsertAtCursor: latex, cursorContext: undefined });
    get().setToast("Content appended at cursor", "success");
  },

  clearPendingReplace: () => set({ pendingReplaceSelection: undefined }),
  clearPendingInsert: () => set({ pendingInsertAtCursor: undefined }),

  clearAssistant: () =>
    set({
      assistantMessages: [],
      assistantStatus: "idle",
      assistantError: undefined,
    }),
}));
