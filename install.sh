#!/bin/bash

# 'Installing' this as a web-application on ubuntu

# Installation directory for the viewer files
INSTALL_DIR="$HOME/.local/share/drc-viewer"
APP_NAME="drc-viewer"
DESKTOP_FILE_NAME="$APP_NAME.desktop"
MIME_TYPE="application/x-drc"
MIME_XML_FILE="application-x-drc.xml"
ICON_NAME="drc-viewer" # Icon name without extension
SOURCE_ICON_FILE="drc-viewer.png"
SOURCE_INDEX_FILE="index.html"
SOURCE_START_SCRIPT="start.sh"

echo "DRC Viewer Installer"
echo "--------------------"
echo "This script will install the DRC Viewer for the current user."
echo "It will create files in:"
echo "  Application files: $INSTALL_DIR"
echo "  Desktop entry: $HOME/.local/share/applications/"
echo "  MIME type: $HOME/.local/share/mime/"
echo "  Icon file: $HOME/.local/share/icons/hicolor/scalable/apps/"
echo ""
read -p "Do you want to continue? (y/N) " choice
case "$choice" in
  y|Y ) echo "Proceeding with installation...";;
  * ) echo "Installation aborted."; exit 0;;
esac

# Create installation directory
mkdir -p "$INSTALL_DIR"
if [ $? -ne 0 ]; then
    echo "Error: Could not create installation directory $INSTALL_DIR"
    exit 1
fi
echo "Created directory $INSTALL_DIR."

# Symlink start.sh to the installation directory.
SCRIPT_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_SOURCE_DIR/$SOURCE_START_SCRIPT" ]; then
    ln -sf "$SCRIPT_SOURCE_DIR/$SOURCE_START_SCRIPT" "$INSTALL_DIR/$SOURCE_START_SCRIPT"
    chmod +x "$INSTALL_DIR/$SOURCE_START_SCRIPT" # chmod follows symlinks for the target
    echo "Symlinked $SOURCE_START_SCRIPT to $INSTALL_DIR/."
else
    echo "Warning: $SOURCE_START_SCRIPT not found in source directory. Local server functionality might be affected."
fi

# Symlink index.html to the installation directory
if [ -f "$SCRIPT_SOURCE_DIR/$SOURCE_INDEX_FILE" ]; then
    ln -sf "$SCRIPT_SOURCE_DIR/$SOURCE_INDEX_FILE" "$INSTALL_DIR/$SOURCE_INDEX_FILE"
    echo "Symlinked $SOURCE_INDEX_FILE to $INSTALL_DIR/."
else
    echo "Warning: $SOURCE_INDEX_FILE not found in source directory. Viewer will not work locally without it."
fi

# Copy the icon file (icons are better copied than symlinked into system dirs)
USER_ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
if [ -f "$SCRIPT_SOURCE_DIR/$SOURCE_ICON_FILE" ]; then
    mkdir -p "$USER_ICON_DIR"
    cp "$SCRIPT_SOURCE_DIR/$SOURCE_ICON_FILE" "$USER_ICON_DIR/$ICON_NAME.png"
    echo "Copied $SOURCE_ICON_FILE to $USER_ICON_DIR/$ICON_NAME.png"
else
    echo "Warning: Icon file $SOURCE_ICON_FILE not found in $SCRIPT_SOURCE_DIR. Generic icon will be used."
fi

# Symlink the icon file to INSTALL_DIR to be used as favicon by index.html (if served locally)
if [ -f "$SCRIPT_SOURCE_DIR/$SOURCE_ICON_FILE" ]; then
    ln -sf "$SCRIPT_SOURCE_DIR/$SOURCE_ICON_FILE" "$INSTALL_DIR/$SOURCE_ICON_FILE"
    echo "Symlinked $SOURCE_ICON_FILE to $INSTALL_DIR/ for use as favicon."
else
    echo "Warning: Icon file $SOURCE_ICON_FILE not found in $SCRIPT_SOURCE_DIR. Favicon might not be available for local server."
fi

echo "Ensure source directory '$SCRIPT_SOURCE_DIR' remains accessible for symlinks to work."
echo "Any default model.drc should also be placed (or symlinked) by the user into $INSTALL_DIR."

# Create the launcher script
LAUNCHER_SCRIPT_PATH="$INSTALL_DIR/drc-viewer-launcher.sh"
echo "Creating launcher script at $LAUNCHER_SCRIPT_PATH..."
cat << EOF > "$LAUNCHER_SCRIPT_PATH"
#!/bin/bash

# This script is called by the .desktop file.
# It opens the browser to the configured server URL and passes the file URI as a parameter.

VIEWER_INSTALL_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)" # This is $INSTALL_DIR
TARGET_MODEL_NAME="_active_model.drc" # Name of the symlink in the web server root
TARGET_MODEL_PATH="\$VIEWER_INSTALL_DIR/\$TARGET_MODEL_NAME"
SERVER_URL="http://0.0.0.0:8090" # User should configure this if their server is elsewhere or on a different port.
SERVER_PORT="8090"

# The .desktop file passes the file path(s) as arguments. We'll take the first one.
INPUT_FILE_URI="\$1"

# Check if server is running, start if not (for local setup)
if ! ss -tulnp | grep -q ":\$SERVER_PORT" && [ -f "\$VIEWER_INSTALL_DIR/start.sh" ]; then
    echo "DRC Viewer: Server on port \$SERVER_PORT not detected. Starting it..."
    # Start server in background, ensuring it runs from the correct directory
    (cd "\$VIEWER_INSTALL_DIR" && ./start.sh &)
    # Give server a moment to start. Adjust if needed.
    sleep 2
    # Check again
    if ! ss -tulnp | grep -q ":\$SERVER_PORT"; then
        echo "DRC Viewer: Failed to start server or server is not listening on port \$SERVER_PORT."
        # Optionally, notify user with zenity or notify-send if installed
        # zenity --error --text="DRC Viewer: Failed to start local server on port \$SERVER_PORT." &
    fi
fi

if [ -z "\$INPUT_FILE_URI" ]; then
    echo "No file specified. Opening viewer base URL (will try to load default model.drc if present)."
    xdg-open "\$SERVER_URL/" &> /dev/null
    exit 0
fi

# Convert file URI (e.g., file:///path/to/file) to an absolute path
MODEL_FILE_PATH=""
if [[ "\$INPUT_FILE_URI" == file://* ]]; then
    MODEL_FILE_PATH=\$(echo "\$INPUT_FILE_URI" | sed 's|^file://||')
    MODEL_FILE_PATH=\$(printf '%b' "\${MODEL_FILE_PATH//%/\\\\x}") # URL decode path
else
    MODEL_FILE_PATH="\$INPUT_FILE_URI"
fi

if [ ! -f "\$MODEL_FILE_PATH" ]; then
    echo "Error: File not found at '\$MODEL_FILE_PATH' (derived from '\$INPUT_FILE_URI')"
    xdg-open "\$SERVER_URL/" &> /dev/null # Open base URL as fallback
    exit 1
fi

# Symlink the selected .drc file to the web server directory ($VIEWER_INSTALL_DIR)
ln -sf "\$MODEL_FILE_PATH" "\$TARGET_MODEL_PATH"
if [ \$? -ne 0 ]; then
    echo "Error: Could not symlink '\$MODEL_FILE_PATH' to '\$TARGET_MODEL_PATH'"
    exit 1
fi

# Open the browser to index.html with the specific model passed as a URL parameter.
# The model name for the URL parameter should be URL encoded if it contains special characters.
# Since we are using a fixed name "_active_model.drc", direct use is fine.
xdg-open "\$SERVER_URL/?model=\$TARGET_MODEL_NAME" &> /dev/null

# Note: This script assumes the web server (e.g. from start.sh in \$VIEWER_INSTALL_DIR)
# is already running and serving files from \$VIEWER_INSTALL_DIR.
# index.html must be present (or symlinked) in \$VIEWER_INSTALL_DIR.

exit 0
EOF
chmod +x "$LAUNCHER_SCRIPT_PATH"
echo "Launcher script created and made executable."

# Create .desktop file
DESKTOP_FILE_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_FILE_DIR"
echo "Creating .desktop file at $DESKTOP_FILE_DIR/$DESKTOP_FILE_NAME..."
cat << EOF > "$DESKTOP_FILE_DIR/$DESKTOP_FILE_NAME"
[Desktop Entry]
Version=1.0
Name=DRC Viewer
Comment=View .drc 3D models with a simple web viewer
Exec=$LAUNCHER_SCRIPT_PATH %U
Icon=$ICON_NAME # Use the custom icon name
Terminal=false
Type=Application
MimeType=$MIME_TYPE;
Categories=Graphics;Viewer;3DGraphics;
Keywords=3D;model;viewer;draco;drc;
StartupNotify=false # Attempt to hide temporary icon
EOF
echo ".desktop file created."

# Create custom MIME type XML
MIME_PACKAGES_DIR="$HOME/.local/share/mime/packages"
mkdir -p "$MIME_PACKAGES_DIR"
echo "Creating MIME type definition at $MIME_PACKAGES_DIR/$MIME_XML_FILE..."
cat << EOF > "$MIME_PACKAGES_DIR/$MIME_XML_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="$MIME_TYPE">
    <comment>Draco 3D Model File</comment>
    <icon name="$ICON_NAME"/> <!-- Use the custom icon name -->
    <glob pattern="*.drc"/>
    <glob pattern="*.DRC"/>
  </mime-type>
</mime-info>
EOF
echo "MIME type definition created."

# Update MIME database
echo "Updating MIME database for the user..."
update-mime-database "$HOME/.local/share/mime"
if [ $? -ne 0 ]; then
    echo "Warning: Failed to update user MIME database. You might need to log out and log back in, or run 'update-mime-database ~/.local/share/mime' manually."
else
    echo "User MIME database updated."
fi

# Update icon cache
if command -v gtk-update-icon-cache &> /dev/null; then
    echo "Updating icon cache for hicolor theme..."
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor"
else
    echo "Warning: gtk-update-icon-cache not found. Icon changes might require a logout/login to take effect."
fi

# Set the new application as the default for the MIME type
echo "Setting $APP_NAME as default for $MIME_TYPE files..."
xdg-mime default "$DESKTOP_FILE_NAME" "$MIME_TYPE"
if [ $? -ne 0 ]; then
    echo "Warning: Failed to set default application using xdg-mime. You may need to set it manually via your file manager's 'Open With' dialog."
else
    echo "$APP_NAME set as default for $MIME_TYPE."
fi

echo ""
echo "Installation complete!"
echo "--------------------"
echo "To use the viewer (local setup):"
echo "1. Ensure '$SOURCE_INDEX_FILE' and '$SOURCE_START_SCRIPT' are in your source directory ('$SCRIPT_SOURCE_DIR')."
echo "   They have been symlinked to \"$INSTALL_DIR/\"."
echo "   If you want a default model, place/symlink 'model.drc' into \"$INSTALL_DIR/\"."
echo "2. The launcher script will attempt to start the server if it's not running."
echo "   You should be able to double-click .drc files in your file manager to open them directly."
echo ""
echo "For remote server setup, ensure index.html is on your remote server. The desktop integration will open the URL"
echo "but will require drag-and-drop as direct local file access by a remote page is not possible."
echo "You would need to adjust SERVER_URL in $LAUNCHER_SCRIPT_PATH for a remote server."
echo ""
echo "To uninstall (manual steps):"
echo "  - Remove directory: rm -rf \"$INSTALL_DIR\""
echo "  - Remove .desktop file: rm \"$DESKTOP_FILE_DIR/$DESKTOP_FILE_NAME\""
echo "  - Remove icon file: rm \"$USER_ICON_DIR/$ICON_NAME.png\" (if installed)"
echo "  - Remove MIME XML: rm \"$MIME_PACKAGES_DIR/$MIME_XML_FILE\""
echo "  - Update MIME database: update-mime-database \"\$HOME/.local/share/mime\""
echo "  - Update icon cache: gtk-update-icon-cache -f -t \"\$HOME/.local/share/icons/hicolor\" (if applicable)"
echo "  - (Optional) Unset default: Check xdg-mime documentation or your desktop environment settings."
echo ""

exit 0
