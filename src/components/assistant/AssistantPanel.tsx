import { useState } from "react";
import { useProjectStore } from "../../state/useProjectStore";
import { ChatThread } from "./ChatThread";
import { PromptButtons } from "./PromptButtons";

export function AssistantPanel() {
  const [input, setInput] = useState("");
  const ollamaModel = useProjectStore((s) => s.ollamaModel);
  const ollamaModels = useProjectStore((s) => s.ollamaModels);
  const setOllamaModel = useProjectStore((s) => s.setOllamaModel);
  const sendChat = useProjectStore((s) => s.sendChat);
  const clearAssistant = useProjectStore((s) => s.clearAssistant);
  const ollamaReady = useProjectStore((s) => s.ollamaReady);
  const assistantStatus = useProjectStore((s) => s.assistantStatus);
  const assistantError = useProjectStore((s) => s.assistantError);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    sendChat(text);
  };

  return (
    <div className="assistant-panel">
      <div className="assistant-panel-header">
        <span className="assistant-title">AI Assistant</span>
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
        <button type="button" className="assistant-clear" onClick={clearAssistant} title="Clear chat">
          Clear
        </button>
      </div>
      <PromptButtons />
      <ChatThread />
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
            placeholder="Ask about LaTeX..."
            rows={2}
            disabled={!ollamaReady}
          />
          <button
            type="button"
            className="assistant-send"
            onClick={handleSend}
            disabled={!ollamaReady || assistantStatus === "thinking" || !input.trim()}
            title="Send"
          >
            <span aria-hidden>✈</span>
          </button>
        </div>
      </div>
    </div>
  );
}
