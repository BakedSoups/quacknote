import { invoke, isTauri } from "@tauri-apps/api/core";

export type Attachment = { path: string; name: string };

// Storage validates file locations, not image formats or Markdown syntax.
// Native commands currently accept images; new file types can extend that
// backend without coupling this storage layer to an image decoder.
const assetPattern = /^assets\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.[a-z0-9]+$/;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("quacknote.attachments", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function localAttachment(path: string, blob?: Blob): Promise<Blob> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("images", blob ? "readwrite" : "readonly");
    const store = transaction.objectStore("images");
    const request = blob ? store.put(blob, path) : store.get(path);
    let result: Blob | undefined;
    request.onsuccess = () => { result = blob ?? request.result; };
    transaction.oncomplete = () => {
      db.close();
      if (result instanceof Blob) resolve(result); else reject(new Error("Attachment not found in local storage."));
    };
    transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("Attachment storage failed.")); };
  });
}

// Keep the existing database and object-store names to preserve older images.
export async function storeAttachment(path: string, blob: Blob, folder: string | null) {
  if (!assetPattern.test(path)) throw new Error("Invalid attachment path.");
  if (folder && isTauri()) {
    await invoke("save_note_image", { path, bytes: Array.from(new Uint8Array(await blob.arrayBuffer())) });
  } else {
    await localAttachment(path, blob);
  }
}

export async function readAttachment(path: string, folder: string | null): Promise<Blob> {
  if (!assetPattern.test(path)) throw new Error("Invalid attachment path.");
  if (folder && isTauri()) {
    const bytes = new Uint8Array(await invoke<number[]>("read_note_image", { path }));
    return new Blob([bytes]);
  }
  return localAttachment(path);
}

// Callers supply references; storage does not need to parse the note itself.
export async function migrateAttachments(attachments: Attachment[], folder: string) {
  for (const attachment of attachments) {
    await storeAttachment(attachment.path, await readAttachment(attachment.path, null), folder);
  }
}
