import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";
import { EditorView } from "@codemirror/view";
import { noteLanguageForPositions, unmatchedFencePositions } from "./markdown/noteLanguage";
import { liveMarkdown, liveMarkdownTheme } from "./markdown/liveMarkdown";
import { taskCheckboxes } from "./markdown/taskCheckboxes";
import { editingKeys } from "./markdown/editingKeys";


type NoteEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
};

// Configure these once, outside the component.
const extensions = [
  liveMarkdown,
  liveMarkdownTheme,
  taskCheckboxes(),
  editingKeys,
  EditorView.lineWrapping,
];
const basicSetup = {
  lineNumbers: false,
  highlightSelectionMatches: false,
};

export default function NoteEditor({
  value,
  onChange,
}: NoteEditorProps) {
  // Ordinary typing should not reconfigure the editor. Only rebuild the
  // language when the positions of unmatched code fences actually change.
  const fenceKey = JSON.stringify(unmatchedFencePositions(value));
  const language = useMemo(
    () => noteLanguageForPositions(JSON.parse(fenceKey) as number[]),
    [fenceKey],
  );
  const editorExtensions = useMemo(() => [language, ...extensions], [language]);
  return (
    <CodeMirror
      theme="dark"
      value={value}
      extensions={editorExtensions}
      onChange={onChange}
      placeholder="Start writing..."
      basicSetup={basicSetup}
    />
  );
}
