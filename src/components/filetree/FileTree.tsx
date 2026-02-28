import { useState, useEffect } from "react";
import { useProjectStore } from "../../state/useProjectStore";
import * as tauri from "../../lib/tauri";

interface FileTreeItemProps {
  node: tauri.FileNode;
  level: number;
  onOpenFile?: (path: string) => void;
}

function FileTreeItem({ node, level, onOpenFile }: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const texPath = useProjectStore((s) => s.texPath);
  const isActive = !node.is_dir && texPath === node.path;

  if (node.is_dir) {
    return (
      <div className="file-tree-folder" style={{ paddingLeft: level * 12 }}>
        <button
          type="button"
          className="file-tree-toggle"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          <span className="file-tree-chevron">{expanded ? "▼" : "▶"}</span>
          <span className="file-tree-icon">📁</span>
          <span className="file-tree-name">{node.name}</span>
        </button>
        {expanded && node.children.length > 0 && (
          <div className="file-tree-children">
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                level={level + 1}
                onOpenFile={onOpenFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`file-tree-file ${isActive ? "file-tree-file--active" : ""}`}
      style={{ paddingLeft: level * 12 }}
      onClick={() => onOpenFile?.(node.path)}
    >
      <span className="file-tree-icon">📄</span>
      <span className="file-tree-name">{node.name}</span>
    </button>
  );
}

export function FileTree() {
  const workspaceDir = useProjectStore((s) => s.workspaceDir);
  const openFile = useProjectStore((s) => s.openFile);
  const [root, setRoot] = useState<tauri.FileNode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceDir) {
      setRoot(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    tauri
      .readFolder(workspaceDir)
      .then((tree) => {
        if (!cancelled) setRoot(tree);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceDir]);

  const handleOpenFile = async (path: string) => {
    try {
      const { content } = await tauri.readTextFile({ path });
      const dir = path.replace(/[\\/][^\\/]*$/, "") || workspaceDir;
      useProjectStore.setState({
        texPath: path,
        workspaceDir: dir || undefined,
        texContent: content,
        dirty: false,
      });
    } catch (e) {
      useProjectStore.getState().setToast(String(e), "error");
    }
  };

  return (
    <div className="file-tree">
      <div className="file-tree-toolbar">
        <span className="file-tree-title">File tree</span>
        <div className="file-tree-actions">
          <button type="button" className="file-tree-btn" title="Search">🔍</button>
          <button type="button" className="file-tree-btn" title="New">+</button>
          <button type="button" className="file-tree-btn" title="More">⋯</button>
        </div>
      </div>
      <div className="file-tree-body">
        {!workspaceDir && (
          <p className="file-tree-empty">
            Open a .tex file (File → Open) to see the file tree.
          </p>
        )}
        {workspaceDir && error && (
          <p className="file-tree-error">{error}</p>
        )}
        {workspaceDir && root && !error && (
          <FileTreeItem node={root} level={0} onOpenFile={handleOpenFile} />
        )}
      </div>
      <div className="file-tree-outline">
        <button type="button" className="file-tree-outline-btn">
          <span className="file-tree-chevron">▶</span> File outline
        </button>
      </div>
    </div>
  );
}
