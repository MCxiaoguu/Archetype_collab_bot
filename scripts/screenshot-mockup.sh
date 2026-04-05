#!/bin/bash
# Usage: screenshot-mockup.sh <html_content_file> <output_png>
# Wraps an HTML content fragment in the brainstorm frame template and screenshots it.
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

INPUT_HTML="$1"
OUTPUT_PNG="$2"
FRAME="/home/archetype/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/skills/brainstorming/scripts/frame-template.html"
TMPHTML="/tmp/design-previews/wrapped-$(basename "$INPUT_HTML")"

mkdir -p /tmp/design-previews

# Read frame and content
CONTENT=$(cat "$INPUT_HTML")

# Build standalone HTML: insert content into frame template
python3 -c "
import sys
frame = open('$FRAME').read()
content = open('$INPUT_HTML').read()
print(frame.replace('<!-- CONTENT -->', content))
" > "$TMPHTML"

# Screenshot the standalone file
node /home/archetype/archetype-project/scripts/screenshot.js "$TMPHTML" "$OUTPUT_PNG"
