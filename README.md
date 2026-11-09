# Quacknote
a note app that's highly opinionated and not serious 
all local 

## Markdown folder storage

Run the desktop app from `quacknote/` with `npm run tauri dev` after installing
Rust and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/).
The browser-only Vite page cannot open the native folder picker.

Choose **Choose notes folder** to open a folder of `.md` files. Notes autosave
after a short pause; the folder path and save status appear above the editor.
**Import existing notes** copies the older locally stored notes into that folder.
The older local copy is retained. Once a folder is selected, note content is saved
to Markdown files, with only folder/selection preferences kept in local storage.

Changing a title renames its file. Duplicate titles get numbered filenames rather
than replacing existing notes. Saves pause with an error if a file has changed
outside the app. Reopen the folder to read external edits before continuing.

## Features
Alex:
- markdown viewer based 
- Latex Support
- quick auto correct 

Eric: 
- Google account syncing in app 
-   get access to calendar
-   Drive Access
- Google tagging 
  
- SUPER TAGGING LINKS
Example: 
```md
## Todo list
  - preppare for [[google:interview]] 
```
