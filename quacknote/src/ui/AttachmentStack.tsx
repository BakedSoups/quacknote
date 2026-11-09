import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import { noteAttachments } from "../markdown/imageReferences";
import { readImage } from "../attachments/images";
import type { Attachment } from "../attachments/attachmentStorage";
import type { Note } from "../notes";

type LoadedImage = Attachment & { url?: string; error?: string };
export default function AttachmentStack({ note, folder, disabled, onAdd, onClose, onResize }: {
  note: Note; folder: string | null; disabled: boolean;
  onAdd: (files: File[]) => void; onClose: () => void;
  onResize: (path: string, width?: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<LoadedImage[]>([]);
  const [selected, setSelected] = useState<LoadedImage | null>(null);
  const attachments = noteAttachments(note.content);
  const widths = new Map(attachments.map((image) => [image.path, image.width]));
  // Width changes should not reload the thumbnail or revoke its image URL.
  const key = JSON.stringify(attachments.map(({ path, name }) => ({ path, name })));
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const attachments = JSON.parse(key) as Attachment[];
    setImages(attachments);
    setSelected(null);
    void Promise.all(attachments.map(async (image): Promise<LoadedImage> => {
      try {
        const blob = await readImage(image.path, folder);
        const url = URL.createObjectURL(blob);
        if (cancelled) URL.revokeObjectURL(url); else urls.push(url);
        return { ...image, url };
      } catch (reason) { return { ...image, error: String(reason) }; }
    })).then((loaded) => { if (!cancelled) setImages(loaded); });
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [key, folder, note.id]);

  return <aside id="attachment-stack" className="attachment-stack" aria-label="Current note images">
    <header className="stack-header"><div><h2>Stack <span>{images.length}</span></h2><p>{note.title || "Untitled note"}</p></div>
      <button className="icon-button" aria-label="Close stack" onClick={onClose}><Icon name="close" /></button></header>
    <input ref={input} hidden type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif"
      onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) onAdd(files); event.target.value = ""; }} />
    <button className="stack-add" disabled={disabled} onClick={() => input.current?.click()}><Icon name="plus" /> Add images</button>
    <p className="stack-hint">Images belong to this note and stay on your device. You can also paste or drop them into the editor.</p>
    <div className="stack-images">{images.map((image) => <figure key={image.path}>
      {image.url ? <button className="stack-thumbnail" onClick={() => setSelected(image)} aria-label={`View ${image.name}`}>
        <img src={image.url} alt={image.name} loading="lazy" /></button> : <p className={image.error ? "save-error" : "stack-hint"}>{image.error || "Loading image…"}</p>}
      <figcaption title={image.name}>{image.name}</figcaption>
      <fieldset className="image-size-controls" disabled={disabled}>
        <label>Width <output>{widths.get(image.path) ? `${widths.get(image.path)} px` : "Original"}</output>
          <input type="range" min="40" max="1600" step="10"
            aria-label={`Width of ${image.name}`}
            value={widths.get(image.path) ?? 600}
            onChange={(event) => onResize(image.path, Number(event.target.value))} />
        </label>
        <button type="button" disabled={!widths.get(image.path)}
          onClick={() => onResize(image.path)}>Reset size</button>
      </fieldset>
    </figure>)}</div>
    {!images.length && <div className="stack-empty"><Icon name="image" /><p>No images yet</p><span>Add a picture to keep it with this note.</span></div>}
    {selected?.url && <ImagePreview image={selected} onClose={() => setSelected(null)} />}
  </aside>;
}

function ImagePreview({ image, onClose }: { image: LoadedImage; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  return <dialog ref={dialog} className="image-dialog" aria-label={image.name}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header><span>{image.name}</span><a href={image.url} download={image.name}>Download</a>
      <button className="icon-button" aria-label="Close image" onClick={onClose}><Icon name="close" /></button></header>
    <img src={image.url} alt={image.name} />
  </dialog>;
}
