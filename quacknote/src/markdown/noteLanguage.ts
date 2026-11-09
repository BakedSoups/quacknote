import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { pythonLanguage } from "@codemirror/lang-python";

// Locate incomplete fences using Markdown's own matching rules. This handles
// fence lengths, tilde fences, and fences nested inside lists or quotes.
export function unmatchedFencePositions(source: string): number[] {
  const unmatched = new Set<number>();
  const pending = [{ from: 0, to: source.length }];
  while (pending.length) {
    const region = pending.pop()!;
    markdownLanguage.parser.parse(source.slice(region.from, region.to)).iterate({
      enter(node) {
        if (node.name === "FencedCode" && node.node.getChildren("CodeMark").length < 2) {
          const start = region.from + node.from;
          unmatched.add(start);
          // Removing this opener can reveal another unmatched fence below
          // it (for example a closing fence shorter than its opener).
          const nextLine = source.indexOf("\n", start);
          const end = region.from + node.to;
          if (nextLine !== -1 && nextLine + 1 < end) {
            pending.push({ from: nextLine + 1, to: end });
          }
        }
      },
    });
  }

  return [...unmatched];
}

export function noteLanguageForPositions(positions: number[]) {
  const unmatched = new Set(positions);
  return markdown({
    codeLanguages: (name) => /^(python|py)$/i.test(name) ? pythonLanguage : null,
    extensions: {
      parseBlock: [{
        name: "UnmatchedFence",
        before: "FencedCode",
        parse(cx, line) {
          const start = cx.lineStart + line.pos;
          if (!unmatched.has(start)) return false;
          // Consume just this line as literal text, allowing the next line
          // to be parsed normally instead of swallowing it as code.
          cx.addElement(cx.elt("Paragraph", start, cx.lineStart + line.text.length));
          cx.nextLine();
          return true;
        },
        endLeaf(cx, line) {
          return unmatched.has(cx.lineStart + line.pos);
        },
      }],
    },
  });
}

export function noteLanguage(source: string) {
  return noteLanguageForPositions(unmatchedFencePositions(source));
}
