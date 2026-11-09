import { StateField } from "@codemirror/state";
import type { EditorState } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { noteAttachments, resizeAttachment } from "./imageReferences";
import { readImage } from "../attachments/images";

// Equal widgets can reuse DOM across state updates, so resource ownership
// belongs to the DOM element rather than a particular widget instance.
type ImageResource = { disposed: boolean; url?: string; path: string; name: string; folder: string | null; width?: number };
const resources = new WeakMap<HTMLElement, ImageResource>();

function showWidth(container: HTMLElement, width?: number) {
  // Update the picture and its controls together. This only changes the DOM;
  // it does not save anything or modify the underlying Markdown.
  const image = container.querySelector("img");
  if (image) image.style.width = width ? `${width}px` : "";
  const slider = container.querySelector<HTMLInputElement>("input[type=range]");
  if (slider) slider.value = String(width ?? 600);
  const output = container.querySelector("output");
  if (output) output.textContent = width ? `${width} px` : "Original";
}

class NoteImage extends WidgetType {
  // A widget describes the HTML that CodeMirror displays in place of text.
  // These values come from the image reference stored in the Markdown.
  constructor(readonly path: string, readonly name: string, readonly folder: string | null, readonly width?: number) {
    super();
  }

  eq(other: NoteImage) {
    // Identical descriptions let CodeMirror reuse the existing image DOM.
    return this.path === other.path && this.name === other.name && this.folder === other.folder && this.width === other.width;
  }

  updateDOM(container: HTMLElement, view: EditorView) {
    // A width change can reuse the loaded image instead of reading the file
    // again. A different file, name, or folder needs a fresh widget.
    const resource = resources.get(container);
    if (!resource || resource.path !== this.path || resource.name !== this.name || resource.folder !== this.folder) return false;
    resource.width = this.width;
    showWidth(container, this.width);
    view.requestMeasure();
    return true;
  }

  // Give the editor a layout estimate before the image finishes loading.
  get estimatedHeight() { return 240; }

  toDOM(view: EditorView) {
    const container = document.createElement("span");
    container.className = "cm-note-image";
    container.tabIndex = 0;
    container.setAttribute("role", "group");
    container.setAttribute("aria-label", `Image: ${this.name}. Click to resize.`);
    container.textContent = "Loading image…";
    const resource: ImageResource = { disposed: false, path: this.path, name: this.name, folder: this.folder, width: this.width };
    resources.set(container, resource);

    const toolbar = document.createElement("span");
    toolbar.className = "cm-image-resize-toolbar";
    toolbar.hidden = true;
    const select = (selected: boolean) => {
      // Selecting a picture reveals its resize controls and hides controls
      // on other pictures. It does not change the text cursor or note data.
      if (selected) {
        for (const other of view.dom.querySelectorAll<HTMLElement>(".cm-note-image.is-selected")) {
          if (other === container) continue;
          other.classList.remove("is-selected");
          const controls = other.querySelector<HTMLElement>(".cm-image-resize-toolbar");
          if (controls) controls.hidden = true;
        }
      }
      container.classList.toggle("is-selected", selected);
      toolbar.hidden = !selected;
      view.requestMeasure();
    };
    const commit = (width?: number) => {
      if (!view.state.facet(EditorView.editable)) return;
      const source = view.state.doc.toString();
      // This is where a visual size becomes saved Markdown, e.g. |400.
      const updated = resizeAttachment(source, this.path, width);
      if (updated === source) return;
      // Apply only the changed span so surrounding text and the cursor retain
      // their positions. The normal editor change handler saves this edit.
      let from = 0;
      // Skip the unchanged beginning, then the unchanged end. What remains
      // is the smallest span that must be replaced in the document.
      while (source[from] === updated[from] && from < source.length && from < updated.length) from++;
      let before = source.length, after = updated.length;
      while (before > from && after > from && source[before - 1] === updated[after - 1]) { before--; after--; }
      view.dispatch({ changes: { from, to: before, insert: updated.slice(from, after) }, userEvent: "input.image.resize" });
    };
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = "40"; slider.max = "1600"; slider.step = "10";
    slider.setAttribute("aria-label", `Resize ${this.name}`);
    slider.addEventListener("input", () => commit(Number(slider.value)));
    const output = document.createElement("output");
    toolbar.append(slider, output);
    const button = (label: string, action: () => void) => {
      const control = document.createElement("button");
      control.type = "button"; control.textContent = label;
      control.addEventListener("click", action);
      toolbar.appendChild(control);
    };
    button("Reset", () => commit());
    button("Edit Markdown", () => {
      // Move the editor cursor onto this image's line. The decoration builder
      // below will reveal the reference while keeping a preview underneath.
      select(false);
      const position = view.posAtDOM(container);
      view.dispatch({ selection: { anchor: position }, scrollIntoView: true });
      view.focus();
    });
    button("Done", () => { select(false); view.focus(); });
    // A click on a toolbar control must not also toggle image selection.
    toolbar.addEventListener("click", (event) => event.stopPropagation());
    toolbar.addEventListener("keydown", (event) => {
      event.stopPropagation();
      if (event.key === "Escape") { event.preventDefault(); select(false); view.focus(); }
    });
    container.addEventListener("mousedown", (event) => {
      // Preserve the editor selection when selecting the picture, but let
      // native range inputs and buttons handle their own pointer events.
      if (!(event.target instanceof Element) || !event.target.closest("button,input")) event.preventDefault();
    });
    container.addEventListener("click", () => select(!container.classList.contains("is-selected")));
    container.addEventListener("keydown", (event) => {
      if (event.target !== container) return;
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); select(true); slider.focus(); }
      if (event.key === "Escape") select(false);
    });

    const handle = document.createElement("button");
    handle.type = "button";
    handle.className = "cm-image-resize-handle";
    handle.setAttribute("aria-label", `Drag to resize ${this.name}`);
    handle.title = "Drag to resize; arrow keys adjust width";
    handle.addEventListener("click", (event) => event.stopPropagation());
    const clamp = (width: number) => Math.max(40, Math.min(1600, Math.round(width / 10) * 10));
    // Keep the drag's starting position and its unsaved preview width separate
    // from resource.width, which reflects the width already in Markdown.
    let drag: { pointer: number; x: number; width: number; pending: number } | undefined;
    handle.addEventListener("pointerdown", (event) => {
      if (!view.state.facet(EditorView.editable)) return;
      event.preventDefault(); event.stopPropagation();
      const width = container.querySelector("img")?.getBoundingClientRect().width || resource.width || 600;
      drag = { pointer: event.pointerId, x: event.clientX, width, pending: width };
      // Continue receiving drag events even if the pointer leaves the handle.
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      drag.pending = clamp(drag.width + event.clientX - drag.x);
      // Show the new size immediately, but wait until release to save it.
      showWidth(container, drag.pending);
      view.requestMeasure();
    });
    handle.addEventListener("pointerup", (event) => {
      if (!drag || drag.pointer !== event.pointerId) return;
      const width = drag.pending;
      drag = undefined;
      handle.releasePointerCapture(event.pointerId);
      // One committed edit per drag keeps undo useful.
      commit(clamp(width));
    });
    const cancelDrag = () => {
      // An interrupted drag restores the last saved size without changing text.
      if (!drag) return;
      drag = undefined;
      showWidth(container, resource.width);
      view.requestMeasure();
    };
    handle.addEventListener("pointercancel", cancelDrag);
    handle.addEventListener("lostpointercapture", cancelDrag);
    handle.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      commit(clamp((resource.width || container.querySelector("img")?.getBoundingClientRect().width || 600)
        + (event.key === "ArrowRight" ? 10 : -10)));
    });

    // Read locally from the notes folder or IndexedDB. A blob URL lets <img>
    // display those bytes without uploading the image to an external service.
    void readImage(this.path, this.folder).then((blob) => {
      // The user may have switched notes before the read finished.
      if (resource.disposed) return;
      resource.url = URL.createObjectURL(blob);
      const image = document.createElement("img");
      image.alt = this.name;
      if (resource.width) image.style.width = `${resource.width}px`;
      // The actual image height is known after loading, so ask CodeMirror to
      // recalculate its layout and scrolling measurements.
      image.onload = () => { if (!resource.disposed) view.requestMeasure(); };
      image.onerror = () => {
        if (resource.disposed) return;
        container.textContent = `Could not display ${this.name}`;
        view.requestMeasure();
      };
      image.src = resource.url;
      const frame = document.createElement("span");
      frame.className = "cm-note-image-frame";
      frame.append(image, handle);
      container.replaceChildren(frame, toolbar);
      showWidth(container, resource.width);
      view.requestMeasure();
    }).catch((reason) => {
      if (resource.disposed) return;
      container.textContent = `Image unavailable: ${this.name}`;
      container.title = String(reason);
      view.requestMeasure();
    });
    return container;
  }

  destroy(container: HTMLElement) {
    // Stop late asynchronous updates and release the temporary blob URL when
    // CodeMirror removes the widget. The saved image file is not deleted.
    const resource = resources.get(container);
    if (!resource) return;
    resource.disposed = true;
    if (resource.url) URL.revokeObjectURL(resource.url);
  }
}

function imageDecorations(state: EditorState, folder: string | null): DecorationSet {
  const ranges: ReturnType<Decoration["range"]>[] = [];
  syntaxTree(state).iterate({
    enter(node) {
      // Image syntax inside a code example must remain literal text.
      if (["FencedCode", "CodeBlock", "InlineCode"].includes(node.name)) return false;
      if (node.name !== "Image") return;
      const image = noteAttachments(state.doc.sliceString(node.from, node.to))[0];
      if (!image) return false;
      const firstLine = state.doc.lineAt(node.from);
      const lastLine = state.doc.lineAt(node.to);
      const editing = state.selection.ranges.some((range) => range.from <= lastLine.to && range.to >= firstLine.from);
      // Images on their own line become block widgets. An image mixed with
      // paragraph text uses an inline widget so the surrounding text survives.
      const standalone = firstLine.from === lastLine.from &&
        !state.doc.sliceString(firstLine.from, node.from).trim() &&
        !state.doc.sliceString(node.to, lastLine.to).trim();
      const widget = new NoteImage(image.path, image.name, folder, image.width);
      // Keep the image visible while its Markdown is being edited. Outside
      // the active line, replace the reference with the image itself.
      ranges.push(editing
        ? Decoration.widget({ widget, block: standalone, side: 1 }).range(node.to)
        : Decoration.replace({ widget, block: standalone }).range(node.from, node.to));
      return false;
    },
  });
  return Decoration.set(ranges, true);
}

export function imagePreview(folder: string | null) {
  // Block images change editor height, so their decorations must be provided
  // directly through editor state rather than a viewport-only view plugin.
  return StateField.define<DecorationSet>({
    create: (state) => imageDecorations(state, folder),
    update(value, transaction) {
      return transaction.docChanged || transaction.selection ||
        syntaxTree(transaction.startState) !== syntaxTree(transaction.state)
        ? imageDecorations(transaction.state, folder) : value;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}
