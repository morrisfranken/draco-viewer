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

This project now uses Electron to provide a standalone desktop application. The `install.sh` script sets up desktop integration for `.drc` files to open with this Electron app.

**Prerequisites:**
*   **Node.js and npm (or yarn):** Required to run Electron and install dependencies. You can install them from [nodejs.org](https://nodejs.org/) or your distribution's package manager.
*   **Source Files:** Ensure `main.js`, `preload.js`, `index.html`, `package.json`, and `drc-viewer.png` are present in the project directory (`/mnt/data2/source/drc_viewer/` or wherever you have it).

**Installation Steps**:
1.  **Install Node.js Dependencies**:
    Open a terminal in the project directory (e.g., `/mnt/data2/source/drc_viewer/`) and run:
    ```bash
    npm install
    ```
    This will download Electron and other necessary packages into a `node_modules` folder.

2.  **Make `install.sh` executable**:
    ```bash
    chmod +x install.sh
    ```
3.  **Run the installation script**:
    ```bash
    ./install.sh
    ```
    This script will:
    *   Copy `drc-viewer.png` to the user's icon theme directory (`~/.local/share/icons/hicolor/scalable/apps/`).
    *   Create a launcher script for the Electron application.
    *   Set up a `.desktop` file (for application menu and MIME association) and a custom MIME type for `.drc` files.
    *   Update your user's MIME database and icon cache.

    **Important:** After installation, if the custom icon for `.drc` files doesn't appear immediately in your file manager, **you may need to log out and log back in, or restart your computer.** This allows the desktop environment to fully pick up the new icon associations.

## Running the Viewer

**A. From File Manager (After Installation):**
*   Double-click any `.drc` file. It should open with the DRC Viewer Electron application.

**B. From Terminal (Development/Manual):**
1.  Navigate to the project directory:
    ```bash
    cd /path/to/your/drc_viewer_electron_project
    ```
2.  Run the app:
    ```bash
    npm start
    ```
3.  To open a specific file directly:
    ```bash
    npm start -- /path/to/your/model.drc
    ```
    (Note the `--` which separates arguments for `npm start` from arguments for your Electron app).

**C. Drag and Drop:**
*   Once the application is open, you can drag and drop `.drc` files onto the window to load them.

## Uninstallation

To remove the desktop integration and files installed by `install.sh`:
1.  Remove the launcher script: `rm -f ~/.local/share/drc-viewer/drc-viewer-launcher.sh` (and the `~/.local/share/drc-viewer` directory if empty and no longer needed).
2.  Remove the .desktop file: `rm -f ~/.local/share/applications/drc-viewer.desktop`
3.  Remove the icon file: `rm -f ~/.local/share/icons/hicolor/scalable/apps/drc-viewer.png`
4.  Remove the MIME type definition: `rm -f ~/.local/share/mime/packages/application-x-drc.xml`
5.  Update the MIME database: `update-mime-database ~/.local/share/mime`
6.  Update the icon cache: `gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor`
7.  You may need to manually change the default application for `.drc` files if another was previously set.
8.  (Optional) You can remove the project directory itself (including `node_modules`) if you no longer need the source code or installed dependencies.

## Troubleshooting
*   **File icons not showing for `.drc` files:** As mentioned above, log out and log back in, or restart your computer. Ensure `drc-viewer.png` is present in the source directory when `install.sh` is run.
*   **Application doesn't start:**
    *   Ensure Node.js and npm are installed correctly.
    *   Ensure you have run `npm install` in the project directory.
    *   Check for errors in the terminal when running `npm start`.