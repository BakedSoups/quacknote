import { readAttachment, storeAttachment } from "./attachmentStorage";
import { noteAttachments } from "../markdown/imageReferences";
import type { ImageAttachment } from "../markdown/imageReferences";

// Format detection and image-specific limits belong here, not in storage.
function imageType(bytes: Uint8Array): { mime: string; extension: string } {
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value)) return { mime: "image/png", extension: "png" };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { mime: "image/jpeg", extension: "jpg" };
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) return { mime: "image/gif", extension: "gif" };
  if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") return { mime: "image/webp", extension: "webp" };
  throw new Error("Choose a PNG, JPEG, WebP, or GIF image.");
}

// Native storage returns raw bytes; attach the detected MIME type before
// handing the blob to an <img> element or PDF export.
export async function readImage(path: string, folder: string | null): Promise<Blob> {
  const blob = await readAttachment(path, folder);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { mime } = imageType(bytes);
  return blob.type === mime ? blob : new Blob([bytes], { type: mime });
}

export async function uploadImages(files: File[], markdown: string, folder: string | null): Promise<ImageAttachment[]> {
  const group = noteAttachments(markdown)[0]?.path.split("/")[1] ?? crypto.randomUUID();
  const result: ImageAttachment[] = [];
  for (const file of files) {
    if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} exceeds the 20 MB image limit.`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { mime, extension } = imageType(bytes);
    const path = `assets/${group}/${crypto.randomUUID()}.${extension}`;
    await storeAttachment(path, new Blob([bytes], { type: mime }), folder);
    result.push({ path, name: file.name.replace(/[\[\]\\\r\n]/g, " ") || "Image" });
  }
  return result;
}

