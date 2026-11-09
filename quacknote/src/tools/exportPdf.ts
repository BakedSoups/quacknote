import DOMPurify from "dompurify";
import { marked, Renderer } from "marked";
import type { Tokens } from "marked";
import { noteAttachments } from "../markdown/imageReferences";
import { readImage } from "../attachments/images";
import type { Note } from "../notes";

const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]!);

export function pdfHtml(note: Note, images: Map<string, string>) {
  class PrintRenderer extends Renderer {
    // Raw HTML cannot introduce remote image loads or active content.
    override html() { return ""; }
    override listitem(item: Tokens.ListItem) {
      if (/^\[[ xX]\]$/.test(item.text.trim())) {
        item.task = true;
        item.checked = item.text.trim().toLowerCase() === "[x]";
        item.tokens = [{ type: "checkbox", raw: item.text, checked: item.checked }];
      }
      return super.listitem(item);
    }
    override image(token: Tokens.Image) {
      const url = images.get(token.href);
      const image = noteAttachments(`![${token.text}](${token.href})`)[0];
      return url ? `<img src="${escape(url)}" alt="${escape(image?.name ?? token.text)}"${image?.width ? ` width="${image.width}"` : ""}>`
        : `<span class="missing-image">[Image: ${escape(token.text || "not available")}]</span>`;
    }
  }
  const html = marked.parse(note.content, { async: false, renderer: new PrintRenderer() });
  return DOMPurify.sanitize(`<h1>${escape(note.title || "Untitled note")}</h1>${html}`, {
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|blob):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });
}

export async function exportPdf(note: Note, folder: string | null) {
  const urls: string[] = [];
  let frame: HTMLIFrameElement | undefined;
  try {
    const sources = new Map<string, string>();
    for (const image of noteAttachments(note.content)) {
      const url = URL.createObjectURL(await readImage(image.path, folder));
      sources.set(image.path, url);
      urls.push(url);
    }
    const body = pdfHtml(note, sources);
    frame = document.createElement("iframe");
    frame.title = "PDF export";
    frame.className = "pdf-print-frame";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    const target = frame.contentWindow;
    if (!doc || !target) throw new Error("Could not open PDF print preview.");
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(note.title || "Quack Note")}</title><style>
      @page { margin: 18mm; }
      body { color:#111; background:#fff; font: 11pt/1.65 system-ui,sans-serif; margin:0; }
      h1,h2,h3,h4 { line-height:1.25; break-after:avoid; }
      h1 { font-size:26pt; } h2 { font-size:20pt; } h3 { font-size:16pt; }
      img { display:block; max-width:100%; max-height:235mm; object-fit:contain; margin:16px 0; break-inside:avoid; }
      pre { padding:12px; border:1px solid #ddd; border-radius:5px; white-space:pre-wrap; overflow-wrap:anywhere; font-size:9pt; }
      code { font-family:ui-monospace,monospace; } blockquote { margin-left:0; padding-left:16px; border-left:3px solid #bbb; }
      table { border-collapse:collapse; width:100%; } th,td { border:1px solid #ccc; padding:7px; }
      a { color:#111; overflow-wrap:anywhere; } p,li { orphans:3; widows:3; }
    </style></head><body><article>${body}</article></body></html>`);
    doc.close();
    await Promise.all(Array.from(doc.images).map((image) => image.decode()));
    await doc.fonts.ready;
    const printFrame = frame;
    const cleanup = () => { printFrame.remove(); urls.forEach((url) => URL.revokeObjectURL(url)); };
    target.addEventListener("afterprint", cleanup, { once: true });
    // Keep the document and images alive until the print dialog is finished.
    target.focus();
    target.print();
  } catch (reason) {
    frame?.remove();
    urls.forEach((url) => URL.revokeObjectURL(url));
    throw reason;
  }
}
