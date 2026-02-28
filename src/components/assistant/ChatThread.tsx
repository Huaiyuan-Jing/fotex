import { useRef, useEffect } from "react";
import { useProjectStore } from "../../state/useProjectStore";

export function ChatThread() {
  const messages = useProjectStore((s) => s.assistantMessages);
  const assistantStatus = useProjectStore((s) => s.assistantStatus);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const welcomeText =
    "Hi! I'm your FoTex AI assistant powered by Ollama. Select text in the editor and ask me to convert it to LaTeX, or ask any LaTeX questions!";

  return (
    <div className="chat-thread">
      {messages.length === 0 && (
        <div className="chat-message chat-message--assistant chat-message--welcome">
          <pre className="chat-message-content">{welcomeText}</pre>
          <button
            type="button"
            className="chat-message-copy"
            title="Copy"
            aria-label="Copy message"
            onClick={() => navigator.clipboard?.writeText(welcomeText)}
          >
            Copy
          </button>
        </div>
      )}
      {messages.map((m, i) => (
        <div key={i} className={`chat-message chat-message--${m.role}`}>
          <span className="chat-message-role">{m.role}</span>
          <pre className="chat-message-content">{m.content}</pre>
          <button
            type="button"
            className="chat-message-copy"
            title="Copy"
            aria-label="Copy message"
            onClick={() => navigator.clipboard?.writeText(m.content)}
          >
            Copy
          </button>
        </div>
      ))}
      {assistantStatus === "thinking" && (
        <div className="chat-message chat-message--assistant">
          <span className="chat-message-role">assistant</span>
          <span className="chat-message-content">…</span>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
