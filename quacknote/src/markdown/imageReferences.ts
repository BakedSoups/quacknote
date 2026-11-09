import type { Attachment } from "../attachments/attachmentStorage";

// Image-only Markdown metadata stays separate from file storage.
export type ImageAttachment = Attachment & { width?: number };
export type Insertion = { from: number; to: number };
const assetPattern = /^assets\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.(png|jpg|webp|gif)$/;

export function noteAttachments(markdown: string): ImageAttachment[] {
  // Key by file path so Stack shows each attached image once, even if the
  // same file is referenced several times in the note.
  const attachments = new Map<string, ImageAttachment>();
  for (const match of markdown.matchAll(/!\[([^\]\n]*)\]\((assets\/[^\s)]+)\)/g)) {
    if (assetPattern.test(match[2])) {
      // In ![Picture|400](...), the text before | is the image name and the
      // number after it is the requested display width in pixels.
      const size = /\|(\d+)$/.exec(match[1]);
      const width = size ? Number(size[1]) : undefined;
      attachments.set(match[2], { path: match[2],
        name: (size ? match[1].slice(0, size.index) : match[1]) || "Image",
        // Without a valid saved width, render at the image's natural size,
        // constrained by the available page width through CSS.
        ...(width !== undefined && width >= 40 && width <= 1600 ? { width } : {}),
      });
    }
  }
  return [...attachments.values()];
}

// Obsidian-style width metadata keeps the image path unchanged and remains
// part of the plain Markdown: ![Picture|400](assets/.../image.png).
export function resizeAttachment(markdown: string, path: string, width?: number) {
  // Reject invalid sizes instead of writing unusable metadata into the note.
  if (width !== undefined && (!Number.isInteger(width) || width < 40 || width > 1600)) return markdown;
  return markdown.replace(/!\[([^\]\n]*)\]\((assets\/[^\s)]+)\)/g, (raw, alt: string, href: string) => {
    if (href !== path || !assetPattern.test(href)) return raw;
    // Replace the previous width rather than appending another one.
    // An undefined width means Reset: remove the size suffix entirely.
    const name = alt.replace(/\|\d+$/, "");
    const size = width === undefined ? "" : `|${width}`;
    // Return new Markdown. The caller updates React or CodeMirror state,
    // which then triggers the app's existing automatic saving flow.
    return `![${name}${size}](${href})`;
  });
}

export function insertAttachments(markdown: string, attachments: ImageAttachment[], selection?: Insertion) {
  const links = attachments.map((image) => `![${image.name}](${image.path})`).join("\n\n");
  if (!links) return markdown;
  const from = selection?.from ?? markdown.length;
  const to = selection?.to ?? markdown.length;
  const before = markdown.slice(0, from);
  const after = markdown.slice(to);
  return before + (before && !before.endsWith("\n\n") ? "\n\n" : "") + links
    + (after ? "\n\n" + after : "\n");
}

