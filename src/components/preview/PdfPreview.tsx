import { useEffect, useRef, useState } from "react";
import * as tauri from "../../lib/tauri";

interface PdfPreviewProps {
  pdfPath: string | undefined;
}

function base64ToBlobUrl(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

/**
 * PdfPreview (方案 B)
 * - 不在拿到新 PDF 后立刻 revoke 旧 blob URL
 * - 等 <iframe> 新 PDF onLoad 后再 revoke 旧 URL，避免 WebView/PDF 读到一半被释放导致闪退
 * - cleanup 里只做“取消 + 延迟释放当前 URL”，不强制 setBlobUrl(undefined) 造成 iframe 抖动
 */
const REVOKE_DELAY_MS = 1500; // PDF 切换更稳，别太短

export function PdfPreview({ pdfPath }: PdfPreviewProps) {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 当前正在展示/最新生成的 blob URL
  const blobUrlRef = useRef<string | undefined>(undefined);

  // 需要在“新 iframe load 完”后再释放的旧 URL
  const prevUrlToRevokeRef = useRef<string | null>(null);

  // 用于取消过期的异步请求
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!pdfPath) {
      // 没有 PDF：清空展示（这里清空是合理的）
      setBlobUrl(undefined);
      blobUrlRef.current = undefined;

      // 也把待释放的旧 url 释放掉
      const prev = prevUrlToRevokeRef.current;
      prevUrlToRevokeRef.current = null;
      if (prev) URL.revokeObjectURL(prev);

      setLoading(false);
      setError(null);
      return;
    }

    const myRequestId = ++requestIdRef.current;
    let cancelled = false;

    setLoading(true);
    setError(null);

    tauri
      .readMainPdfBase64()
      .then((b64) => {
        if (cancelled) return;
        if (requestIdRef.current !== myRequestId) return;

        const previous = blobUrlRef.current;
        const nextUrl = base64ToBlobUrl(b64);

        // 不要立刻 revoke previous：交给 iframe onLoad 来做
        prevUrlToRevokeRef.current = previous ?? null;

        blobUrlRef.current = nextUrl;
        setBlobUrl(nextUrl);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        if (requestIdRef.current !== myRequestId) return;

        setError(String(e));
        setLoading(false);
      });

    return () => {
      cancelled = true;

      // 注意：这里不要 setBlobUrl(undefined)，避免 iframe 抖动/频繁卸载
      // 仅对“当前 url”做延迟释放：如果下一次 render 还需要它，让它先活一会儿
      const current = blobUrlRef.current;
      if (current) {
        setTimeout(() => {
          // 只在它仍然不是当前 url 时才释放，避免误杀
          if (blobUrlRef.current !== current) {
            URL.revokeObjectURL(current);
          }
        }, REVOKE_DELAY_MS);
      }
    };
  }, [pdfPath]);

  const handleIframeLoad = () => {
    // 新 PDF 加载完成后，再 revoke 旧 URL（最关键）
    const prev = prevUrlToRevokeRef.current;
    prevUrlToRevokeRef.current = null;
    if (prev) {
      // 这里可以立即 revoke；如果你还遇到崩溃，把这里也改成 setTimeout 500~1500ms
      URL.revokeObjectURL(prev);
    }
  };

  if (!pdfPath) {
    return (
      <div className="pdf-preview pdf-preview--empty">
        <p>No PDF. Compile your .tex or upload a PDF.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="pdf-preview pdf-preview--empty">
        <p>Loading PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-preview pdf-preview--empty">
        <p>Failed to load PDF: {error}</p>
      </div>
    );
  }

  if (!blobUrl) return null;

  return (
    <div className="pdf-preview">
      <iframe
        title="PDF"
        src={blobUrl}
        className="pdf-iframe"
        onLoad={handleIframeLoad}
      />
    </div>
  );
}