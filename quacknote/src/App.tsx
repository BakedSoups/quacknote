import { useCallback, useState } from "react";
import NoteEditor from "./NoteEditor";
export default function App() {
  const [notes, setNotes] = useState(
    () => localStorage.getItem("notes") ?? ""
  );

  const updateNotes = useCallback((markdown: string) => {
    setNotes(markdown);
    localStorage.setItem("notes", markdown);
  }, []);

  return (
    <main>
      <h1>Quack Note</h1>

      <NoteEditor
        value={notes}
        onChange={updateNotes}
      />

    </main>
  );
}
