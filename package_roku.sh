#!/bin/bash
# Quickbeam Roku App Packager
# Zips all SceneGraph source, layout components, images, and manifest.

echo "⚡️ Packaging Quickbeam Roku App..."

# Create output directory
mkdir -p out

# Ensure we clean up any old build
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

# Package channel
zip -r out/quickbeam.zip manifest source/ components/ images/

if [ $? -eq 0 ]; then
    echo "✅ Packaging successful: out/quickbeam.zip is ready for Roku Developer deployment!"
else
    echo "❌ Packaging failed!"
    exit 1
fi
