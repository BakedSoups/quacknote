import { acceptCompletion, autocompletion } from "@codemirror/autocomplete";
import type { CompletionSource } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";
import { Prec } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, keymap } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

export type NoteTarget = { id: string; title: string };

function inCode(state: EditorState, position: number) {
  const start = syntaxTree(state).resolveInner(position, -1);
  for (let node: typeof start | null = start; node; node = node.parent) {
    if (["FencedCode", "CodeBlock", "InlineCode"].includes(node.name)) return true;
  }
  return false;
}

function escaped(state: EditorState, position: number) {
  let slashes = 0;
  while (position > 0 && state.doc.sliceString(position - 1, position) === "\\") {
    slashes++;
    position--;
  }
  return slashes % 2 === 1;
}

export function noteLinkSource(notes: NoteTarget[]): CompletionSource {
  return (context) => {
    const match = context.matchBefore(/\[\[[^\[\]\n]*/);
    if (!match || escaped(context.state, match.from) || inCode(context.state, match.from + 2)) return null;
    return {
      from: match.from + 2,
      // CodeMirror filters and ranks these using its built-in fuzzy matcher.
      validFor: /^[^\[\]\n]*$/,
      options: notes.filter((note) => note.title.trim() && !/[\[\]\r\n]/.test(note.title)).map((note) => ({
        label: note.title,
        type: "text",
        detail: "Note",
        apply(view, _completion, from, to) {
          const line = view.state.doc.lineAt(to);
          const tail = view.state.doc.sliceString(to, line.to);
          // Consume an existing closing pair (including one inserted by
          // bracket completion) instead of creating [[Title]]]].
          const ending = /^[^\[\]\n]*\]\]/.exec(tail);
          const end = ending ? to + ending[0].length : to + (/^\]/.test(tail) ? 1 : 0);
          const insert = `${note.title}]]`;
          view.dispatch({
            changes: { from, to: end, insert },
            selection: { anchor: from + insert.length },
            userEvent: "input.complete",
          });
        },
      })),
    };
  };
}

function linkDecorations(view: EditorView, notes: NoteTarget[]): DecorationSet {
  const ranges: ReturnType<Decoration["range"]>[] = [];
  const lookup = new Map<string, NoteTarget>();
  for (const note of notes) {
    const key = note.title.trim().toLowerCase();
    if (key && !lookup.has(key)) lookup.set(key, note);
  }
  const text = view.state.doc.toString();
  for (const match of text.matchAll(/\[\[([^\[\]\n]+)\]\]/g)) {
    const from = match.index;
    if (escaped(view.state, from) || inCode(view.state, from + 2)) continue;
    const note = lookup.get(match[1].trim().toLowerCase());
    ranges.push(Decoration.mark({
      class: note ? "cm-wiki-link" : "cm-wiki-link unresolved",
      attributes: note ? {
        "data-note-id": note.id,
        role: "link",
        tabindex: "0",
        title: `Open ${note.title}`,
      } : { title: "Note not found" },
    }).range(from, from + match[0].length));
  }
  return Decoration.set(ranges, true);
}

export function wikiLinks(notes: NoteTarget[], onOpen: (id: string) => void) {
  function open(target: EventTarget | null) {
    if (!(target instanceof Element)) return false;
    const id = target.closest<HTMLElement>("[data-note-id]")?.dataset.noteId;
    if (!id) return false;
    onOpen(id);
    return true;
  }
  return [
    autocompletion({ override: [noteLinkSource(notes)], activateOnTyping: true }),
    // Accept a suggestion before Enter continues a list or Tab indents it.
    Prec.highest(keymap.of([
      { key: "Enter", run: acceptCompletion },
      { key: "Tab", run: acceptCompletion },
    ])),
    ViewPlugin.fromClass(class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = linkDecorations(view, notes); }
      update(update: ViewUpdate) {
        if (update.docChanged || syntaxTree(update.startState) !== syntaxTree(update.state)) {
          this.decorations = linkDecorations(update.view, notes);
        }
      }
    }, {
      decorations: (plugin) => plugin.decorations,
      eventHandlers: {
        click(event) {
          if (!open(event.target)) return false;
          event.preventDefault();
          return true;
        },
        keydown(event) {
          if (event.key !== "Enter" || !open(event.target)) return false;
          event.preventDefault();
          return true;
        },
      },
    }),
  ];
}
