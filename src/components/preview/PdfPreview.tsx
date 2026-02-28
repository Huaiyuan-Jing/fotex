import { openPath } from "@tauri-apps/plugin-opener";

interface PdfPreviewProps {
  pdfPath: string | undefined;
}

export function PdfPreview({ pdfPath }: PdfPreviewProps) {
  if (!pdfPath) {
    return (
      <div className="pdf-preview pdf-preview--empty">
        <p>No PDF. Compile your .tex or upload a PDF.</p>
      </div>
    );
  }
  const handleOpenPdf = () => {
    openPath(pdfPath).catch((e) => console.error("Open PDF failed:", e));
  };
  return (
    <div className="pdf-preview pdf-preview--external">
      <p className="pdf-preview__hint">PDF compiled. Open in system viewer to preview.</p>
      <button type="button" className="pdf-preview__open-btn" onClick={handleOpenPdf}>
        Open PDF
      </button>
    </div>
  );
}
