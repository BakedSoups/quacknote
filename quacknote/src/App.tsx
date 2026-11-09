import { useCallback, useEffect, useState } from "react";
import NoteEditor from "./ui/NoteEditor";
import NotesSidebar from "./ui/NotesSidebar";
import Settings from "./ui/Settings";
import Proofreading from "./tools/Proofreading";
import AttachmentStack from "./ui/AttachmentStack";
import { noteAttachments, resizeAttachment } from "./markdown/imageReferences";
import { loadProofreading, proofreadingKey } from "./tools/proofreading";
import Icon from "./ui/Icon";
import { createNote } from "./notes";
import { useNotebook } from "./useNotebook";
import duck from "./assets/duck.svg";
import { useFullscreen } from "./ui/useFullscreen";
export default function App() {
  // This hook manages note data, file saving, folder selection, and images.
  // App connects those operations to the components shown on screen.
  const { notebook, setNotebook, folder, busy, status, error, imported,
    chooseFolder, importExisting, retry, addImages } = useNotebook();
  // State controls what is visible. Calling a setter makes React render again.
  // The initializer function restores the sidebar preference when App mounts.
  const [showNotes, setShowNotes] = useState(() => localStorage.getItem("quacknote.showNotes") !== "false");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [proofreadingOpen, setProofreadingOpen] = useState(false);
  const [stackOpen, setStackOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toolError, setToolError] = useState("");
  const { fullscreen, toggle: toggleFullscreen } = useFullscreen(setToolError);
  // Pass the function itself so React loads these settings during initialization.
  const [proofreading, setProofreading] = useState(loadProofreading);
  const [theme, setTheme] = useState<"light" | "dark">(
    () => localStorage.getItem("quacknote.theme") === "light" ? "light" : "dark",
  );
  // Derive the selected note from the notebook instead of storing a second copy.
  // The ! tells TypeScript that the notebook always contains its active note.
  const activeNote = notebook.notes.find((note) => note.id === notebook.activeId)!;
  // Effects run after rendering when their listed dependencies change.
  // These save preferences; useNotebook handles saving the actual notes.
  useEffect(() => { localStorage.setItem(proofreadingKey, JSON.stringify(proofreading)); }, [proofreading]);
  useEffect(() => { localStorage.setItem("quacknote.showNotes", String(showNotes)); }, [showNotes]);
  useEffect(() => {
    // CSS reads data-theme on the <html> element to choose its color palette.
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("quacknote.theme", theme);
  }, [theme]);
  // Keep this callback stable between renders unless its dependencies change,
  // avoiding unnecessary reconfiguration of the CodeMirror editor.
  const updateNotes = useCallback((markdown: string) => {
    // Read the latest notebook and replace only the edited note.
    // Spread syntax copies existing fields; map creates a new notes array.
    setNotebook((current) => ({ ...current, notes: current.notes.map((note) =>
      note.id === notebook.activeId ? { ...note, content: markdown } : note) }));
  }, [notebook.activeId, setNotebook]);
  const openNote = useCallback((activeId: string) => {
    // Ignore links to notes that no longer exist.
    setNotebook((current) => current.notes.some((note) => note.id === activeId)
      ? { ...current, activeId } : current);
  }, [setNotebook]);
  function newNote() {
    // Add a blank note and select it in the same state update.
    const note = createNote();
    setNotebook((current) => ({ notes: [...current.notes, note], activeId: note.id }));
  }
  async function downloadPdf() {
    setExporting(true); setToolError("");
    try {
      // Load the PDF export code only when requested, then prepare print output.
      const { exportPdf } = await import("./tools/exportPdf");
      await exportPdf(activeNote, folder);
    } catch (reason) { setToolError(`Could not export PDF: ${String(reason)}`); }
    finally { setExporting(false); }
  }
  return (
    <main className={`workspace${showNotes ? " with-sidebar" : ""}`}>
      {/* Conditional rendering: the sidebar exists only while showNotes is true. */}
      {showNotes && <NotesSidebar notes={notebook.notes} activeId={notebook.activeId}
        onSelect={(activeId) => setNotebook((current) => ({ ...current, activeId }))}
        onCreate={newNote} onHide={() => setShowNotes(false)}
        onSettings={() => setSettingsOpen(true)} folder={folder} disabled={busy} />}
      <section className="note-pane" aria-label="Current note">
        {/* The top bar opens tools and toggles the current note's image stack. */}
        <header className="tab-bar">
          <img className="app-duck" src={duck} alt="Quack Note" />
          {!showNotes && <button className="icon-button" aria-label="Show notes" aria-controls="notes-sidebar"
            onClick={() => setShowNotes(true)}><Icon name="panel" /></button>}
          <div className="tab-spacer" />
          <details className="tools-menu" onKeyDown={(event) => {
            if (event.key === "Escape") event.currentTarget.open = false;
          }}>
            <summary><Icon name="tools" /> Tools</summary>
            <div className="tools-dropdown"><button disabled={busy} onClick={(event) => {
              event.currentTarget.closest("details")?.removeAttribute("open");
              setProofreadingOpen(true);
            }}>Auto correct<span>Spelling &amp; grammar</span></button>
              <button disabled={busy || exporting} onClick={(event) => {
                event.currentTarget.closest("details")?.removeAttribute("open");
                void downloadPdf();
              }}>{exporting ? "Preparing PDF…" : "Export as PDF"}<span>Choose Save as PDF in the print dialog</span></button>
            </div>
          </details>
          <button className={`stack-toggle${stackOpen ? " active" : ""}`} aria-expanded={stackOpen}
            aria-controls="attachment-stack" onClick={() => setStackOpen((open) => !open)}>
            <Icon name="stack" /> Stack <span>{noteAttachments(activeNote.content).length}</span>
          </button>
          {!showNotes && <button className="icon-button" aria-label="Open settings"
            onClick={() => setSettingsOpen(true)}><Icon name="settings" /></button>}
          <button className="icon-button fullscreen-toggle" aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={fullscreen ? "Exit fullscreen (F11 or Escape)" : "Fullscreen (F11)"}
            aria-pressed={fullscreen} onClick={() => void toggleFullscreen()}>
            <Icon name={fullscreen ? "minimize" : "fullscreen"} />
          </button>
        </header>
        {/* Surface storage and tool failures so unsaved work is not overlooked. */}
        {error && <div className="error-banner" role="alert">{error}
          {folder && <button disabled={busy} onClick={retry}>Retry save</button>}</div>}
        {toolError && <div className="error-banner" role="alert">{toolError}</div>}
        <div className="note-body">
        <div className="note-scroll"><div className="note-document">
          {/* A controlled input: value displays state; onChange updates it. */}
          <input className="note-title" aria-label="Note title" value={activeNote.title}
            disabled={busy} placeholder="Untitled note" onChange={(event) => {
              const title = event.target.value;
              setNotebook((current) => ({ ...current, notes: current.notes.map((note) =>
                note.id === activeNote.id ? { ...note, title } : note) }));
            }} />
          {/* A different key creates a new editor when switching notes, keeping
              one note's undo history from being applied to another note. */}
          <NoteEditor key={activeNote.id} value={activeNote.content} onChange={updateNotes}
            editable={!busy} theme={theme} notes={notebook.notes} onOpenNote={openNote} onImages={addImages} folder={folder} />
        </div></div>
        {/* The stack reads image references from this note's Markdown. */}
        {stackOpen && <AttachmentStack note={activeNote} folder={folder} disabled={busy}
          onResize={(path, width) => setNotebook((current) => ({ ...current,
            notes: current.notes.map((note) => note.id === activeNote.id
              ? { ...note, content: resizeAttachment(note.content, path, width) } : note) }))}
          onAdd={(files) => void addImages(files)} onClose={() => setStackOpen(false)} />}
        </div>
        <footer className="editor-status" role="status">{busy ? "Opening folder…" : folder ? status : "Local notes"}</footer>
      </section>
      {/* Dialogs receive current values and callbacks through props. Closing a
          dialog changes its visibility state and removes it from the screen. */}
      {settingsOpen && <Settings theme={theme} onThemeChange={setTheme} folder={folder} busy={busy}
        onChooseFolder={chooseFolder} onImport={importExisting} imported={imported} error={error}
        proofreading={proofreading} onProofreadingChange={setProofreading}
        onClose={() => setSettingsOpen(false)} />}
      {/* Apply suggestions only if the note still matches the checked text,
          preventing an older result from overwriting newer edits. */}
      {proofreadingOpen && <Proofreading note={activeNote} config={proofreading} onConfigChange={setProofreading}
        onApply={(id, original, updated) => setNotebook((current) => ({ ...current,
          notes: current.notes.map((note) => note.id === id && note.content === original
            ? { ...note, content: updated } : note) }))}
        onClose={() => setProofreadingOpen(false)} />}
    </main>
  );
}
