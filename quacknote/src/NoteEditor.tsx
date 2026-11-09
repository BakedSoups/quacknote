import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView } from "@codemirror/view";
import { pythonLanguage } from "@codemirror/lang-python";
import { liveMarkdown, liveMarkdownTheme } from "./markdown/liveMarkdown";
import { taskCheckboxes } from "./markdown/taskCheckboxes";


type NoteEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
};

// Configure these once, outside the component.
const extensions = [
  markdown({  
    // CodeMirror uses a Python parser inside fences labelled python or py.
    codeLanguages: (name) => /^(python|py)$/i.test(name) ? pythonLanguage : null,
  }),
  liveMarkdown,
  liveMarkdownTheme,
  taskCheckboxes(),
  EditorView.lineWrapping,
];

export default function NoteEditor({
  value,
  onChange,
}: NoteEditorProps) {
  return (
    <CodeMirror
      theme="dark"
      value={value}
      extensions={extensions}
      onChange={(updatedText) => onChange(updatedText)}
      placeholder="Start writing..."
      basicSetup={{ lineNumbers: false }}
    />
  );
}
