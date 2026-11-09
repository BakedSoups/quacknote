import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { copyNotesForImport, createNote, loadNotebook, notebookKey } from "./notes";
import type { Note, Notebook } from "./notes";
import { insertAttachments, noteAttachments } from "./markdown/imageReferences";
import { migrateAttachments } from "./attachments/attachmentStorage";
import { uploadImages } from "./attachments/images";
import type { Insertion } from "./markdown/imageReferences";

type Folder = { path: string; notes: Note[] };
const folderKey = "quacknote.folder";
const fingerprint = (note: Note) => JSON.stringify([note.title, note.content]);

export function useNotebook() {
  const [notebook, setNotebook] = useState(() => loadNotebook(localStorage));
  const [folder, setFolder] = useState<string | null>(null);
  const [busy, setBusy] = useState(() => isTauri() && !!localStorage.getItem(folderKey));
  const [status, setStatus] = useState("Choose a folder to save Markdown files");
  const [error, setError] = useState("");
  const [imported, setImported] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const pendingImages = useRef<Promise<void>>(Promise.resolve());
  const current = useRef({ notebook, folder });
  current.current = { notebook, folder };
  const saved = useRef(new Map<string, string>());
  const queue = useRef<Promise<void>>(Promise.resolve());

  // Serialize writes so a slower, older save cannot replace a newer edit.
  const flush = useCallback(async () => {
    await pendingImages.current;
    const snapshot = current.current;
    if (!snapshot.folder) return Promise.resolve();
    const operation = queue.current.catch(() => {}).then(async () => {
      for (const note of snapshot.notebook.notes) {
        const version = fingerprint(note);
        if (saved.current.get(note.id) === version) continue;
        setStatus("Saving…");
        await invoke("save_markdown_note", { id: note.id, title: note.title, content: note.content });
        saved.current.set(note.id, version);
      }
      setError("");
      setStatus("Saved to folder");
    });
    queue.current = operation;
    return operation;
  }, []);

  const activate = useCallback((selected: Folder) => {
    saved.current = new Map(selected.notes.map((note) => [note.id, fingerprint(note)]));
    const notes = selected.notes.length ? selected.notes : [createNote()];
    const activeId = localStorage.getItem("quacknote.activeNote");
    const next: Notebook = {
      notes,
      activeId: notes.some((note) => note.id === activeId) ? activeId! : notes[0].id,
    };
    setNotebook(next);
    setFolder(selected.path);
    localStorage.setItem(folderKey, selected.path);
    setImported(false);
    setError("");
    setStatus("Saved to folder");
  }, []);

  useEffect(() => {
    const path = localStorage.getItem(folderKey);
    if (!isTauri() || !path) return;
    let cancelled = false;
    invoke<Folder>("reopen_notes_folder", { path })
      .then((selected) => { if (!cancelled) activate(selected); })
      .catch((reason) => { if (!cancelled) setError(`Could not reopen your folder: ${String(reason)}`); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [activate]);

  useEffect(() => {
    if (busy) return;
    if (!folder) {
      // Keep the old notes as a migration source until a folder is selected.
      localStorage.setItem(notebookKey, JSON.stringify(notebook));
      return;
    }
    localStorage.setItem("quacknote.activeNote", notebook.activeId);
    if (notebook.notes.every((note) => saved.current.get(note.id) === fingerprint(note))) return;
    setStatus("Unsaved changes");
    const timer = setTimeout(() => {
      void flush().catch((reason) => {
        setError(String(reason));
        setStatus("Not saved — retry when ready");
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [notebook, folder, busy, flush]);

  useEffect(() => {
    if (!isTauri()) return;
    // Flush pending edits before closing the native window.
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const window = getCurrentWindow();
      const stop = await window.onCloseRequested(async (event) => {
        event.preventDefault();
        try {
          await flush();
          await window.destroy();
        } catch (reason) {
          setError(`Could not save before closing: ${String(reason)}`);
        }
      });
      if (disposed) stop(); else unlisten = stop;
    }).catch((reason) => setError(String(reason)));
    return () => { disposed = true; unlisten?.(); };
  }, [flush]);

  const chooseFolder = useCallback(async () => {
    if (!isTauri()) {
      setError("Folder access requires the desktop app. Start it with npm run tauri dev.");
      return;
    }
    setBusy(true);
    try {
      await flush();
      const selected = await invoke<Folder | null>("choose_notes_folder");
      if (selected) activate(selected);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }, [flush, activate]);

  async function importExisting() {
    if (!folder) return;
    setBusy(true);
    try {
      await flush();
      const previous = loadNotebook(localStorage);
      for (const note of previous.notes) await migrateAttachments(noteAttachments(note.content), folder);
      const copies = copyNotesForImport(previous.notes);
      setNotebook((current) => ({ notes: [...current.notes, ...copies], activeId: copies[0].id }));
      setImported(true);
    } catch (reason) { setError(`Could not import notes and images: ${String(reason)}`); }
    finally { setBusy(false); }
  }

  const addImages = useCallback((files: File[], selection?: Insertion) => {
    const snapshot = current.current;
    const note = snapshot.notebook.notes.find((note) => note.id === snapshot.notebook.activeId)!;
    setAttaching(true);
    const operation = pendingImages.current.then(async () => {
      const attachments = await uploadImages(files, note.content, snapshot.folder);
      const latest = current.current;
      const next = { ...latest.notebook, notes: latest.notebook.notes.map((item) => item.id === note.id
        ? { ...item, content: insertAttachments(item.content, attachments, item.content === note.content ? selection : undefined) }
        : item) };
      // Closing or changing folders waits for this operation and then flushes
      // this updated snapshot, including the new image references.
      current.current = { ...latest, notebook: next };
      setNotebook(next);
      setError("");
    }).catch((reason) => setError(`Could not add images: ${String(reason)}`));
    pendingImages.current = operation;
    void operation.finally(() => {
      if (pendingImages.current === operation) setAttaching(false);
    });
    return operation;
  }, []);

  function retry() {
    void flush().catch((reason) => setError(String(reason)));
  }

  return { notebook, setNotebook, folder, busy: busy || attaching, status, error, imported,
    chooseFolder, importExisting, retry, addImages };
}
