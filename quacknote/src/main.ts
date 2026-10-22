import "./styles.css";

const notes = document.querySelector<HTMLTextAreaElement>("#notes")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;

// Restore saved notes when the app opens.
try {
  notes.value = localStorage.getItem("notes") ?? "";
} catch {
  status.textContent = "Could not load saved notes.";
}

// Save whenever the text changes.
notes.addEventListener("input", () => {
  try {
    localStorage.setItem("notes", notes.value);
    status.textContent = "Saved.";
  } catch {
    status.textContent = "Could not save. Copy your notes somewhere safe.";
  }
});