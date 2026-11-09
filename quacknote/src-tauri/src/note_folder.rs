use serde::Serialize;
use std::{collections::HashMap, fs, path::{Path, PathBuf}, sync::{Arc, Mutex}};
use std::io::Write;
use tauri::Manager;

#[derive(Clone, Serialize)]
pub struct Note {
    id: String,
    title: String,
    content: String,
}

#[derive(Serialize)]
pub struct Folder {
    path: String,
    notes: Vec<Note>,
}

struct SavedFile {
    name: String,
    content: String,
}

#[derive(Default)]
pub struct FolderState {
    path: Option<PathBuf>,
    files: HashMap<String, SavedFile>,
}

pub type SharedFolder = Arc<Mutex<FolderState>>;

fn read_folder(path: &Path) -> Result<(Folder, FolderState), String> {
    let path = path.canonicalize().map_err(|e| e.to_string())?;
    let mut state = FolderState { path: Some(path.clone()), files: HashMap::new() };
    let mut notes = Vec::new();
    for entry in fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        // Only ordinary Markdown files in this folder; do not follow links.
        if !entry.file_type().map_err(|e| e.to_string())?.is_file() { continue; }
        let file = entry.path();
        if !file.extension().and_then(|s| s.to_str()).is_some_and(|s| s.eq_ignore_ascii_case("md")) { continue; }
        let name = entry.file_name().into_string().map_err(|_| "A Markdown filename is not valid UTF-8")?;
        let content = fs::read_to_string(&file).map_err(|e| format!("Cannot read {name}: {e}"))?;
        let title = file.file_stem().unwrap().to_string_lossy().into_owned();
        notes.push(Note { id: name.clone(), title, content: content.clone() });
        state.files.insert(name.clone(), SavedFile { name, content });
    }
    notes.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok((Folder { path: path.to_string_lossy().into_owned(), notes }, state))
}

fn safe_stem(title: &str) -> String {
    let title: String = title.chars().map(|c| {
        if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c }
    }).take(100).collect();
    let title = title.trim().trim_matches('.').trim();
    if title.is_empty() { "Untitled note".into() } else { title.into() }
}

fn save(state: &mut FolderState, id: String, title: String, content: String) -> Result<(), String> {
    let folder = state.path.as_ref().ok_or("Choose a notes folder first")?;
    let previous = state.files.get(&id);
    if let Some(previous) = previous {
        let path = folder.join(&previous.name);
        if fs::symlink_metadata(&path).map_err(|e| e.to_string())?.file_type().is_symlink() {
            return Err("The note was replaced by a symbolic link. Reopen the folder.".into());
        }
        let actual = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        if actual != previous.content {
            return Err(format!("{} changed outside Quack Note. Save paused to avoid overwriting it.", previous.name));
        }
    }

    // Write a complete temporary file before replacing the original.
    let mut temporary = tempfile::NamedTempFile::new_in(folder).map_err(|e| e.to_string())?;
    temporary.write_all(content.as_bytes()).map_err(|e| e.to_string())?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    let stem = safe_stem(&title);
    let desired = format!("{stem}.md");
    let old_name = previous.map(|p| p.name.clone());
    let name = if old_name.as_deref() == Some(&desired) {
        temporary.persist(folder.join(&desired)).map_err(|e| e.to_string())?;
        desired
    } else {
        // Never overwrite another note with the same title, including files
        // added by another application after this folder was opened.
        let mut number = 1;
        let name = loop {
            let candidate = if number == 1 { desired.clone() } else { format!("{stem} ({number}).md") };
            match temporary.persist_noclobber(folder.join(&candidate)) {
                Ok(_) => break candidate,
                Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
                    // A collision-suffixed filename may already be ours.
                    temporary = error.file;
                    if old_name.as_deref() == Some(&candidate) {
                        temporary.persist(folder.join(&candidate)).map_err(|e| e.to_string())?;
                        break candidate;
                    }
                    number += 1;
                }
                Err(error) => return Err(error.to_string()),
            }
        };
        if let Some(old_name) = old_name {
            if old_name != name { fs::remove_file(folder.join(old_name)).map_err(|e| e.to_string())?; }
        }
        name
    };
    state.files.insert(id, SavedFile { name, content });
    Ok(())
}

async fn activate(path: PathBuf, shared: SharedFolder) -> Result<Folder, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (folder, state) = read_folder(&path)?;
        *shared.lock().map_err(|e| e.to_string())? = state;
        Ok(folder)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn choose_notes_folder(app: tauri::AppHandle, state: tauri::State<'_, SharedFolder>) -> Result<Option<Folder>, String> {
    let mut dialog = rfd::AsyncFileDialog::new().set_title("Choose your Markdown notes folder");
    if let Ok(home) = app.path().home_dir() {
        let suggested = home.join("Quacknote Notes");
        dialog = dialog.set_directory(if suggested.is_dir() { suggested } else { home });
    }
    let Some(folder) = dialog.pick_folder().await else { return Ok(None); };
    activate(folder.path().to_path_buf(), state.inner().clone()).await.map(Some)
}

#[tauri::command]
pub async fn reopen_notes_folder(path: String, state: tauri::State<'_, SharedFolder>) -> Result<Folder, String> {
    activate(PathBuf::from(path), state.inner().clone()).await
}

#[tauri::command]
pub async fn save_markdown_note(id: String, title: String, content: String, state: tauri::State<'_, SharedFolder>) -> Result<(), String> {
    let shared = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut state = shared.lock().map_err(|e| e.to_string())?;
        save(&mut state, id, title, content)
    }).await.map_err(|e| e.to_string())?
}

fn image_path(state: &FolderState, relative: &str, create: bool) -> Result<PathBuf, String> {
    let parts: Vec<&str> = relative.split('/').collect();
    let valid_id = |text: &str| text.len() == 36 && text.chars().all(|c| c.is_ascii_hexdigit() || c == '-');
    if parts.len() != 3 || parts[0] != "assets" || !valid_id(parts[1]) {
        return Err("Invalid image path".into());
    }
    let (id, extension) = parts[2].split_once('.').ok_or("Invalid image filename")?;
    if !valid_id(id) || !matches!(extension, "png" | "jpg" | "webp" | "gif") {
        return Err("Invalid image filename".into());
    }
    let mut path = state.path.clone().ok_or("Choose a notes folder first")?;
    for part in &parts[..2] {
        path.push(part);
        if create {
            match fs::create_dir(&path) {
                Ok(()) => {},
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {},
                Err(error) => return Err(error.to_string()),
            }
        }
        let metadata = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
        if !metadata.file_type().is_dir() { return Err("Image folders must be ordinary directories".into()); }
    }
    path.push(parts[2]);
    Ok(path)
}

fn read_image(state: &FolderState, relative: &str) -> Result<Vec<u8>, String> {
    let path = image_path(state, relative, false)?;
    let metadata = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
    if !metadata.file_type().is_file() || metadata.len() > 20 * 1024 * 1024 {
        return Err("Image must be an ordinary file no larger than 20 MB".into());
    }
    fs::read(path).map_err(|e| e.to_string())
}

fn write_image(state: &FolderState, relative: &str, bytes: &[u8]) -> Result<(), String> {
    if bytes.len() > 20 * 1024 * 1024 { return Err("Image exceeds 20 MB".into()); }
    let valid = if relative.ends_with(".png") {
        bytes.starts_with(&[137, 80, 78, 71, 13, 10, 26, 10])
    } else if relative.ends_with(".jpg") {
        bytes.starts_with(&[255, 216, 255])
    } else if relative.ends_with(".gif") {
        bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a")
    } else if relative.ends_with(".webp") {
        bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP".as_slice())
    } else { false };
    if !valid { return Err("Unsupported image format".into()); }
    let path = image_path(state, relative, true)?;
    let mut temporary = tempfile::NamedTempFile::new_in(path.parent().unwrap()).map_err(|e| e.to_string())?;
    temporary.write_all(bytes).map_err(|e| e.to_string())?;
    temporary.as_file().sync_all().map_err(|e| e.to_string())?;
    match temporary.persist_noclobber(&path) {
        Ok(_) => Ok(()),
        Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
            if read_image(state, relative)? == bytes { Ok(()) } else { Err("An image already exists at that path".into()) }
        }
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub async fn save_note_image(path: String, bytes: Vec<u8>, state: tauri::State<'_, SharedFolder>) -> Result<(), String> {
    let shared = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = shared.lock().map_err(|e| e.to_string())?;
        write_image(&state, &path, &bytes)
    }).await.map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn read_note_image(path: String, state: tauri::State<'_, SharedFolder>) -> Result<Vec<u8>, String> {
    let shared = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let state = shared.lock().map_err(|e| e.to_string())?;
        read_image(&state, &path)
    }).await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn images_are_local_and_cannot_escape_the_assets_folder() {
        let folder = tempfile::tempdir().unwrap();
        let (_, state) = read_folder(folder.path()).unwrap();
        let path = "assets/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.png";
        let bytes = [137, 80, 78, 71, 13, 10, 26, 10];
        write_image(&state, path, &bytes).unwrap();
        assert_eq!(read_image(&state, path).unwrap(), bytes);
        assert!(image_path(&state, "../outside.png", true).is_err());
        assert!(image_path(&state, "assets/../outside.png", true).is_err());
        assert!(write_image(&state, path, b"not an image").is_err());
    }

    #[test]
    fn saves_raw_markdown_and_renames_without_overwriting() {
        let folder = tempfile::tempdir().unwrap();
        fs::write(folder.path().join("Existing.md"), "untouched").unwrap();
        let (_, mut state) = read_folder(folder.path()).unwrap();
        save(&mut state, "new".into(), "Existing".into(), "- [x] hello".into()).unwrap();
        assert_eq!(fs::read_to_string(folder.path().join("Existing.md")).unwrap(), "untouched");
        assert_eq!(fs::read_to_string(folder.path().join("Existing (2).md")).unwrap(), "- [x] hello");
        save(&mut state, "new".into(), "Renamed".into(), "```python\nprint(1)\n```".into()).unwrap();
        assert!(!folder.path().join("Existing (2).md").exists());
        assert!(folder.path().join("Renamed.md").exists());
        fs::write(folder.path().join("Renamed.md"), "external edit").unwrap();
        assert!(save(&mut state, "new".into(), "Renamed".into(), "overwrite".into()).is_err());
    }
}
