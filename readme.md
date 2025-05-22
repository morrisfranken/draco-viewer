# Readme
A simple web-based viewer for Draco (.drc) 3D models, featuring dynamic lighting (shading) and basic viewing controls. It allows users to load models via drag-and-drop, or by opening `.drc` files directly from the file manager after installation (which will prompt for drag-and-drop).

## Features

*   Loads and displays `.drc` (Draco compressed) 3D models via drag-and-drop.
*   Basic orbital camera controls (zoom, pan, rotate).
*   Dynamic lighting that follows the camera.
*   Togglable ground plane, wireframe mode, and backface culling.
*   Desktop integration (via `create.sh`): double-clicking a `.drc` file opens the viewer and indicates which file was selected, prompting the user to then drag-and-drop it.

## Setup and Installation (Linux Desktop Integration)

The `create.sh` script sets up desktop integration (e.g., for Nautilus on Ubuntu) to recognize `.drc` files.

**Prerequisites**:
*   You must have a web server configured to serve the `index.html` file. The `start.sh` script (a simple Python HTTP server) is provided for local testing.
*   Place `index.html` (and `model.drc` if you want a default model) in the root directory of your web server.

**Installation Steps**:
1.  **Make `create.sh` executable**:
    ```bash
    chmod +x create.sh
    ```
2.  **Run the installation script**:
    ```bash
    ./create.sh
    ```
    This script will:
    *   Create a directory `~/.local/share/drc-viewer/` primarily for a launcher script. It no longer copies `index.html` or `model.drc`.
    *   Create the launcher script `~/.local/share/drc-viewer/drc-viewer-launcher.sh`.
    *   Set up a `.desktop` file in `~/.local/share/applications/`.
    *   Define a custom MIME type for `.drc` files in `~/.local/share/mime/packages/`.
    *   Update your user's MIME database.
    *   Attempt to set the viewer as the default application for `.drc` files.

    You might need to log out and log back in for all changes (especially MIME type associations and icons) to take full effect.
    Ensure the `SERVER_URL` in `~/.local/share/drc-viewer/drc-viewer-launcher.sh` points to where your `index.html` is served. By default, it's `http://0.0.0.0:8090`.

## Running the Viewer

1.  **Start your web server**:
    *   Ensure `index.html` is in your server's document root.
    *   If using the provided `start.sh` for local testing:
        Navigate to the directory containing your `index.html` and run:
        ```bash
        ~/.local/share/drc-viewer/start.sh 
        # Or, if start.sh was copied from source to your project dir: ./start.sh
        ```
        This typically starts a server on `http://0.0.0.0:8090`. Keep this terminal open.

2.  **Open `.drc` files**:
    *   **From File Manager**: After running `create.sh`, double-click any `.drc` file. Your default web browser should open to the viewer URL. The viewer will display a message indicating which file was selected. **Due to browser security restrictions, you will then need to drag and drop that same `.drc` file into the browser window to load it.**
    *   **Drag and Drop**: Open the viewer URL (e.g., `http://0.0.0.0:8090/`) in your browser and drag a `.drc` file into the window.
    *   **Default Model**: If you placed a `model.drc` in your web server's root, it will be attempted by default if no other file is specified or requested via desktop integration.

## Development / Manual Start (without desktop integration)

1.  Place `index.html` in a directory. If you want a default model, place `model.drc` there too.
2.  Run a web server from that directory. For example, using the provided `start.sh`:
    ```bash
    ./start.sh 
    ```
3.  Open your web browser to `http://0.0.0.0:8090/`.
4.  Drag and drop `.drc` files to view them.

## Uninstallation

To remove the desktop integration and files installed by `create.sh`:
1.  Remove the installation directory: `rm -rf ~/.local/share/drc-viewer`
2.  Remove the .desktop file: `rm ~/.local/share/applications/drc-viewer.desktop`
3.  Remove the MIME type definition: `rm ~/.local/share/mime/packages/application-x-drc.xml`
4.  Update the MIME database: `update-mime-database ~/.local/share/mime`
5.  You may need to manually change the default application for `.drc` files if another was previously set or if you want to associate them with a different program.