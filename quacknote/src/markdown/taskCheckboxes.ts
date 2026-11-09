import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
} from "@codemirror/view";

import type {
  DecorationSet,
  ViewUpdate,
} from "@codemirror/view";

// A widget is a real HTML element displayed inside the editor.
class TaskCheckbox extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly markerFrom: number,
  ) {
    super();
  }

  // CodeMirror can reuse the existing checkbox when nothing changed.
  eq(other: TaskCheckbox) {
    return (
      this.checked === other.checked &&
      this.markerFrom === other.markerFrom
    );
  }

  toDOM(view: EditorView) {
    const checkbox = document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = this.checked;
    checkbox.setAttribute("aria-label", this.checked ? "Mark task incomplete" : "Mark task complete");
    checkbox.addEventListener("mousedown", (event) => event.preventDefault());

    checkbox.addEventListener("change", () => {
      // Change the Markdown itself, rather than keeping a separate
      // checkbox state that could disagree with the saved note.
      view.dispatch({
        changes: {
          from: this.markerFrom,
          to: this.markerFrom + 3,
          insert: checkbox.checked ? "[x]" : "[ ]",
        },
      });
    });

    return checkbox;
  }

  // Let the checkbox handle its own browser events.
  // CodeMirror should not treat a click as ordinary text editing.
  ignoreEvent() {
    return true;
  }
}

// Markdown-looking text inside a code block should stay plain text.
function isInsideCode(view: EditorView, position: number) {
  const start = syntaxTree(view.state).resolveInner(position, 1);
  for (let node: typeof start | null = start; node; node = node.parent) {
    if (
      node.name === "FencedCode" ||
      node.name === "CodeBlock"
    ) {
      return true;
    }
  }

  return false;
}

// Build the visual replacements from the current document.
function buildCheckboxes(view: EditorView): DecorationSet {
  const decorations = [];

  for (
    let lineNumber = 1;
    lineNumber <= view.state.doc.lines;
    lineNumber++
  ) {
    const line = view.state.doc.line(lineNumber);

    // Recognize:
    //   - [ ] task
    //   - [x] task
    //
    // The final space is required, so typing "- [ ]" alone
    // does not turn it into a checkbox yet.
    //
    // Preserve indentation and support unordered and numbered tasks.
    const match = /^(\s*)(?:[-+*]|\d+[.)])[\t ]+\[([ xX])\][\t ]/.exec(line.text);

    if (!match || isInsideCode(view, line.from + match[1].length + 1)) {
      continue;
    }

    const markerFrom = line.from + match[0].indexOf("[");
    const checked = match[2].toLowerCase() === "x";

    decorations.push(
      Decoration.replace({
        widget: new TaskCheckbox(checked, markerFrom),
      }).range(
        line.from + match[1].length,
        line.from + match[0].length,
      ),
    );

    // The replacement covers "- [ ] " or "- [x] ".
    // That puts the checkbox where the bullet would have been.
    // The task's actual text remains normally editable.
  }

  return Decoration.set(decorations, true);
}

// Export an extension that NoteEditor can enable.
export function taskCheckboxes() {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildCheckboxes(view);
      }

      update(update: ViewUpdate) {
        // Rebuild after typing, deleting, or clicking a checkbox.
        // Also rebuild when Markdown parsing advances.
        if (
          update.docChanged ||
          syntaxTree(update.startState) !==
            syntaxTree(update.state)
        ) {
          this.decorations = buildCheckboxes(update.view);
        }
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
    },
  );
}
