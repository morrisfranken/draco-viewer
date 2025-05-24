#!/bin/bash

# Installs DRC Viewer as an Electron application

INSTALL_DIR="$HOME/.local/share/drc-viewer" # For launcher script & app resources if packaged
APP_NAME="drc-viewer"
DESKTOP_FILE_NAME="$APP_NAME.desktop"
MIME_TYPE="application/x-drc"
MIME_XML_FILE="application-x-drc.xml"
ICON_NAME="drc-viewer"
SOURCE_ICON_FILE="drc-viewer.png"

SCRIPT_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Adjust ELECTRON_APP_SOURCE_DIR to point to the parent directory of SCRIPT_SOURCE_DIR
ELECTRON_APP_SOURCE_DIR="$(cd "$SCRIPT_SOURCE_DIR/.." && pwd)"

echo "DRC Viewer (Electron) Installer"
echo "-------------------------------"
echo "This script will install the DRC Viewer Electron app for the current user."
echo "It assumes Node.js and npm/yarn are installed, and you have run 'npm install' in:"
echo "  $ELECTRON_APP_SOURCE_DIR"
echo ""
echo "It will create files in:"
echo "  Desktop entry: $HOME/.local/share/applications/"
echo "  MIME type: $HOME/.local/share/mime/"
echo "  Icon file: $HOME/.local/share/icons/hicolor/scalable/apps/"
echo "  Launcher script dir: $INSTALL_DIR"
echo ""
read -p "Do you want to continue? (y/N) " choice
case "$choice" in
  y|Y ) echo "Proceeding with installation...";;
  * ) echo "Installation aborted."; exit 0;;
esac

# Create directory for the launcher script (if different from app source)
mkdir -p "$INSTALL_DIR"
if [ $? -ne 0 ]; then
    echo "Error: Could not create directory $INSTALL_DIR"
    exit 1
fi

# Copy the icon file for the .desktop entry and MIME type
USER_ICON_DIR="$HOME/.local/share/icons/hicolor/scalable/apps"
if [ -f "$ELECTRON_APP_SOURCE_DIR/$SOURCE_ICON_FILE" ]; then
    mkdir -p "$USER_ICON_DIR"
    cp "$ELECTRON_APP_SOURCE_DIR/$SOURCE_ICON_FILE" "$USER_ICON_DIR/$ICON_NAME.png"
    echo "Copied $SOURCE_ICON_FILE to $USER_ICON_DIR/$ICON_NAME.png"
else
    echo "Warning: Icon file $SOURCE_ICON_FILE not found in $ELECTRON_APP_SOURCE_DIR. Generic icon will be used."
fi

# Create the launcher script for Electron app
# This script will cd to your project directory and run electron . with the file argument
# For a packaged app, this would directly execute the packaged binary.
LAUNCHER_SCRIPT_PATH="$INSTALL_DIR/${APP_NAME}-launcher.sh"
echo "Creating Electron launcher script at $LAUNCHER_SCRIPT_PATH..."
cat << EOF > "$LAUNCHER_SCRIPT_PATH"
#!/bin/bash
# Launcher for DRC Viewer Electron App

# Path to your Electron app's source directory (where package.json, main.js are)
APP_SOURCE_DIR="$ELECTRON_APP_SOURCE_DIR"

# Check if Electron is available
if ! command -v electron &> /dev/null; then
    echo "Electron command not found. Please ensure Electron is installed globally or accessible in PATH."
    # Try to find it in local node_modules as a fallback for development
    if [ -f "\$APP_SOURCE_DIR/node_modules/.bin/electron" ]; then
        ELECTRON_CMD="\$APP_SOURCE_DIR/node_modules/.bin/electron"
    else
        # zenity --error --text="Electron is not installed or not found in PATH." & # Optional GUI error
        exit 1
    fi
else
    ELECTRON_CMD="electron"
fi

FILE_ARG="\$1" # The file path passed by the .desktop file (%U or %f)

# Navigate to the app's source directory and run Electron
# The '--' ensures that \$FILE_ARG is treated as an argument to your app, not to Electron itself.
cd "\$APP_SOURCE_DIR"
\$ELECTRON_CMD . -- "\$FILE_ARG" &> /dev/null

exit 0
EOF
chmod +x "$LAUNCHER_SCRIPT_PATH"
echo "Electron launcher script created and made executable."

# Create .desktop file
DESKTOP_FILE_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_FILE_DIR"
echo "Creating .desktop file at $DESKTOP_FILE_DIR/$DESKTOP_FILE_NAME..."
cat << EOF > "$DESKTOP_FILE_DIR/$DESKTOP_FILE_NAME"
[Desktop Entry]
Version=1.0
Name=DRC Viewer (Electron)
Comment=View .drc 3D models with Electron
Exec=$LAUNCHER_SCRIPT_PATH %F
Icon=$ICON_NAME
Terminal=false
Type=Application
MimeType=$MIME_TYPE;
Categories=Graphics;Viewer;3DGraphics;
Keywords=3D;model;viewer;draco;drc;electron;
StartupNotify=false
EOF
echo ".desktop file created."

# Create custom MIME type XML (remains the same)
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
    echo "Warning: Failed to update user MIME database."
else
    echo "User MIME database updated."
fi

# Update icon cache
if command -v gtk-update-icon-cache &> /dev/null; then
    echo "Updating icon cache for hicolor theme..."
    gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor"
else
    echo "Warning: gtk-update-icon-cache not found."
fi

# Set the new application as the default for the MIME type
echo "Setting $APP_NAME as default for $MIME_TYPE files..."
xdg-mime default "$DESKTOP_FILE_NAME" "$MIME_TYPE"
if [ $? -ne 0 ]; then
    echo "Warning: Failed to set default application using xdg-mime."
else
    echo "$APP_NAME set as default for $MIME_TYPE."
fi

echo ""
echo "Electron Installation complete!"
echo "--------------------"
echo "To use the viewer:"
echo "1. Ensure Node.js, npm/yarn are installed."
echo "2. Navigate to '$ELECTRON_APP_SOURCE_DIR' and run 'npm install' if you haven't already."
echo "3. You should now be able to double-click .drc files to open them."
echo "   Or run from terminal: cd '$ELECTRON_APP_SOURCE_DIR' && npm start -- /path/to/your/model.drc"
echo ""
echo "IMPORTANT FOR FILE ICONS:"
echo "If the custom icon for .drc files does not appear immediately in your file manager,"
echo "please log out and log back in, or restart your computer."
echo "This is often necessary for the desktop environment to fully recognize new icon associations."
echo ""
echo "To uninstall (manual steps):"
echo "  - Remove launcher script: rm -f \"$LAUNCHER_SCRIPT_PATH\""
echo "  - Remove .desktop file: rm -f \"$DESKTOP_FILE_DIR/$DESKTOP_FILE_NAME\""
echo "  - Remove icon file: rm -f \"$USER_ICON_DIR/$ICON_NAME.png\""
echo "  - Remove MIME XML: rm -f \"$MIME_PACKAGES_DIR/$MIME_XML_FILE\""
echo "  - Update MIME database: update-mime-database \"\$HOME/.local/share/mime\""
echo "  - Update icon cache: gtk-update-icon-cache -f -t \"\$HOME/.local/share/icons/hicolor\""
echo "  - (Optional) Remove Electron project directory: rm -rf \"$ELECTRON_APP_SOURCE_DIR\" (be careful!)"
echo ""

exit 0
