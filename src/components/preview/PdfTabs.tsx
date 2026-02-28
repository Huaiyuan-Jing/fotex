import { useState } from "react";
import { useProjectStore } from "../../state/useProjectStore";
import { PdfPreview } from "./PdfPreview";

export function PdfTabs() {
  const [logOpen, setLogOpen] = useState(false);
  const activePdfTab = useProjectStore((s) => s.activePdfTab);
  const setActivePdfTab = useProjectStore((s) => s.setActivePdfTab);
  const compiledPdfPath = useProjectStore((s) => s.compiledPdfPath);
  const uploadedPdfPath = useProjectStore((s) => s.uploadedPdfPath);
  const compileLog = useProjectStore((s) => s.compileLog);
  const compileStatus = useProjectStore((s) => s.compileStatus);

  const currentPath = activePdfTab === "compiled" ? compiledPdfPath : uploadedPdfPath;

  return (
    <div className="pdf-tabs">
      <div className="pdf-tabs-header">
        <button
          type="button"
          className={`pdf-tab ${activePdfTab === "compiled" && !logOpen ? "pdf-tab--active" : ""}`}
          onClick={() => { setActivePdfTab("compiled"); setLogOpen(false); }}
        >
          Preview
        </button>
        <button
          type="button"
          className={`pdf-tab ${logOpen ? "pdf-tab--active" : ""}`}
          onClick={() => setLogOpen(true)}
          title="Compile log"
        >
          Logs
        </button>
        {activePdfTab === "uploaded" && (
          <button
            type="button"
            className={`pdf-tab ${activePdfTab === "uploaded" ? "pdf-tab--active" : ""}`}
            onClick={() => { setActivePdfTab("uploaded"); setLogOpen(false); }}
          >
            Uploaded
          </button>
        )}
      </div>
      <div className="pdf-tabs-body">
        {logOpen ? (
          <div className="pdf-log-panel pdf-log-panel--full">
            <pre className="pdf-log-content">{compileLog || "No log yet."}</pre>
          </div>
        ) : (
          <PdfPreview pdfPath={currentPath} />
        )}
      </div>
    </div>
  );
}
