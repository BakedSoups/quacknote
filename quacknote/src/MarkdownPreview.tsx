import DOMPurify from "dompurify";
import { renderPreview } from "./markdown/renderPreview";

type MarkdownPreviewProps = {
  value: string;
  onChange: (markdown: string) => void;
};

export default function MarkdownPreview({
  value,
  onChange,
}: MarkdownPreviewProps) {
  // Convert the Markdown text into HTML.
  const html = renderPreview(value);

  // Clean the HTML before displaying it.
  const safeHtml = DOMPurify.sanitize(html);

  return (
    <article
      id="preview"
      onChange={(event) => {
        const checkbox = event.target;
        if (!(checkbox instanceof HTMLInputElement)) return;
        const offset = Number(checkbox.dataset.taskOffset);
        if (!Number.isInteger(offset) || offset < 0) return;
        // Update the Markdown, which also updates the editor and saved note.
        if (!/^\[[ xX]\]$/.test(value.slice(offset, offset + 3))) return;
        onChange(
          value.slice(0, offset)
          + (checkbox.checked ? "[x]" : "[ ]")
          + value.slice(offset + 3),
        );
      }}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
