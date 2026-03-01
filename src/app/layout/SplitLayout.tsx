import { LatexEditor } from "../../components/editor/LatexEditor";
import { PdfTabs } from "../../components/preview/PdfTabs";
import { AssistantPanel } from "../../components/assistant/AssistantPanel";
import { AppHeader } from "../../components/layout/AppHeader";
import { FileTree } from "../../components/filetree/FileTree";
import { StatusBar } from "../../components/common/StatusBar";
import { Toast } from "../../components/common/Toast";
import "../../App.css";

export function SplitLayout() {
  return (
    <div className="split-layout">
      <AppHeader />
      
      {/* 核心主区域，改为左右两半 */}
      <div className="split-main">
        
        {/* ================= 左半屏 ================= */}
        <div className="split-left-workspace">
          {/* 左侧上半部分：文件树 + 代码编辑器 */}
          <div className="split-left-top">
            <aside className="split-sidebar">
              <FileTree />
            </aside>
            <div className="split-editor">
              <LatexEditor />
            </div>
          </div>
          
          {/* 左侧下半部分：AI 对话框 (长度仅与左屏等宽) */}
          <div className="split-assistant-bottom">
            <AssistantPanel />
          </div>
        </div>

        {/* ================= 右半屏 ================= */}
        <div className="split-right-workspace">
          <div className="split-preview">
            <PdfTabs />
          </div>
        </div>

      </div>

      <StatusBar />
      <Toast />
    </div>
  );
}