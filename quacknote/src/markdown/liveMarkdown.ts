import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";

class HorizontalRule extends WidgetType {
  toDOM() {
    const rule = document.createElement("span");
    rule.className = "cm-live-rule";
    rule.setAttribute("role", "separator");
    return rule;
  }
}

class Bullet extends WidgetType {
  constructor(readonly symbol: string) {
    super();
  }

  eq(other: Bullet) {
    return this.symbol === other.symbol;
  }

  toDOM() {
    const bullet = document.createElement("span");
    bullet.textContent = this.symbol;
    bullet.className = "cm-live-bullet";
    bullet.setAttribute("aria-hidden", "true");
    return bullet;
  }
}

// Decorations change presentation only. The document stays plain Markdown,
// so saving, selecting text, and undo still operate on the original note.
function decorate(view: EditorView): DecorationSet {
  const decorations: ReturnType<Decoration["range"]>[] = [];

  function isEditing(from: number, to: number) {
    if (!view.hasFocus) return false;
    const firstLine = view.state.doc.lineAt(from).from;
    const lastLine = view.state.doc.lineAt(to).to;
    return view.state.selection.ranges.some(
      (range) => range.from <= lastLine && range.to >= firstLine,
    );
  }

  syntaxTree(view.state).iterate({
    enter(node) {
      // The image extension owns the complete image reference and preview.
      if (node.name === "Image") return false;
      if (node.name === "FencedCode" || node.name === "CodeBlock") {
        const editing = isEditing(node.from, node.to);
        const first = view.state.doc.lineAt(node.from).number;
        const last = view.state.doc.lineAt(node.to).number;
        const fences = new Set<number>();
        // Use syntax nodes rather than a regex so code that merely contains
        // backticks cannot accidentally be hidden as a closing fence.
        for (let child = node.node.firstChild; child; child = child.nextSibling) {
          if (child.name === "CodeMark") {
            fences.add(view.state.doc.lineAt(child.from).number);
          }
        }
        // Markdown's parser accepts unclosed fences, but live preview should
        // revert to literal text as soon as the closing fence is removed.
        if (node.name === "FencedCode" && fences.size < 2) {
          decorations.push(Decoration.mark({
            class: "cm-live-unclosed-fence",
          }).range(node.from, node.to));
          return false;
        }
        for (let number = first; number <= last; number++) {
          decorations.push(Decoration.line({
            class: !editing && fences.has(number)
              ? "cm-live-fence-hidden"
              : "cm-live-code",
          }).range(view.state.doc.line(number).from));
        }
        // Keep headings and task-like text inside code literal. Syntax
        // coloring is handled by the language parser, not these decorations.
        return false;
      }

      if (node.name === "HorizontalRule" && !isEditing(node.from, node.to)) {
        decorations.push(Decoration.replace({
          widget: new HorizontalRule(),
        }).range(node.from, node.to));
      }

      if (node.name === "ListMark") {
        const marker = view.state.doc.sliceString(node.from, node.to);
        const rest = view.state.doc.sliceString(node.to, view.state.doc.lineAt(node.to).to);
        // Numbered lists keep their numbers. Task widgets already replace
        // their whole marker, so don't add a second decoration over them.
        if (/^[-+*]$/.test(marker) && !/^[\t ]+\[[ xX]\][\t ]/.test(rest)) {
          // Count actual list nesting, rather than assuming a fixed number
          // of spaces. Repeat the three markers for deeper nested lists.
          let depth = -1;
          for (let parent = node.node.parent; parent; parent = parent.parent) {
            if (parent.name === "BulletList" || parent.name === "OrderedList") depth++;
          }
          const symbol = ["-", "•", "*"][Math.max(0, depth) % 3];
          decorations.push(Decoration.replace({ widget: new Bullet(symbol) })
            .range(node.from, node.to));
        }
      }

      const heading = /^ATXHeading([1-6])$/.exec(node.name);
      if (heading) {
        decorations.push(Decoration.line({
          class: `cm-live-heading cm-live-h${heading[1]}`,
        }).range(view.state.doc.lineAt(node.from).from));
      }

      if (node.name === "StrongEmphasis" || node.name === "Emphasis") {
        decorations.push(Decoration.mark({
          class: node.name === "StrongEmphasis" ? "cm-live-bold" : "cm-live-italic",
        }).range(node.from, node.to));
      }

      if (node.name === "HeaderMark" || node.name === "EmphasisMark") {
        if (!isEditing(node.from, node.to)) {
          let end = node.to;
          // Hide the space after an opening heading marker too.
          if (node.name === "HeaderMark") {
            const line = view.state.doc.lineAt(node.from);
            if (/^ {0,3}$/.test(view.state.doc.sliceString(line.from, node.from))) {
              end += /^[\t ]*/.exec(view.state.doc.sliceString(end, line.to))![0].length;
            }
          }
          decorations.push(Decoration.replace({}).range(node.from, end));
        }
      }
    },
  });

  return Decoration.set(decorations, true);
}

export const liveMarkdown = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = decorate(view);
  }

  update(update: ViewUpdate) {
    // Moving the cursor reveals the Markdown on the newly active line.
    if (update.docChanged || update.selectionSet || update.focusChanged ||
      syntaxTree(update.startState) !== syntaxTree(update.state)) {
      this.decorations = decorate(update.view);
    }
  }
}, {
  decorations: (plugin) => plugin.decorations,
});

export const liveMarkdownTheme = EditorView.baseTheme({
  ".cm-live-heading": { fontWeight: "700", lineHeight: "1.4" },
  ".cm-live-h1": { fontSize: "2em" },
  ".cm-live-h2": { fontSize: "1.65em" },
  ".cm-live-h3": { fontSize: "1.4em" },
  ".cm-live-h4": { fontSize: "1.2em" },
  ".cm-live-h5": { fontSize: "1.1em" },
  ".cm-live-h6": { fontSize: "1em" },
  ".cm-live-bold": { fontWeight: "700" },
  ".cm-live-italic": { fontStyle: "italic" },
  ".cm-content": { padding: "16px", fontFamily: "system-ui, sans-serif" },
  ".cm-line": { padding: "2px 0" },
});
