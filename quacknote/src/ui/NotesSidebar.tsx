import { useState } from "react";
import type { Note } from "../notes";
import Icon from "./Icon";
type NotesSidebarProps = {
  notes: Note[];
  activeId: string;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onHide: () => void;
  onSettings: () => void;
  folder: string | null;
  disabled: boolean;
};
export default function NotesSidebar({ notes, activeId, onSelect, onCreate,
  onHide, onSettings, folder, disabled }: NotesSidebarProps) {
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = notes.filter((note) => note.title.toLowerCase().includes(query.toLowerCase()));
  const folderName = folder?.split(/[\\/]/).filter(Boolean).slice(-1)[0] || "Notes";
  return (
    <aside id="notes-sidebar" className="notes-sidebar" aria-label="Notes">
      <div className="sidebar-toolbar">
        <span className="icon-button selected-tool" title="Notes"><Icon name="folder" /></span>
        <button className="icon-button" aria-label="Search notes" aria-pressed={searching}
          onClick={() => { setSearching((value) => !value); setQuery(""); }}><Icon name="search" /></button>
        <button className="icon-button" aria-label="New note" disabled={disabled} onClick={onCreate}><Icon name="plus" /></button>
        <button className="icon-button sidebar-hide" aria-label="Hide notes" onClick={onHide}><Icon name="panel" /></button>
      </div>
      {searching && <input className="notes-search" autoFocus aria-label="Search notes" placeholder="Search notes…"
        value={query} onChange={(event) => setQuery(event.target.value)} />}
      <div className="sidebar-folder" title={folder || "Notes"}><span aria-hidden="true">⌄</span> {folderName}</div>
      <nav className="notes-navigation" aria-label="Note list">
        <ul className="notes-list">{filtered.map((note) => (
          <li key={note.id}><button type="button" className="note-link" disabled={disabled}
            aria-current={note.id === activeId ? "page" : undefined} title={note.title || "Untitled note"}
            onClick={() => onSelect(note.id)}>{note.title || "Untitled note"}</button></li>
        ))}</ul>
        {!filtered.length && <p className="no-notes">No matching notes</p>}
      </nav>
      <footer className="sidebar-footer">
        <span><Icon name="folder" /> {folderName}</span>
        <button className="icon-button" aria-label="Open settings" onClick={onSettings}><Icon name="settings" /></button>
      </footer>
    </aside>
  );
}
