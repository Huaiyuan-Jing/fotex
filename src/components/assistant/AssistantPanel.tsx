import { useState } from "react";
import { useProjectStore } from "../../state/useProjectStore";
// 注意：删除了 ChatThread 的引入！
import { PromptButtons } from "./PromptButtons";

export function AssistantPanel() {
  const [input, setInput] = useState("");
  const ollamaModel = useProjectStore((s) => s.ollamaModel);
  const ollamaModels = useProjectStore((s) => s.ollamaModels);
  const setOllamaModel = useProjectStore((s) => s.setOllamaModel);

  // 引入我们刚才新建的方法，替代 sendChat
  const rewriteEditorContent = useProjectStore((s) => s.rewriteEditorContent);

  const clearAssistant = useProjectStore((s) => s.clearAssistant);
  const ollamaReady = useProjectStore((s) => s.ollamaReady);
  const assistantStatus = useProjectStore((s) => s.assistantStatus);
  const assistantError = useProjectStore((s) => s.assistantError);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    // 改为调用重写编辑器的方法
    rewriteEditorContent(text);
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-panel-header">
        <span className="assistant-title">AI Editor Assistant ✨</span>
        {!ollamaReady && (
          <span className="assistant-status assistant-status--error">Ollama not running</span>
        )}
        {ollamaReady && (
          <span className="assistant-status-ready">
            <span className="assistant-status-dot" aria-hidden />
            Ollama Ready
          </span>
        )}
        {ollamaReady && (
          <select
            className="assistant-model-select"
            value={ollamaModel}
            onChange={(e) => setOllamaModel(e.target.value)}
          >
            {ollamaModels.length === 0 && (
              <option value={ollamaModel}>{ollamaModel}</option>
            )}
            {ollamaModels.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        )}
        {/* 如果你连 Clear 按钮都不想要了，这个 button 也可以删掉 */}
        <button type="button" className="assistant-clear" onClick={clearAssistant} title="Clear status">
          Clear
        </button>
      </div>

      <PromptButtons />

      {/* 🛑 删除了 <ChatThread /> 组件，整个对话框区域不复存在了 */}

      <div className="assistant-composer">
        {assistantError && (
          <div className="assistant-error">{assistantError}</div>
        )}
        <div className="assistant-input-row">
          <textarea
            className="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="告诉 AI 你想怎么修改这段代码... (直接回车执行)"
            rows={2}
            disabled={!ollamaReady || assistantStatus === "thinking"}
          />
          <button
            type="button"
            className="assistant-send"
            onClick={handleSend}
            disabled={!ollamaReady || assistantStatus === "thinking" || !input.trim()}
            title={assistantStatus === "thinking" ? "Thinking..." : "Send"}
          >
            <span aria-hidden>{assistantStatus === "thinking" ? "⏳" : "✨"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}