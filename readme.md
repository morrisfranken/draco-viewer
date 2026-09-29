# Draco Viewer

A small, fast viewer for Draco-compressed 3D data:

* **`.drc`**: Draco point clouds (with vertex colors) and meshes
* **`.glb`**: glTF binaries with Draco geometry (`KHR_draco_mesh_compression`), KTX2/Basis textures (`KHR_texture_basisu`) and unlit materials (`KHR_materials_unlit`)
* **`.obj`**: with its `.mtl` and diffuse textures (`map_Kd`: JPEG, PNG, WebP, BMP, TGA). Textured materials are shown unlit, untextured ones lit.

OBJ files load fast from network mounts (sftp, smb): the MTL and textures are read in parallel with the OBJ itself, textures decode while the OBJ is parsed in a worker, and texture names are matched case-insensitively. In the browser version, select or drop the `.obj` together with its `.mtl` and textures; the desktop app finds them next to the `.obj` by itself.

For OBJ files on a GNOME/gvfs sftp mount (`/run/user/<uid>/gvfs/sftp:host=…`), the desktop app skips the mount and reads the files over a single compressed SSH connection (`ssh -C`, using your `~/.ssh/config` and keys). OBJ text compresses about 3×, so large OBJs load 2× or more faster; the info line then shows "via SSH". It never prompts: when SSH needs a password or an unknown host key, or fails otherwise, the files are read through the mount as usual. Set `DRACO_VIEWER_NO_SSH=1` to turn this off.

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

This registers the app for `.drc` and `.glb` files (desktop entry, MIME types, icon), and lists it under "Open With" for `.obj` (it asks whether to make it the default for `.obj` too). If the file icons don't show up right away, log out and back in.

Opening another file while the viewer is running opens a new window in the existing process, which is faster than a cold start.

### Web version

```bash
docker compose up -d --build   # http://localhost:54080
```

The image builds the viewer itself (multi-stage `Dockerfile`), so the host only needs Docker. To update a server: `git pull && docker compose up -d --build`.

Models can be dropped onto the page, or passed in the URL: `?model=path/to/file.glb` (repeat `model=` to load several files).

## Project layout

| Path | Purpose |
| --- | --- |
| `web/` | Viewer source (`index.html`, `style.css`, `main.js`, `obj-worker.js`, `obj-refs.js` shared with Electron) |
| `build.mjs` | Bundles `web/main.js` with three.js via esbuild and copies the decoders into `dist/` |
| `main.js`, `preload.js` | Electron shell: window creation, file reading (incl. OBJ assets), single instance |
| `ssh-source.js` | Reads files on gvfs sftp mounts over one compressed SSH connection |
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
