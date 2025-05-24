# DRC Model Viewer

A web-based and desktop application for viewing Draco (.drc) 3D models, featuring dynamic lighting, basic viewing controls, and settings persistence.

## Features

*   Loads and displays `.drc` (Draco compressed) 3D models.
*   Basic orbital camera controls (zoom, pan, rotate).
*   Dynamic lighting that follows the camera.
*   Adjustable background (Solid Color or HDR environment map).
*   Togglable backface culling.
*   User settings (background choice, culling) persisted in `localStorage`.
*   Collapsible controls panel.
*   **Electron Desktop Application:**
    *   Provides a standalone viewer.
    *   Integrates with the Linux desktop environment (via `installers/ubuntu.sh`) to open `.drc` files directly from the file manager.
    *   Supports opening `.drc` files passed as command-line arguments.
    *   Drag-and-drop support for `.drc` files onto the application window.
*   **Web Version (via Docker & Nginx):**
    *   Can be served as a web page using Docker and Nginx.
    *   Users can access the viewer through a web browser and use drag-and-drop to load models.

## Running the Viewer

There are two main ways to run the DRC Viewer:

### 1. Electron Desktop Application (Recommended for Desktop Use)

This provides the best experience for local file viewing and desktop integration.

**Prerequisites:**
*   **Node.js and npm (or yarn):** Required to run Electron and install dependencies. Install from [nodejs.org](https://nodejs.org/) or your distribution's package manager.
*   **Project Files:** Ensure `main.js`, `preload.js`, `index.html`, `package.json`, and `drc-viewer.png` are in the project directory.

**Running Manually (Development/Testing):**
1.  Navigate to the project directory (e.g., `/path/to/your/drc_viewer_project/`):
    ```bash
    cd /path/to/your/drc_viewer_project
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
    This downloads Electron and other packages into a `node_modules` folder.
3.  Run the app:
    ```bash
    npm start
    ```
4.  To open a specific file directly from the terminal:
    ```bash
    npm start -- /path/to/your/model.drc
    ```
    (Note: The `--` separates arguments for `npm start` from arguments for the Electron app).

**Linux Desktop Integration (Ubuntu/Debian-based):**
The `installers/ubuntu.sh` script sets up desktop integration for `.drc` files to open with the Electron app.

1.  **Ensure Prerequisites:** Node.js, npm, and project files are ready as described above.
2.  **Navigate to the project directory** in your terminal.
3.  **Install Node.js Dependencies** (if not already done):
    ```bash
    npm install
    ```
4.  **Make the installer executable**:
    ```bash
    chmod +x installers/ubuntu.sh
    ```
5.  **Run the installation script**:
    ```bash
    ./installers/ubuntu.sh
    ```
    This script will:
    *   Copy `drc-viewer.png` to the user's icon theme directory.
    *   Create a launcher script for the Electron application.
    *   Set up a `.desktop` file (for application menu and MIME association) and a custom MIME type for `.drc` files.
    *   Update your user's MIME database and icon cache.

    **Important:** After installation, if the custom icon for `.drc` files or the application menu entry doesn't appear immediately, **you may need to log out and log back in, or restart your computer.**

**Using After Installation:**
*   **From File Manager:** Double-click any `.drc` file.
*   **From Application Menu:** Search for "DRC Viewer" and launch it.
*   **Drag and Drop:** Once the application is open, drag and drop `.drc` files onto the window.

### 2. Web Version (via Docker & Nginx)

This method is suitable for serving the viewer as a web page, accessible via a browser. It does not provide direct desktop file association.

**Prerequisites:**
*   **Docker and Docker Compose:** Install from [docker.com](https://www.docker.com/get-started).
*   **Project Files:** Ensure `Dockerfile`, `docker-compose.yml`, `nginx.conf`, and `index.html` (and its resources like `royal_esplanade_1k.hdr`) are in the project directory.

**Setup and Running:**
1.  **Navigate to the project directory** in your terminal.
2.  **Build and run the Docker container using Docker Compose:**
    ```bash
    docker-compose up -d
    ```
    This command will:
    *   Build the Docker image based on `Dockerfile` (which uses Nginx to serve `index.html`).
    *   Start a container in detached mode (`-d`).
3.  **Access the viewer:**
    Open your web browser and navigate to `http://localhost:8080` (or the port configured in `docker-compose.yml` and `nginx.conf`).
4.  **Load models:** Use the drag-and-drop functionality in the browser.

**Stopping the Docker Container:**
```bash
docker-compose down
```

## Uninstallation (Linux Desktop Integration)

To remove the desktop integration and files installed by `installers/ubuntu.sh`:
1.  Remove the launcher script: `rm -f ~/.local/bin/drc-viewer-launcher` (or the path used by your `ubuntu.sh` if different, e.g., `~/.local/share/drc-viewer/drc-viewer-launcher.sh`).
2.  Remove the parent directory if it was created specifically for the launcher and is now empty: `rmdir ~/.local/share/drc-viewer` (if applicable).
3.  Remove the .desktop file: `rm -f ~/.local/share/applications/drc-viewer.desktop`
4.  Remove the icon file: `rm -f ~/.local/share/icons/hicolor/scalable/apps/drc-viewer.png`
5.  Remove the MIME type definition: `rm -f ~/.local/share/mime/packages/application-x-drc.xml`
6.  Update the MIME database: `update-mime-database ~/.local/share/mime`
7.  Update the icon cache: `gtk-update-icon-cache -f -t ~/.local/share/icons/hicolor`
8.  (Optional) You can remove the project directory itself (including `node_modules`) if you no longer need the source code or installed dependencies.

## Troubleshooting
*   **File icons not showing for `.drc` files (Linux):** Log out and log back in, or restart your computer. Ensure `drc-viewer.png` is present in the source directory when `installers/ubuntu.sh` is run.
*   **Electron Application doesn't start:**
    *   Ensure Node.js and npm are installed correctly.
    *   Ensure you have run `npm install` in the project directory.
    *   Check for errors in the terminal when running `npm start`.
*   **Docker version issues:**
    *   Ensure `docker-compose up -d` completes without errors.
    *   Check container logs: `docker-compose logs -f`
    *   Ensure Nginx is configured correctly in `nginx.conf` and that `index.html` is being served from the correct location within the container (see `Dockerfile`).