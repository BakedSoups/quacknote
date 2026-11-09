import { useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import ProofreadingOptions from "./ProofreadingOptions";
import { applySuggestions, checkNote } from "./proofreading";
import type { ProofreadingConfig, Suggestion } from "./proofreading";
import type { Note } from "../notes";

export default function Proofreading({ note, config, onConfigChange, onApply, onClose }: {
  note: Note; config: ProofreadingConfig;
  onConfigChange: (config: ProofreadingConfig) => void;
  onApply: (id: string, original: string, updated: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ source: string; matches: Suggestion[] } | null>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); request.current?.abort(); request.current = null; };
  }, []);
  useEffect(() => {
    request.current?.abort();
    request.current = null;
    setResult(null);
    setError("");
    setChecking(false);
  }, [note.id, note.content, config]);

  async function check() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 30000);
    setChecking(true); setError(""); setResult(null);
    try {
      const matches = await checkNote(note.content, config, controller.signal);
      if (!controller.signal.aborted) setResult({ source: note.content, matches });
    } catch (reason) {
      if (request.current === controller) setError(controller.signal.aborted ? "The check timed out. Try again when the server is ready."
        : config.mode === "local" ? `Local check failed. Make sure Docker is running and the endpoint is correct. ${String(reason)}` : String(reason));
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setChecking(false);
    }
  }
  function apply(matches: Suggestion[]) {
    if (!result || result.source !== note.content) return;
    onApply(note.id, result.source, applySuggestions(result.source, matches));
    setResult(null);
  }
  return <dialog ref={dialog} className="settings-dialog proofreading-dialog" aria-labelledby="proofreading-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="settings-content">
      <header className="settings-header"><div><span className="eyebrow">TOOLS</span><h2 id="proofreading-title">Auto correct</h2></div>
        <button className="icon-button" aria-label="Close auto correct" onClick={onClose}><Icon name="close" /></button></header>
      <p className="proofreading-description">Check spelling and grammar in “{note.title || "Untitled note"}”, then choose corrections to apply.</p>
      <ProofreadingOptions config={config} onChange={onConfigChange} disabled={checking} />
      <div className="proofreading-actions"><button className="primary-button" disabled={checking || !note.content.trim()}
        onClick={() => void check()}>{checking ? "Checking…" : "Check note"}</button>
        {result && result.matches.some((match) => match.replacements.length) &&
          <button onClick={() => apply(result.matches)}>Apply all first suggestions</button>}
      </div>
      {error && <p className="save-error" role="alert">{error}</p>}
      {result && <div role="status">{result.matches.length ? `${result.matches.length} suggestions` : "No issues found."}</div>}
      <ul className="suggestion-list">{result?.matches.map((match, index) => <li key={index}>
        <p>{match.message}</p><q>{result.source.slice(Math.max(0, match.offset - 30), match.offset)}<mark>{result.source.slice(match.offset, match.offset + match.length)}</mark>{result.source.slice(match.offset + match.length, match.offset + match.length + 30)}</q>
        <div className="suggestion-replacements">{match.replacements.slice(0, 5).map((replacement, index) =>
          <button key={index} onClick={() => apply([{ ...match, replacements: [replacement] }])}>{replacement || "Remove"}</button>)}</div>
      </li>)}</ul>
      <p className="languagetool-credit">Powered by <a href="https://languagetool.org" target="_blank" rel="noopener noreferrer">LanguageTool</a></p>
    </div>
  </dialog>;
}
