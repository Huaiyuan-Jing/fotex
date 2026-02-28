import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [status, setStatus] = useState("等待编译...");
  const [texContent, setTexContent] = useState(
    "\\documentclass{article}\n\\begin{document}\nHello Tauri + LaTeX!\n\\end{document}"
  );
  // 新增：用于存储用户的 AI 指令
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  const handleCompile = async () => {
    try {
      setStatus("编译中...");
      const result = await invoke<string>("compile_latex", { content: texContent });
      setStatus(`✅ ${result}`);
    } catch (err) {
      console.error(err);
      setStatus(`❌ 编译错误: ${err}`);
    }
  };

  // 新增：调用 Ollama 修改代码
  const handleAiEdit = async () => {
    if (!aiPrompt.trim()) return;

    try {
      setIsAiLoading(true);
      setStatus("AI 正在思考中...");

      // 构造 Prompt，强制 AI 格式化输出
      const fullPrompt = `你是一个 LaTeX 专家。请根据以下要求修改 LaTeX 代码，
      仅输出修改后的完整代码，不要包含任何解释文字或 Markdown 代码块标识符。
      
      当前代码：
      ${texContent}
      
      修改要求：
      ${aiPrompt}`;

      // 调用 Rust 后端的 ask_ollama 命令
      const newContent = await invoke<string>("ask_ollama", { prompt: fullPrompt });
      
      // 更新编辑器内容
      setTexContent(newContent.trim());
      setAiPrompt(""); // 清空输入框
      setStatus("✨ AI 修改完成！");
    } catch (err) {
      console.error(err);
      setStatus(`❌ AI 错误: ${err}`);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Latex Local AI Editor</h1>
      
      {/* LaTeX 编辑区域 */}
      <textarea
        style={{
          width: "100%",
          height: "300px",
          fontFamily: "monospace",
          marginBottom: "1rem",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #ccc",
          fontSize: "14px"
        }}
        value={texContent}
        onChange={(e) => setTexContent(e.target.value)}
      />

      {/* AI 对话框区域 */}
      <div style={{ 
        backgroundColor: "#f4f4f9", 
        padding: "1rem", 
        borderRadius: "8px", 
        marginBottom: "1rem",
        border: "1px solid #e0e0e0" 
      }}>
        <h3 style={{ marginTop: 0 }}>AI 修改指令</h3>
        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="例如：帮我把标题改成'我的论文'，并添加一个表格..."
            style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #ddd" }}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiEdit()} // 回车直接发送
          />
          <button 
            onClick={handleAiEdit}
            disabled={isAiLoading}
            style={{
              padding: "8px 16px",
              backgroundColor: isAiLoading ? "#ccc" : "#28a745",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isAiLoading ? "not-allowed" : "pointer"
            }}
          >
            {isAiLoading ? "请稍候..." : "执行修改"}
          </button>
        </div>
      </div>

      {/* 底部控制栏 */}
      <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
        <button 
          onClick={handleCompile}
          style={{
            padding: "12px 24px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "5px",
            fontWeight: "bold",
            cursor: "pointer"
          }}
        >
          🚀 编译当前文档
        </button>
        <span style={{ color: "#666" }}>状态: <strong>{status}</strong></span>
      </div>
    </main>
  );
}

export default App;