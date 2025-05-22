# Readme
A simple web-based viewer for Draco (.drc) 3D models, featuring dynamic lighting (shading) and basic viewing controls. 
It allows users to load models via drag-and-drop. For local setups, it supports opening `.drc` files directly from the file manager after installation.

## Features

*   Loads and displays `.drc` (Draco compressed) 3D models.
*   Basic orbital camera controls (zoom, pan, rotate).
*   Dynamic lighting that follows the camera.
*   Togglable ground plane, wireframe mode, and backface culling.
*   Drag-and-drop support for `.drc` files directly onto the browser window.
*   Desktop integration (via `install.sh`):
    *   **Local Server:** Double-clicking a `.drc` file directly loads the model in the viewer.
    *   **Remote Server:** Double-clicking opens the viewer URL; user must then drag-and-drop the file.

## Setup and Installation (Linux Desktop Integration)

The `install.sh` script sets up desktop integration for `.drc` files.

**Prerequisites for Local Direct Open:**
*   The script assumes `index.html`, `start.sh`, and (optionally) `drc-viewer.png` are in the same directory as `install.sh` when you run it.
*   These files (`index.html`, `start.sh`, and `drc-viewer.png` for the favicon) will be symlinked into `~/.local/share/drc-viewer/`. **The original source directory must remain accessible for these symlinks to work.**
*   If you want a default model when opening the base URL, place or symlink `model.drc` into `~/.local/share/drc-viewer/`.

**Installation Steps**:
1.  **Make `install.sh` executable**:
    ```bash
    chmod +x install.sh
    ```
2.  **Run the installation script**:
    ```bash
    ./install.sh
    ```
    This script will:
    *   Create `~/.local/share/drc-viewer/`.
    *   Symlink `start.sh`, `index.html`, and `drc-viewer.png` (for favicon) from your source directory to `~/.local/share/drc-viewer/`.
    *   Copy `drc-viewer.png` (if present) as the desktop icon.
    *   Create a launcher script `~/.local/share/drc-viewer/drc-viewer-launcher.sh` which attempts to start the local server if not running, and symlinks the selected `.drc` file for viewing.
    *   Set up a `.desktop` file and custom MIME type.

    You might need to log out and log back in for all changes (especially MIME type associations and icons) to take full effect.

## Running the Viewer

**A. Local Server with Direct File Open:**

1.  **Run `install.sh`**: This will set up symlinks for `index.html` and `start.sh` in `~/.local/share/drc-viewer/`.
2.  **Open `.drc` files**:
    *   **From File Manager**: Double-click any `.drc` file. The launcher script will attempt to start the server (`./start.sh` in `~/.local/share/drc-viewer/`) if it's not already running on port 8090. The model should then load directly.
    *   **Drag and Drop**: If the server is running (either manually started or auto-started by the launcher), open `http://0.0.0.0:8090/` in your browser and drag a `.drc` file into the window.
    *   **Default Model**: If `model.drc` exists (or is symlinked) in `~/.local/share/drc-viewer/`, it will be loaded by default when you open `http://0.0.0.0:8090/` without any specific model parameters.

    *Note on server auto-start*: The launcher script does a basic check for a service on port 8090. If it starts the server, it does so in the background. You won't see server output unless you run `start.sh` manually in a terminal.

**B. Remote Server (or local server not using `~/.local/share/drc-viewer/` as webroot):**

1.  **Deploy `index.html`**: Place `index.html` (and any default `model.drc`) in your web server's document root.
2.  **Configure Launcher (Optional for Desktop Clicks)**: If you want double-click to open your remote viewer URL, you'd need to edit `~/.local/share/drc-viewer/drc-viewer-launcher.sh` and change `SERVER_URL` to your remote server's address. The file copying part of the launcher script would be ineffective for a remote server.
3.  **Open `.drc` files**:
    *   **Drag and Drop**: This is the primary method. Open your viewer's URL and drag-and-drop files.
    *   **From File Manager (with configured launcher)**: Double-clicking will open the viewer URL. **You will then need to drag and drop the file into the browser window** due to browser security restrictions preventing remote pages from accessing local files directly via `file:///` URIs.

## Remote Server - Advanced Automatic Loading (Requires Backend)

For a remote server to automatically load a model selected on the user's desktop without drag-and-drop, you would need a more complex setup:
1.  The desktop launcher script (`drc-viewer-launcher.sh`) would need to POST the file content to a specific endpoint on your remote server.
2.  Your remote server would require a backend application to receive this file, store it temporarily, and provide a way for `index.html` to load it (e.g., via a unique URL).
This is significantly more complex than the current static viewer.

## Development / Manual Start (without desktop integration)

1.  Place `index.html` in a directory. If you want a default model, place `model.drc` there too.
2.  Run a web server from that directory. For example, using the provided `start.sh`:
    ```bash
    ./start.sh 
    ```
3.  Open your web browser to `http://0.0.0.0:8090/`.
4.  Drag and drop `.drc` files to view them.

## Uninstallation

To remove the desktop integration and files installed by `install.sh`:
1.  Remove the installation directory (this will remove symlinks and the launcher): `rm -rf ~/.local/share/drc-viewer`
2.  Remove the .desktop file: `rm ~/.local/share/applications/drc-viewer.desktop`
3.  Remove the icon file (if installed): `rm ~/.local/share/icons/hicolor/scalable/apps/drc-viewer.png`
4.  Remove the MIME type definition: `rm ~/.local/share/mime/packages/application-x-drc.xml`
5.  Update the MIME database: `update-mime-database ~/.local/share/mime`
6.  Update the icon cache (if `gtk-update-icon-cache` was used): `gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor`
7.  You may need to manually change the default application for `.drc` files if another was previously set or if you want to associate them with a different program.