// Load the app's CSS.
import "./styles.css";

// Import the Markdown-to-HTML parser and HTML sanitizer.
import { marked } from "marked";
import DOMPurify from "dompurify";

// Find the editor, preview area, and status message in index.html.
const notes = document.querySelector<HTMLTextAreaElement>("#notes")!;
const preview = document.querySelector<HTMLDivElement>("#preview")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

// Restore the saved note, or use an empty string if no note was saved.
notes.value = localStorage.getItem("notes") ?? "";

// Turn the Markdown in the editor into safe HTML and show it in the preview.
async function updatePreview() {
  const html = await marked.parse(notes.value); // Convert Markdown to HTML.
  preview.innerHTML = DOMPurify.sanitize(html); // Sanitize it before displaying.
}

// Render the saved note when the app opens.
void updatePreview();

// When the user types, save the note and refresh the preview.
notes.addEventListener("input", () => {
  localStorage.setItem("notes", notes.value);
  status.textContent = "Saved.";
  void updatePreview();
});