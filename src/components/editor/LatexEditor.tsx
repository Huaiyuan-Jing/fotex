import { useRef, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { useProjectStore } from "../../state/useProjectStore";

export function LatexEditor() {
  const editorRef = useRef<Parameters<NonNullable<Parameters<typeof Editor>[0]["onMount"]>>[0] | null>(null);
  const texContent = useProjectStore((s) => s.texContent);
  const setTexContent = useProjectStore((s) => s.setTexContent);
  const setSelection = useProjectStore((s) => s.setSelection);
  const setCursorContext = useProjectStore((s) => s.setCursorContext);
  const pendingReplaceSelection = useProjectStore((s) => s.pendingReplaceSelection);
  const pendingInsertAtCursor = useProjectStore((s) => s.pendingInsertAtCursor);
  const clearPendingReplace = useProjectStore((s) => s.clearPendingReplace);
  const clearPendingInsert = useProjectStore((s) => s.clearPendingInsert);
  const handleBeforeMount = (monaco: Parameters<NonNullable<Parameters<typeof Editor>[0]["beforeMount"]>>[0]) => {
    const hasLang = monaco.languages.getLanguages().some((l: any) => l.id === 'latex');
    if (!hasLang) {
      monaco.languages.register({ id: 'latex' });
      monaco.languages.setMonarchTokensProvider('latex', {
        tokenizer: {
          root: [
            [/%.*/, 'comment'],
            [/\\[a-zA-Z@]+/, 'keyword'],
            [/\\./, 'keyword'],
            [/[$]/, 'string'],
            [/[{}()[\]]/, '@brackets'],
          ]
        }
      });
    }
  };
  const onMount = useCallback(
    (editor: Parameters<NonNullable<Parameters<typeof Editor>[0]["onMount"]>>[0]) => {
      editorRef.current = editor;
      editor.updateOptions({
        wordWrap: "on",
        fontSize: 14,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        tabSize: 2,
        insertSpaces: true,
      });
      const sel = editor.getSelection();
      if (sel) {
        const text = editor.getModel()?.getValueInRange(sel) ?? "";
        setSelection(text || undefined);
      }
      editor.onDidChangeCursorSelection(() => {
        const sel = editor.getSelection();
        if (sel) {
          const text = editor.getModel()?.getValueInRange(sel) ?? "";
          setSelection(text || undefined);
        }
      });
      editor.onDidChangeCursorPosition(() => {
        const model = editor.getModel();
        if (!model) return;
        const pos = editor.getPosition();
        if (!pos) return;
        const lineCount = model.getLineCount();
        const before = Math.max(1, pos.lineNumber - 15);
        const after = Math.min(lineCount, pos.lineNumber + 5);
        const lines: string[] = [];
        for (let i = before; i <= after; i++) {
          lines.push(model.getLineContent(i));
        }
        setCursorContext(lines.join("\n"));
      });
    },
    [setSelection, setCursorContext]
  );

  useEffect(() => {
    if (!editorRef.current || !pendingReplaceSelection) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits("formula", [
        { range: selection, text: pendingReplaceSelection },
      ]);
    }
    clearPendingReplace();
  }, [pendingReplaceSelection, clearPendingReplace]);

  useEffect(() => {
    if (!editorRef.current || !pendingInsertAtCursor) return;
    const editor = editorRef.current;
    const position = editor.getPosition();
    if (position) {
      editor.executeEdits("complete", [
        {
          range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column },
          text: pendingInsertAtCursor,
        },
      ]);
    }
    clearPendingInsert();
  }, [pendingInsertAtCursor, clearPendingInsert]);

  return (
    <div className="latex-editor">
      <Editor
        height="100%"
        language="latex"
        theme="vs-dark"
        value={texContent}
        onChange={(value) => setTexContent(value ?? "")}
        beforeMount={handleBeforeMount}
        onMount={onMount}
        options={{
          wordWrap: "on",
          fontSize: 14,
          minimap: { enabled: false },
        }}
      />
    </div>
  );
}
