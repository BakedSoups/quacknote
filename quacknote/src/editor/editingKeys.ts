import { EditorSelection, Prec } from "@codemirror/state";
import type { StateCommand } from "@codemirror/state";
import { indentLess, indentMore } from "@codemirror/commands";
import { insertNewlineContinueMarkupCommand } from "@codemirror/lang-markdown";
import { indentUnit, syntaxTree } from "@codemirror/language";
import { keymap } from "@codemirror/view";

// Enter after an opening fence creates a body and matching closing fence.
// The language label affects colors only, not whether this is a code block.
export const openCodeBlock: StateCommand = ({ state, dispatch }) => {
  const { main, ranges } = state.selection;
  if (ranges.length !== 1 || !main.empty) return false;
  const line = state.doc.lineAt(main.head);
  if (main.head !== line.to) return false;
  const match = /^( {0,3})(`{3,}|~{3,})([^`]*)$/.exec(line.text);
  if (!match) return false;

  let node = syntaxTree(state).resolveInner(main.head, -1);
  while (node.parent && node.name !== "FencedCode" && node.name !== "CodeBlock") node = node.parent;
  // Do not treat a closing fence or backticks inside code as a new block.
  if (node.name === "CodeBlock" ||
    (node.name === "FencedCode" && node.from !== line.from + match[1].length)) {
    return false;
  }
  const closing = node.name === "FencedCode" && node.getChildren("CodeMark").length > 1;
  const body = state.lineBreak + match[1];
  dispatch(state.update({
    changes: {
      from: main.head,
      insert: closing ? body : body + state.lineBreak + match[1] + match[2],
    },
    selection: EditorSelection.cursor(main.head + body.length),
    scrollIntoView: true,
    userEvent: "input",
  }));
  return true;
};

export const continueList = insertNewlineContinueMarkupCommand({ nonTightLists: false });

export const editingKeys = [
  indentUnit.of("  "),
  // Run before generic Enter and Tab handlers. Returning false preserves
  // normal Enter behavior outside lists and opening code fences.
  Prec.highest(keymap.of([
    { key: "Enter", run: openCodeBlock },
    { key: "Enter", run: continueList },
    { key: "Tab", run: indentMore, shift: indentLess },
  ])),
];
