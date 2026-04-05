#!/bin/bash
# Usage: screenshot.sh <html_file_or_url> [output_path]
set -euo pipefail
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
node "$SCRIPT_DIR/screenshot.js" "$@"
