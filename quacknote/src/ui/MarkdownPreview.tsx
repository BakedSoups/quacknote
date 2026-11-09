import DOMPurify from "dompurify";
import { renderPreview } from "../markdown/renderPreview";
import { toggleTask } from "../markdown/toggleTask";

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
        // Only handle task checkboxes produced by our renderer.
        if (
          !(checkbox instanceof HTMLInputElement) ||
          checkbox.type !== "checkbox" ||
          checkbox.dataset.taskOffset === undefined
        ) {
          return;
        }
        const offset = Number(checkbox.dataset.taskOffset);
        onChange(toggleTask(value, offset, checkbox.checked));
      }}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
