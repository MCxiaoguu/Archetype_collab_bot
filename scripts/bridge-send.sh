#!/bin/bash
# Send a message to openclaw via the file bridge
# Usage: bridge-send.sh "<message>" [tag]
# Tags: build-log, design-update, test-report, general
set -euo pipefail

MESSAGE="$1"
TAG="${2:-general}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FILENAME="msg-$(date +%s)-$$.json"

# Write message as JSON
cat > /tmp/bridge-$FILENAME << EOF
{
  "timestamp": "$TIMESTAMP",
  "from": "archetype-dev-bot",
  "tag": "$TAG",
  "message": $(python3 -c "import json; print(json.dumps('''$MESSAGE'''))")
}
EOF

# Send to openclaw
scp -q /tmp/bridge-$FILENAME openclaw:~/.openclaw/bridge-inbox/$FILENAME
rm -f /tmp/bridge-$FILENAME

echo "Sent to openclaw: $TAG"
