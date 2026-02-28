import { useState, useRef, useEffect } from "react";
import { useProjectStore } from "../../state/useProjectStore";

export function AppHeader() {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);
  const compile = useProjectStore((s) => s.compile);
  const openFile = useProjectStore((s) => s.openFile);
  const saveFile = useProjectStore((s) => s.saveFile);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false);
      }
    };
    if (fileMenuOpen) {
      document.addEventListener("click", onOutside);
      return () => document.removeEventListener("click", onOutside);
    }
  }, [fileMenuOpen]);

  return (
    <header className="app-header">
      <div className="app-header-left">
        <span className="app-logo">FoTex</span>
        <nav className="app-menu">
          <div className="app-menu-item-wrap" ref={fileMenuRef}>
            <span
              className="app-menu-item"
              onClick={() => setFileMenuOpen((o) => !o)}
              role="button"
              tabIndex={0}
            >
              File
            </span>
            {fileMenuOpen && (
              <div className="app-menu-dropdown">
                <button type="button" onClick={() => { openFile(); setFileMenuOpen(false); }}>
                  Open
                </button>
                <button type="button" onClick={() => { saveFile(); setFileMenuOpen(false); }}>
                  Save
                </button>
              </div>
            )}
          </div>
          <span className="app-menu-item">Edit</span>
          <span className="app-menu-item">Insert</span>
          <span className="app-menu-item">View</span>
          <span className="app-menu-item">Format</span>
          <span className="app-menu-item">Help</span>
        </nav>
      </div>
      <div className="app-header-right">
        <div className="app-header-compile-btn-wrap">
          <button
            type="button"
            className="app-header-compile-btn"
            onClick={compile}
            title="Compile"
          >
            Compile
          </button>
          <span className="app-header-compile-chevron" aria-hidden>▼</span>
        </div>
        <button type="button" className="app-header-icon" title="Theme">
          <span className="app-icon-sun" aria-hidden>☀</span>
        </button>
        <button type="button" className="app-header-icon" title="Settings">
          <span aria-hidden>⚙</span>
        </button>
      </div>
    </header>
  );
}
