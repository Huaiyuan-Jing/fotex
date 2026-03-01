# <p align="center"><img src="src/assets/fotex_logo.webp" width="48" valign="middle"> FoTex</p>

<p align="center">
  <strong>The AI-Driven, Privacy-First, Lightweight LaTeX Editor for the Modern Era.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=white" alt="Tauri">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React">
  <img src="https://img.shields.io/badge/Rust-Latest-000000?logo=rust&logoColor=white" alt="Rust">
  <img src="https://img.shields.io/badge/Ollama-Integrated-white?logo=ollama&logoColor=black" alt="Ollama">
  <img src="https://img.shields.io/badge/Editor-Monaco-blue" alt="Monaco">
</p>

---

## ✨ Overview

**FoTex** is a desktop LaTeX editor designed to bridge the gap between powerful AI assistance and local privacy. Built with **Tauri**, **React**, and **Rust**, it offers a lightning-fast writing experience with integrated **Ollama** support, allowing you to use state-of-the-art LLMs (like DeepSeek-R1 or Llama 3) to draft, fix, and optimize your LaTeX documents entirely on your own hardware.



---

## 🚀 Key Features

* **🤖 Smart AI Assistant**: 
    * **Thinking Filter**: Specialized logic to automatically strip `<think>` tags from reasoning models (like DeepSeek-R1), ensuring only pure LaTeX code enters your document.
    * **Live Model Selection**: Real-time fetching and switching of models available on your Ollama server.
    * **Context-Aware**: Rewrite, fix errors, or generate formulas based on your current selection.
* **⚡ High-Performance Compilation**: 
    * Powered by the **Tectonic** engine for zero-config, millisecond-level local PDF generation.
* **🛡️ Privacy-First**: 
    * No cloud dependency. Your documents and AI prompts stay on your machine or your private Tailscale network.
* **🎨 Modern UI/UX**:
    * **Monaco Editor**: The same high-performance core used in VS Code.
    * **Dark Mode**: A sleek, high-contrast interface designed for long writing sessions.
    * **File Tree System**: Easy management of multi-file LaTeX projects.

---

## 🛠️ Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React, TypeScript, Zustand |
| **Backend** | Rust (Tauri), Reqwest |
| **Editor** | Monaco Editor |
| **Typesetting** | Tectonic (LaTeX) |
| **AI Engine** | Ollama API |

---

## 📦 Getting Started

### Prerequisites

1.  **Rust**: [Install Rust](https://www.rust-lang.org/tools/install)
2.  **Node.js**: `pnpm` is recommended.
3.  **Tectonic**: The app uses `tectonic` as a sidecar.
4.  **Ollama**: Install and run [Ollama](https://ollama.com/).
    * *Note: If your Ollama server is remote, ensure `OLLAMA_ORIGINS="*"` is set in your environment.*

### Installation

```bash
# Clone the repository
git clone [https://github.com/your-username/fotex.git](https://github.com/your-username/fotex.git)
cd fotex

# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev