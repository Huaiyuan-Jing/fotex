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
      <div className="split-main">
        <aside className="split-sidebar">
          <FileTree />
        </aside>
        <div className="split-editor">
          <LatexEditor />
        </div>
        <div className="split-preview">
          <PdfTabs />
        </div>
      </div>
      <div className="split-assistant-bottom">
        <AssistantPanel />
      </div>
      <StatusBar />
      <Toast />
    </div>
  );
}
