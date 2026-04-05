#!/bin/bash
# Delete design preview images older than TTL (default 1 hour)
TTL_MINUTES="${1:-60}"
PREVIEW_DIR="/tmp/design-previews"

if [ -d "$PREVIEW_DIR" ]; then
  find "$PREVIEW_DIR" -type f -name "*.png" -mmin +"$TTL_MINUTES" -delete 2>/dev/null
  # Remove empty dir if nothing left
  rmdir "$PREVIEW_DIR" 2>/dev/null || true
fi
