#!/bin/bash

# Installs Draco Viewer as an Electron application

INSTALL_DIR="$HOME/.local/share/draco-viewer" # For launcher script & app resources if packaged
APP_NAME="draco-viewer"
DESKTOP_FILE_NAME="$APP_NAME.desktop"
# MIME_TYPE="application/x-drc" # This variable is not strictly needed as it's used in an array later
MIME_XML_FILE="application-x-drc.xml" # For application/x-drc
GLB_MIME_XML_FILE="model-gltf-binary.xml" # For model/gltf-binary
ICON_NAME="draco-viewer"
SOURCE_ICON_FILE="drc-icon.svg" # The actual source icon file in the project

SCRIPT_SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Adjust ELECTRON_APP_SOURCE_DIR to point to the parent directory of SCRIPT_SOURCE_DIR
ELECTRON_APP_SOURCE_DIR="$(cd "$SCRIPT_SOURCE_DIR/.." && pwd)"

MIME_TYPES_TO_REGISTER=("application/x-drc" "model/gltf-binary")
DESKTOP_FILE_MIME_TYPE_STRING="application/x-drc;model/gltf-binary;"
# ICON_NAME and SOURCE_ICON_FILE already defined above, removing duplicates
# SCRIPT_SOURCE_DIR and ELECTRON_APP_SOURCE_DIR already defined above, removing duplicates

echo "Draco Viewer Installer"
echo "-------------------------------"

# Prerequisite: Check for npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm."
    echo "You can usually install them from your distribution's package manager (e.g., sudo apt install nodejs npm) or from https://nodejs.org/"
    echo "Installation aborted."
    exit 1
fi
echo "npm found."

# Prerequisite: Check if npm install has been run (presence of node_modules)
if [ ! -d "$ELECTRON_APP_SOURCE_DIR/node_modules" ]; then
    echo ""
    echo "Warning: The 'node_modules' directory was not found in '$ELECTRON_APP_SOURCE_DIR'."
    echo "This suggests that 'npm install' has not been run for the project."
    read -p "Do you want to run 'npm install' in '$ELECTRON_APP_SOURCE_DIR' now? (y/N) " choice_npm
    case "$choice_npm" in
      y|Y )
        echo "Running 'npm install' in '$ELECTRON_APP_SOURCE_DIR'..."
        (cd "$ELECTRON_APP_SOURCE_DIR" && npm install)
        if [ $? -ne 0 ]; then
            echo "Error: 'npm install' failed. Please check for errors, run it manually in '$ELECTRON_APP_SOURCE_DIR', and then re-run this installer."
            echo "Installation aborted."
            exit 1
        fi
        echo "'npm install' completed successfully."
        ;;
      * )
        echo "Please run 'npm install' in '$ELECTRON_APP_SOURCE_DIR' and then re-run this installer."
        echo "Installation aborted."
        exit 1
        ;;
    esac
else
    echo "'node_modules' directory found in '$ELECTRON_APP_SOURCE_DIR'."
fi

echo ""
echo "This script will install the Draco Viewer Electron app for the current user."
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
    cp "$ELECTRON_APP_SOURCE_DIR/$SOURCE_ICON_FILE" "$USER_ICON_DIR/$ICON_NAME.svg" # Changed to .svg
    echo "Copied $SOURCE_ICON_FILE to $USER_ICON_DIR/$ICON_NAME.svg"
else
    echo "Warning: Icon file $SOURCE_ICON_FILE not found in $ELECTRON_APP_SOURCE_DIR. No icon will be installed."
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
Name=Draco Viewer
Comment=View .drc and .glb 3D models with Electron
Exec=$LAUNCHER_SCRIPT_PATH %F
Icon=$ICON_NAME
Terminal=false
Type=Application
MimeType=$DESKTOP_FILE_MIME_TYPE_STRING
Categories=Graphics;Viewer;3DGraphics;
Keywords=3D;model;viewer;draco;drc;glb;gltf;electron;
StartupNotify=false
EOF
echo ".desktop file created."

# Create custom MIME type XML for .drc
MIME_PACKAGES_DIR="$HOME/.local/share/mime/packages"
mkdir -p "$MIME_PACKAGES_DIR"
echo "Creating MIME type definition for .drc at $MIME_PACKAGES_DIR/$MIME_XML_FILE..."
cat << EOF > "$MIME_PACKAGES_DIR/$MIME_XML_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="application/x-drc">
    <comment>Draco 3D Model</comment>
    <glob pattern="*.drc"/>
    <icon name="$ICON_NAME"/>
  </mime-type>
</mime-info>
EOF
echo "MIME type definition for .drc created."

# Create custom MIME type XML for .glb (model/gltf-binary)
# Note: model/gltf-binary is a standard MIME type, but we ensure it's associated with our app and icon.
GLB_MIME_XML_FILE="model-gltf-binary.xml" # Variable already defined above
echo "Creating/Updating MIME type definition for .glb at $MIME_PACKAGES_DIR/$GLB_MIME_XML_FILE..."
cat << EOF > "$MIME_PACKAGES_DIR/$GLB_MIME_XML_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<mime-info xmlns="http://www.freedesktop.org/standards/shared-mime-info">
  <mime-type type="model/gltf-binary">
    <comment>GLB 3D Model</comment>
    <glob pattern="*.glb"/>
    <icon name="$ICON_NAME"/>
  </mime-type>
</mime-info>
EOF
echo "MIME type definition for .glb created/updated."


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

# Set the new application as the default for the MIME types
for MIME_TYPE in "${MIME_TYPES_TO_REGISTER[@]}"; do
    echo "Setting $APP_NAME as default for $MIME_TYPE files..."
    xdg-mime default "$DESKTOP_FILE_NAME" "$MIME_TYPE"
    if [ $? -ne 0 ]; then
        echo "Warning: Failed to set default application for $MIME_TYPE using xdg-mime."
    else
        echo "$APP_NAME set as default for $MIME_TYPE."
    fi
done

echo ""
echo "Electron Installation complete!"
echo "--------------------"
echo "To use the viewer:"
echo "1. Ensure Node.js, npm/yarn are installed."
echo "2. Navigate to '$ELECTRON_APP_SOURCE_DIR' and run 'npm install' if you haven't already."
echo "3. You should now be able to double-click .drc or .glb files to open them."
echo "   Or run from terminal: cd '$ELECTRON_APP_SOURCE_DIR' && npm start -- /path/to/your/model.drc"
echo ""
echo "IMPORTANT FOR FILE ICONS:"
echo "If the custom icon for .drc or .glb files does not appear immediately in your file manager,"
echo "please log out and log back in, or restart your computer."
echo "This is often necessary for the desktop environment to fully recognize new icon associations."
echo ""
echo "To uninstall (manual steps):"
echo "  - Remove launcher script: rm -f \"$LAUNCHER_SCRIPT_PATH\""
echo "  - Remove launcher script directory (if empty): rmdir --ignore-fail-on-non-empty \"$INSTALL_DIR\""
echo "  - Remove .desktop file: rm -f \"$DESKTOP_FILE_DIR/$DESKTOP_FILE_NAME\""
echo "  - Remove icon file: rm -f \"$USER_ICON_DIR/$ICON_NAME.svg\"" # Changed from .png to .svg
echo "  - Remove .drc MIME XML: rm -f \"$MIME_PACKAGES_DIR/$MIME_XML_FILE\""
echo "  - Remove .glb MIME XML: rm -f \"$MIME_PACKAGES_DIR/$GLB_MIME_XML_FILE\"" # Added GLB XML removal
echo "  - Update MIME database: update-mime-database \"\$HOME/.local/share/mime\""
echo "  - Update icon cache: gtk-update-icon-cache -f -t \"\$HOME/.local/share/icons/hicolor\""
echo "  - (Optional) Remove Electron project directory: rm -rf \"$ELECTRON_APP_SOURCE_DIR\" (be careful!)"
echo ""

exit 0
