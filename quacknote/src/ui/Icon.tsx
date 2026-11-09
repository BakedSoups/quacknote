type IconName = "folder" | "panel" | "plus" | "settings" | "search" | "close" | "tools" | "stack" | "image" | "fullscreen" | "minimize";
const paths: Record<IconName, string> = {
  fullscreen: "M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5",
  minimize: "M3 8h5V3M21 8h-5V3M8 21v-5H3M16 21v-5h5",
  stack: "m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5",
  image: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 14 5-5 4 4 4-6 5 7M9 8h.01",
  tools: "m4 20 9-9M14 3a6 6 0 0 0-3 8l2 2a6 6 0 0 0 8-7l-4 4-3-3 4-4h-4Z",
  folder: "M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Zm0 2h18",
  panel: "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm4 0v18",
  plus: "M12 5v14M5 12h14",
  settings: "M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3Zm3 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  close: "M6 6l12 12M18 6 6 18",
};
export default function Icon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
