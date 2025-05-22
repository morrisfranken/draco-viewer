#!/bin/bash

# 'Installing' this as a web-application on ubuntu

# Installation directory for the viewer files
INSTALL_DIR="$HOME/.local/share/drc-viewer"
APP_NAME="drc-viewer"
DESKTOP_FILE_NAME="$APP_NAME.desktop"
MIME_TYPE="application/x-drc"
MIME_XML_FILE="application-x-drc.xml"

echo "DRC Viewer Installer"
echo "--------------------"
echo "This script will install the DRC Viewer for the current user."
echo "It will create files in:"
echo "  Application files: $INSTALL_DIR"
echo "  Desktop entry: $HOME/.local/share/applications/"
echo "  MIME type: $HOME/.local/share/mime/"
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
echo "Created directory $INSTALL_DIR (will only store launcher script)."

# Copy application files (index.html, start.sh, and any default model.drc if present)
# echo "Copying application files..."
# SCRIPT_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# # Ensure start.sh is copied if it exists in the source, as it's mentioned in instructions.
# # However, its role is diminished if the server is truly remote/managed elsewhere.
# # For now, we'll keep copying it as a utility script for local testing.
# if [ -f "$SCRIPT_SOURCE_DIR/start.sh" ]; then
#     cp "$SCRIPT_SOURCE_DIR/start.sh" "$INSTALL_DIR/"
#     chmod +x "$INSTALL_DIR/start.sh"
#     echo "Copied start.sh to $INSTALL_DIR. User is responsible for index.html and models."
# else
#     echo "start.sh not found in source directory. Skipping copy."
# fi

# index.html and model.drc are no longer copied by this script.
# User is responsible for deploying index.html to their web server.
# Default model.drc (if any) should also be placed in the web server's root by the user.
# echo "Note: index.html and any default model.drc are NOT copied by this script."
echo "User must ensure index.html is served by their web server (e.g., at $SERVER_URL)."

# Create the launcher script
LAUNCHER_SCRIPT_PATH="$INSTALL_DIR/drc-viewer-launcher.sh"
echo "Creating launcher script at $LAUNCHER_SCRIPT_PATH..."
cat << EOF > "$LAUNCHER_SCRIPT_PATH"
#!/bin/bash

# This script is called by the .desktop file.
# It opens the browser to the configured server URL and passes the file URI as a parameter.

VIEWER_INSTALL_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)" # Not strictly needed anymore but kept for context
SERVER_URL="http://0.0.0.0:8090" # User should configure this if their server is elsewhere or on a different port.

# The .desktop file passes the file path(s) as arguments. We'll take the first one.
INPUT_FILE_URI="\$1"

if [ -z "\$INPUT_FILE_URI" ]; then
    echo "No file specified. Opening viewer base URL."
    xdg-open "\$SERVER_URL/" &> /dev/null
    exit 0
fi

# Ensure the input is a URI (it should be from %U in .desktop)
# For robustness, one might add checks or conversions if plain paths are possible.

# URL-encode the file URI to safely pass it as a query parameter value
# Using python for robust URL encoding if available
ENCODED_FILE_URI=""
if command -v python3 &> /dev/null; then
    ENCODED_FILE_URI=\$(python3 -c "import urllib.parse; print(urllib.parse.quote_plus('\$INPUT_FILE_URI'))")
elif command -v python &> /dev/null; then
    ENCODED_FILE_URI=\$(python -c "import urllib; print(urllib.quote_plus('\$INPUT_FILE_URI'))")
else
    # Basic fallback (less robust, might miss some characters)
    # This is a very simplified encoding, real scenarios need full percent-encoding.
    ENCODED_FILE_URI="\$(echo "\$INPUT_FILE_URI" | sed 's|%|%25|g; s| |%20|g; s|#|%23|g; s|&|%26|g; s|+|%2B|g; s|?|%3F|g; s|=|%3D|g')"
    echo "Warning: python not found for robust URL encoding. Using basic sed."
fi

# Open the browser to the index.html (served by SERVER_URL)
# and pass the original file URI as a parameter.
# index.html, when served over HTTP, cannot directly load a file:/// URI due to security.
# It can, however, display this information to the user.
xdg-open "\$SERVER_URL/?requestedFileURI=\$ENCODED_FILE_URI" &> /dev/null

# Note: This script assumes the web server (e.g. from start.sh, or a remote one)
# is already running and serving index.html at \$SERVER_URL.
# The index.html page will need to handle the 'requestedFileURI' parameter.

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
Icon=application-x-zerosize # Generic icon, replace if you have one
Terminal=false
Type=Application
MimeType=$MIME_TYPE;
Categories=Graphics;Viewer;3DGraphics;
Keywords=3D;model;viewer;draco;drc;
StartupNotify=true
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
    <icon name="application-x-zerosize"/> <!-- Corresponds to Icon in .desktop -->
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
echo "To use the viewer:"
echo "1. Ensure your web server is running and serving 'index.html' at the configured URL (default: http://0.0.0.0:8090)."
echo "   You may need to copy 'index.html' from the source to your server's root directory."
echo "   If using the local 'start.sh' for testing, run it from a directory containing 'index.html':"
echo "     cd /path/to/your/index_html_location"
echo "     \"$INSTALL_DIR/start.sh\""
echo "2. After running this create.sh script, you should be able to double-click .drc files."
echo "   The browser will open, and index.html should indicate the file you selected."
echo "   You will likely need to drag-and-drop the indicated file into the browser window due to security restrictions."
echo ""
echo "To uninstall (manual steps):"
echo "  - Remove directory: rm -rf \"$INSTALL_DIR\""
echo "  - Remove .desktop file: rm \"$DESKTOP_FILE_DIR/$DESKTOP_FILE_NAME\""
echo "  - Remove MIME XML: rm \"$MIME_PACKAGES_DIR/$MIME_XML_FILE\""
echo "  - Update MIME database: update-mime-database \"\$HOME/.local/share/mime\""
echo "  - (Optional) Unset default: Check xdg-mime documentation or your desktop environment settings."
echo ""

exit 0
