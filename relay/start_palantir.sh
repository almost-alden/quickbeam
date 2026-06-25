#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "⚡️ Starting The Palantír (Quickbeam Relay Server) on Gateway..."

# 1. Check for Node.js and NPM
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "❌ Error: Node.js or NPM is not installed on this machine (gateway)."
    echo ""
    echo "To install Node.js and NPM on Debian/Ubuntu, please run:"
    echo "  sudo apt update"
    echo "  sudo apt install -y nodejs npm"
    echo ""
    exit 1
fi

# 2. Navigate to the relay directory
cd "$(dirname "$0")"

# 3. Install dependencies
echo "📦 Verifying dependencies..."
npm install

# 4. Start the server
echo "🚀 Exposing Palantír on port 18000..."
PORT=18000 node server.js
