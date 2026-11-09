import { markdownLanguage } from "@codemirror/lang-markdown";
import { marked, Renderer } from "marked";
import type { Tokens } from "marked";
import hljs from "highlight.js";

// Match task markers only at the beginning of a Markdown list item.
const taskMarker = /^(?:[-+*]|\d+[.)])[\t ]+\[([ xX])\](?=[\t ]|$)/;

export function renderPreview(source: string) {
  const positions: number[] = [];

  // The syntax tree distinguishes real list items from examples inside
  // code blocks. Keep their original text positions for checkbox clicks.
  markdownLanguage.parser.parse(source).iterate({
    enter(node) {
      if (node.name !== "ListItem") return;
      const end = source.indexOf("\n", node.from);
      const line = source.slice(node.from, end === -1 ? source.length : end);
      const match = taskMarker.exec(line);
      if (match) positions.push(node.from + match[0].lastIndexOf("["));
    },
  });

  const tokens = marked.lexer(source);
  const offsets = new WeakMap<Tokens.ListItem, number>();
  let taskIndex = 0;

  marked.walkTokens(tokens, (token) => {
    if (token.type !== "list_item") return;
    const item = token as Tokens.ListItem;
    const match = taskMarker.exec(item.raw.trimStart());
    if (!match) return;

    const offset = positions[taskIndex++];
    if (offset !== undefined) offsets.set(item, offset);

    // Marked normally treats an empty task as literal brackets. Supply a
    // checkbox token so "- [ ] " also renders before a task has a title.
    if (/^\[[ xX]\]$/.test(item.text.trim())) {
      item.task = true;
      item.checked = match[1].toLowerCase() === "x";
      item.tokens = [{
        type: "checkbox",
        raw: item.text,
        checked: item.checked,
      }];
    }
  });

  class TaskRenderer extends Renderer {
    private offset: number | undefined;

    override listitem(item: Tokens.ListItem) {
      const previous = this.offset;
      this.offset = offsets.get(item);
      const html = super.listitem(item);
      this.offset = previous;
      return html;
    }

    override checkbox(token: Tokens.Checkbox) {
      if (this.offset === undefined) return super.checkbox(token);
      return `<input type="checkbox" data-task-offset="${this.offset}"`
        + ` aria-label="Mark task complete"${token.checked ? " checked" : ""}> `;
    }
    // module for code highlighting
    override code(token: Tokens.Code) {
      // The first word after ``` identifies the language.
      const language = token.lang?.trim().split(/\s+/)[0];

      // Let marked render plain code when no supported language is given.
      // This also ensures that the text is properly escaped.
      if (!language || !hljs.getLanguage(language)) {
        return super.code(token);
      }

      // Highlight.js escapes the code and adds spans for its syntax.
      const highlighted = hljs.highlight(token.text, {
        language,
        ignoreIllegals: true,
      }).value;

      return `<pre><code class="hljs">${highlighted}</code></pre>\n`;
    }

  }

  return marked.parser(tokens, { renderer: new TaskRenderer() });
}
