export type Note = { id: string; title: string; content: string };
export type Notebook = { notes: Note[]; activeId: string };
export const notebookKey = "quacknote.notebook";

export function copyNotesForImport(notes: Note[]): Note[] {
  // New identities prevent imported notes from being confused with files
  // already open in the destination folder, even when titles match.
  return notes.map((note) => ({ ...createNote(note.content), title: note.title }));
}

export function createNote(content = ""): Note {
  return {
    id: crypto.randomUUID(),
    title: content.split("\n").find((line) => line.trim())
      ?.replace(/^#+\s*/, "").slice(0, 80) || "Untitled note",
    content,
  };
}

export function loadNotebook(storage: Pick<Storage, "getItem">): Notebook {
  try {
    const saved: unknown = JSON.parse(storage.getItem(notebookKey) ?? "null");
    if (saved && typeof saved === "object" && "notes" in saved &&
      Array.isArray(saved.notes) && saved.notes.length > 0 &&
      saved.notes.every((note) => note && typeof note.id === "string" &&
        typeof note.title === "string" && typeof note.content === "string")) {
      const notes = saved.notes as Note[];
      const activeId = "activeId" in saved && typeof saved.activeId === "string" &&
        notes.some((note) => note.id === saved.activeId) ? saved.activeId : notes[0].id;
      return { notes, activeId };
    }
  } catch {
    // Keep the original single note available when migrating older data.
  }
  const note = createNote(storage.getItem("notes") ?? "");
  return { notes: [note], activeId: note.id };
}
