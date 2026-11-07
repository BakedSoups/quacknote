import { useState } from "react";
import NoteEditor from "./NoteEditor";
import MarkdownPreview from "./MarkdownPreview";
export default function App() {
  const [notes, setNotes] = useState(
    () => localStorage.getItem("notes") ?? ""
  );

  function updateNotes(markdown: string) {
    setNotes(markdown);
    localStorage.setItem("notes", markdown);
  }

  return (
    <main>
      <h1>Quack Note</h1>

      <NoteEditor
        value={notes}
        onChange={updateNotes}
      />

      <h2>Preview</h2>
      <MarkdownPreview value={notes} onChange={updateNotes} />
    </main>
  );
}
