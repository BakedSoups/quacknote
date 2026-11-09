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

## Spelling and grammar

Open **Tools → Auto correct** to check the current note and review suggested
corrections. Checks run only when you click **Check note**. Code blocks, inline
code, Markdown links, and wiki links are excluded. Corrections preserve the raw
Markdown and go through the normal note-saving flow.

The default engine is a local LanguageTool server. Start it from the app folder:

```sh
cd quacknote
docker compose up -d --build languagetool
```

The first build downloads Java and LanguageTool 6.6 from its official download
site. After building, the service runs on `http://127.0.0.1:8081/v2/check` inside
an internal Docker network without external network access. Its published port
is bound to the host's loopback interface. No notes directory is mounted into
the container. Stop it with `docker compose down` from the same folder.

Set the endpoint and language in **Settings → Auto correct** or the tool itself.
Local mode accepts only loopback addresses, rejects redirects, and never falls
back to the cloud. Local LanguageTool does not include the cloud's AI rules.

Alternatively, explicitly select **LanguageTool public API**. Clicking **Check
note** then sends the note's prose to `https://api.languagetool.org/v2/check`.
The public service permits manual POST checks and currently limits each request
to 20 KB. See the [public API rules](https://dev.languagetool.org/public-http-api.html)
and [local server documentation](https://dev.languagetool.org/http-server.html).

If Docker Desktop reports that Docker is unavailable in WSL, enable integration
for your distro in Docker Desktop's WSL settings before starting the service.

## Images and PDF export

Click **Stack** beside **Tools** to see images attached to the current note.
Use **Add images**, paste an image into the editor, or drop image files onto it.
PNG, JPEG, WebP, and GIF files up to 20 MB each are supported. Images stay local;
there is no upload to an external service.

With a notes folder selected, images are saved under
`assets/<image-group-id>/<image-id>.<extension>`. Each note's Markdown references
its own images, so the association survives note renames and app restarts.
In browser mode, image blobs are kept in IndexedDB, separate from localStorage.
**Import existing notes** copies their images into the chosen Markdown folder too.
Copy the notes folder together with its `assets` directory when backing it up.

**Tools → Export as PDF** opens a clean print version of the current note with
its local images. Choose **Save as PDF** in the print dialog. The sidebar,
editor controls, and raw Markdown markers are excluded. External image URLs are
not fetched for export. The native print dialog still requires testing on the
target desktop platform.

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
