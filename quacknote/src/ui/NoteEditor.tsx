import CodeMirror from "@uiw/react-codemirror";
import { useMemo } from "react";
import { EditorView } from "@codemirror/view";
import { noteLanguageForPositions, unmatchedFencePositions } from "../markdown/noteLanguage";
import { liveMarkdown, liveMarkdownTheme } from "../markdown/liveMarkdown";
import { taskCheckboxes } from "../markdown/taskCheckboxes";
import { editingKeys } from "../editor/editingKeys";
import { wikiLinks } from "../links/wikiLinks";
import type { NoteTarget } from "../links/wikiLinks";
import type { Insertion } from "../markdown/imageReferences";
import { imagePreview } from "../markdown/imagePreview";


type NoteEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  editable?: boolean;
  theme?: "light" | "dark";
  notes: NoteTarget[];
  onOpenNote: (id: string) => void;
  onImages: (files: File[], selection?: Insertion) => void;
  folder: string | null;
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
  editable = true,
  theme = "dark",
  notes,
  onOpenNote,
  onImages,
  folder,
}: NoteEditorProps) {
  // Ordinary typing should not reconfigure the editor. Only rebuild the
  // language when the positions of unmatched code fences actually change.
  const fenceKey = JSON.stringify(unmatchedFencePositions(value));
  const language = useMemo(
    () => noteLanguageForPositions(JSON.parse(fenceKey) as number[]),
    [fenceKey],
  );
  // Changing note contents must not rebuild completion configuration.
  const noteKey = JSON.stringify(notes.map(({ id, title }) => ({ id, title })));
  const links = useMemo(() => wikiLinks(JSON.parse(noteKey) as NoteTarget[], onOpenNote), [noteKey, onOpenNote]);
  const imageInput = useMemo(() => EditorView.domEventHandlers({
    paste(event, view) {
      if (view.state.readOnly || !view.state.facet(EditorView.editable)) return false;
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (!files.length) return false;
      event.preventDefault();
      onImages(files, view.state.selection.main);
      return true;
    },
    dragover(event, view) {
      if (!view.state.facet(EditorView.editable) || !event.dataTransfer?.types.includes("Files")) return false;
      event.preventDefault();
      return true;
    },
    drop(event, view) {
      if (!view.state.facet(EditorView.editable)) return false;
      const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
      if (!files.length) return false;
      event.preventDefault();
      const position = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
      onImages(files, { from: position, to: position });
      return true;
    },
  }), [onImages]);
  const images = useMemo(() => imagePreview(folder), [folder]);
  const editorExtensions = useMemo(() => [language, links, imageInput, images, ...extensions], [language, links, imageInput, images]);
  return (
    <CodeMirror
      theme={theme}
      editable={editable}
      value={value}
      extensions={editorExtensions}
      onChange={onChange}
      placeholder="Start writing..."
      basicSetup={basicSetup}
    />
  );
}
