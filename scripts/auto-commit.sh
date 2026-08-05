#!/bin/bash
# Auto-commit daemon — commits + pushes every 5 minutes to prevent work loss.
# This is the PERMANENT solution to the preview reset issue.

cd /home/z/my-project
LOG="/tmp/auto-commit.log"
INTERVAL=300

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

commit_and_push() {
  if git diff --quiet HEAD -- 2>/dev/null && [ -z "$(git ls-files --others --exclude-standard 2>/dev/null)" ]; then
    return 0
  fi
  git add -A >> "$LOG" 2>&1
  local msg="Auto-commit: $(date '+%Y-%m-%d %H:%M:%S')"
  if git commit -m "$msg" >> "$LOG" 2>&1; then
    log "✅ Committed: $msg"
    if git push origin main >> "$LOG" 2>&1; then
      log "✅ Pushed to origin/main"
    else
      log "⚠️ Push failed (will retry)"
    fi
  fi
}

log "🚀 Auto-commit daemon started (interval: ${INTERVAL}s)"
while true; do
  commit_and_push || true
  sleep "$INTERVAL"
done
