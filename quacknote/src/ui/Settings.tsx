import { useEffect, useRef } from "react";
import Icon from "./Icon";
import ProofreadingOptions from "../tools/ProofreadingOptions";
import type { ProofreadingConfig } from "../tools/proofreading";
type SettingsProps = {
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  folder: string | null;
  busy: boolean;
  onChooseFolder: () => Promise<void>;
  onImport: () => void;
  imported: boolean;
  error: string;
  onClose: () => void;
  proofreading: ProofreadingConfig;
  onProofreadingChange: (config: ProofreadingConfig) => void;
};
export default function Settings({ theme, onThemeChange, folder, busy, onChooseFolder,
  onImport, imported, error, onClose, proofreading, onProofreadingChange }: SettingsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="settings-content">
        <header className="settings-header">
          <div><span className="eyebrow">QUACK NOTE</span><h2 id="settings-title">Settings</h2></div>
          <button className="icon-button" aria-label="Close settings" onClick={onClose}><Icon name="close" /></button>
        </header>
        <section className="settings-section" aria-labelledby="appearance-title">
          <h3 id="appearance-title">Appearance</h3><p>Choose how your workspace looks.</p>
          <div className="theme-options" role="group" aria-label="Color theme">
            {(["light", "dark"] as const).map((option) => (
              <button key={option} aria-pressed={theme === option} onClick={() => onThemeChange(option)}>
                <span className={`theme-swatch swatch-${option}`} aria-hidden="true"><span /><span /><span /></span>
                {option === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </section>
        <section className="settings-section" aria-labelledby="folder-title">
          <h3 id="folder-title">Notes folder</h3><p>Your notes are stored as plain Markdown files in this folder.</p>
          <div className="settings-folder"><Icon name="folder" /><span>{folder || "No folder selected"}</span></div>
          <button className="primary-button" disabled={busy} onClick={() => void onChooseFolder()}>
            {busy ? "Opening…" : folder ? "Change folder" : "Choose folder"}
          </button>
          {folder && !imported && <button className="import-button" disabled={busy} onClick={onImport}>Import existing notes</button>}
          {error && <p className="save-error" role="alert">{error}</p>}
        </section>
        <section className="settings-section" aria-labelledby="proofreading-settings-title">
          <h3 id="proofreading-settings-title">Auto correct</h3>
          <p>Choose the engine used by Tools → Auto correct.</p>
          <ProofreadingOptions config={proofreading} onChange={onProofreadingChange} />
        </section>
      </div>
    </dialog>
  );
}
