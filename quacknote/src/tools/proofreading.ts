import { markdownLanguage } from "@codemirror/lang-markdown";
import { invoke, isTauri } from "@tauri-apps/api/core";

export type ProofreadingConfig = { mode: "local" | "public"; endpoint: string; language: string };
export type Suggestion = { offset: number; length: number; message: string; replacements: string[] };
export const defaultProofreading: ProofreadingConfig = {
  mode: "local", endpoint: "http://127.0.0.1:8081/v2/check", language: "en-US",
};
export const proofreadingKey = "quacknote.proofreading";

export function loadProofreading(): ProofreadingConfig {
  try {
    const value = JSON.parse(localStorage.getItem(proofreadingKey) ?? "null");
    if (value && ["local", "public"].includes(value.mode) && typeof value.endpoint === "string" &&
      ["en-US", "en-GB", "auto"].includes(value.language)) return value;
  } catch { /* Use private-by-default settings for missing or invalid data. */ }
  return defaultProofreading;
}

export function proofreadingEndpoint(config: ProofreadingConfig) {
  if (config.mode === "public") return "https://api.languagetool.org/v2/check";
  const endpoint = new URL(config.endpoint);
  if (!["http:", "https:"].includes(endpoint.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(endpoint.hostname) ||
    endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    endpoint.pathname !== "/v2/check") {
    throw new Error("Local mode requires a localhost or loopback URL ending in /v2/check.");
  }
  return endpoint.href;
}

// Keep UTF-16 offsets unchanged while excluding code and Markdown syntax.
// This lets suggestions be applied directly to the original Markdown.
export function proofreadingText(source: string) {
  const characters = source.split("");
  const mask = (from: number, to: number) => {
    for (let i = from; i < to; i++) if (!/[\r\n]/.test(characters[i])) characters[i] = " ";
  };
  markdownLanguage.parser.parse(source).iterate({
    enter(node) {
      if (["FencedCode", "CodeBlock", "InlineCode", "Link", "Image", "HTMLBlock", "HTMLTag"].includes(node.name)) {
        mask(node.from, node.to);
        return false;
      }
      if (["HeaderMark", "EmphasisMark", "ListMark", "TaskMarker", "QuoteMark", "HorizontalRule"].includes(node.name)) mask(node.from, node.to);
    },
  });
  for (const match of source.matchAll(/\[\[[^\]\n]*\]\]|\[[ xX]\]/g)) mask(match.index, match.index + match[0].length);
  return characters.join("");
}

export function parseSuggestions(data: unknown, source: string, masked: string): Suggestion[] {
  if (!data || typeof data !== "object" || !("matches" in data) || !Array.isArray(data.matches)) {
    throw new Error("The proofreading server returned an invalid response.");
  }
  return data.matches.flatMap((match): Suggestion[] => {
    if (!match || !Number.isInteger(match.offset) || !Number.isInteger(match.length) ||
      match.offset < 0 || match.length < 0 || match.offset + match.length > source.length ||
      typeof match.message !== "string" || !Array.isArray(match.replacements)) return [];
    const { offset, length } = match;
    // Ignore suggestions crossing protected Markdown or code ranges.
    const from = length ? offset : Math.max(0, offset - 1);
    const to = length ? offset + length : Math.min(source.length, offset + 1);
    if (source.slice(from, to) !== masked.slice(from, to)) return [];
    return [{ offset, length, message: match.message,
      replacements: match.replacements.filter((item: unknown): item is { value: string } =>
        !!item && typeof item === "object" && "value" in item && typeof item.value === "string")
        .map((item: { value: string }) => item.value) }];
  });
}

export async function checkNote(source: string, config: ProofreadingConfig, signal: AbortSignal) {
  const endpoint = proofreadingEndpoint(config);
  const text = proofreadingText(source);
  if (config.mode === "public" && new TextEncoder().encode(text).length > 20000) {
    throw new Error("This note exceeds the public API's 20 KB limit. Use the local server for longer notes.");
  }
  let data: unknown;
  if (isTauri()) {
    data = await invoke("proofread_text", { mode: config.mode, endpoint, text, language: config.language });
  } else {
    const response = await fetch(endpoint, {
      method: "POST", body: new URLSearchParams({ text, language: config.language }),
      credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", cache: "no-store", signal,
    });
    if (!response.ok) throw new Error(`Proofreading server returned HTTP ${response.status}.`);
    data = await response.json();
  }
  if (signal.aborted) throw new DOMException("Check cancelled", "AbortError");
  return parseSuggestions(data, source, text);
}

export function applySuggestions(source: string, suggestions: Suggestion[]) {
  let end = -1;
  const accepted = suggestions.filter((match) => match.replacements.length > 0)
    .sort((a, b) => a.offset - b.offset || b.length - a.length)
    .filter((match) => {
      if (match.offset < end) return false;
      end = match.offset + Math.max(match.length, 1);
      return true;
    });
  return accepted.reverse().reduce((text, match) => text.slice(0, match.offset)
    + match.replacements[0] + text.slice(match.offset + match.length), source);
}
