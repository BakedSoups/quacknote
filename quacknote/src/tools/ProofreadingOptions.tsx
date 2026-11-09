import type { ProofreadingConfig } from "./proofreading";

export default function ProofreadingOptions({ config, onChange, disabled = false }: {
  config: ProofreadingConfig;
  onChange: (config: ProofreadingConfig) => void;
  disabled?: boolean;
}) {
  return <div className="proofreading-options">
    <label>Check using
      <select value={config.mode} disabled={disabled}
        onChange={(event) => onChange({ ...config, mode: event.target.value as ProofreadingConfig["mode"] })}>
        <option value="local">Local Docker server · offline</option>
        <option value="public">LanguageTool public API · online</option>
      </select>
    </label>
    {config.mode === "local" ? <>
      <label>Local endpoint<input type="url" value={config.endpoint} disabled={disabled}
        onChange={(event) => onChange({ ...config, endpoint: event.target.value })} /></label>
      <p className="privacy-note">Checks go only to your local server. No cloud fallback.</p>
      <details className="docker-instructions"><summary>Start the offline server</summary>
        <p>From the Quacknote project folder:</p><code>docker compose up -d --build languagetool</code>
        <p>The first build downloads the engine. Checks then run locally.</p>
      </details>
    </> : <p className="privacy-note">Clicking Check note sends this note's prose to LanguageTool.org. Checks run only when requested.</p>}
    <label>Language<select value={config.language} disabled={disabled}
      onChange={(event) => onChange({ ...config, language: event.target.value })}>
      <option value="en-US">English (US)</option><option value="en-GB">English (UK)</option><option value="auto">Detect automatically</option>
    </select></label>
  </div>;
}
