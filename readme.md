# Draco Viewer

A small, fast viewer for Draco-compressed 3D data:

* **`.drc`**: Draco point clouds (with vertex colors) and meshes
* **`.glb`**: glTF binaries with Draco geometry (`KHR_draco_mesh_compression`), KTX2/Basis textures (`KHR_texture_basisu`) and unlit materials (`KHR_materials_unlit`)

Select or drop several files at once to view them together in one scene (e.g. tiles, or a mesh with its point cloud).

It runs as an Electron desktop app (double-click files in the file manager) and as a static web page. Everything, including the Draco decoder and Basis transcoder, is bundled locally, so it needs no network access.

## Controls

| Action | Input |
| --- | --- |
| Rotate | Left drag |
| Pan | Right drag, or Shift + drag |
| Zoom | Scroll (zooms towards the cursor) |
| Set orbit pivot | Double-click on the model |
| Frame model | `F`, or double-click the background |
| Open file | `O` / `Ctrl+O`, or drag & drop |
| Backface culling | `B` |
| Point size (point clouds) | `[` / `]` or the slider |
| Background (dark / gray / light) | `G` |
| Fullscreen | `F11` |
| Developer tools (Electron) | `F12` |

Culling, background and point size are remembered between sessions.

## Setup

Requires Node.js and npm.

```bash
npm install        # installs Electron, three.js, esbuild and builds dist/
npm start -- data/examples/3GJ8D_199_0.glb
```

`npm run build` rebuilds `dist/` after changing anything in `web/`, and `npm run dev` rebuilds on every change.

### Desktop integration (Ubuntu / Debian)

```bash
./installers/ubuntu.sh
```

This registers the app for `.drc` and `.glb` files (desktop entry, MIME types, icon). If the file icons don't show up right away, log out and back in.

Opening another file while the viewer is running opens a new window in the existing process, which is faster than a cold start.

### Web version

```bash
npm run build
docker compose up -d   # http://localhost:54080
```

Models can be dropped onto the page, or passed in the URL: `?model=path/to/file.glb` (repeat `model=` to load several files).

## Project layout

| Path | Purpose |
| --- | --- |
| `web/` | Viewer source (`index.html`, `style.css`, `main.js`) |
| `build.mjs` | Bundles `web/main.js` with three.js via esbuild and copies the decoders into `dist/` |
| `main.js`, `preload.js` | Electron shell: window creation, command-line files, single instance |
| `installers/ubuntu.sh` | Linux desktop integration |

## Uninstall (Linux desktop integration)

```bash
rm -rf ~/.local/share/draco-viewer
rm -f ~/.local/share/applications/draco-viewer.desktop
rm -f ~/.local/share/icons/hicolor/scalable/apps/draco-viewer.svg
rm -f ~/.local/share/mime/packages/application-x-drc.xml ~/.local/share/mime/packages/model-gltf-binary.xml
update-mime-database ~/.local/share/mime
gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor
```
