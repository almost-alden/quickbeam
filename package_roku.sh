#!/bin/bash
# Quickbeam Roku App Packager
# Zips all SceneGraph source, layout components, images, and manifest.

TARGET=${1:-prod}
ZIP_NAME="quickbeam-${TARGET}.zip"

echo "⚡️ Packaging Quickbeam Roku App for TARGET: ${TARGET}..."

# Create output directory
mkdir -p out

# Ensure we clean up any old build
rm -f out/$ZIP_NAME
rm -f out/quickbeam.zip

# Verify directories exist
if [ ! -f manifest ]; then
    echo "❌ Error: manifest file not found in current directory!"
    exit 1
fi

if [ ! -d source ] || [ ! -d components ] || [ ! -d images ]; then
    echo "❌ Error: source, components, or images directories are missing!"
    exit 1
fi

# Backup config files before temporary injection
cp source/main.brs main.brs.bak
cp manifest manifest.bak

# Adjust endpoint and channel title based on target
if [ "$TARGET" = "beta" ]; then
    sed -i 's|globalAA.relayUrl = ".*"|globalAA.relayUrl = "https://beta.quickbeam.johnnylehane.com"|g' source/main.brs
    sed -i 's|title=.*|title=Quickbeam Beta|g' manifest
else
    sed -i 's|globalAA.relayUrl = ".*"|globalAA.relayUrl = "https://quickbeam.johnnylehane.com"|g' source/main.brs
    sed -i 's|title=.*|title=Quickbeam|g' manifest
fi

# Package channel
zip -r out/$ZIP_NAME manifest source/ components/ images/
ZIP_STATUS=$?

# Restore backups
mv main.brs.bak source/main.brs
mv manifest.bak manifest

if [ $ZIP_STATUS -eq 0 ]; then
    cp out/$ZIP_NAME out/quickbeam.zip
    echo "✅ Packaging successful: out/$ZIP_NAME is ready for Roku Developer deployment!"
else
    echo "❌ Packaging failed!"
    exit 1
fi
