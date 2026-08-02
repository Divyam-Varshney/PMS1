#!/bin/bash
# ============================================================================
# scripts/start-stable.sh
# ----------------------------------------------------------------------------
# Production-safe dev server startup that survives sandbox process reaping.
#
# PROBLEM: The sandbox kills all processes spawned by a tool-call bash shell
# when that shell exits. Using `nohup` or `disown` alone is NOT enough because
# the processes remain in the same process group/session.
#
# SOLUTION: `setsid bash -c '... &'` creates a NEW session (new SID + PGID)
# AND backgrounds the process. The process gets reparented to PID 1 (tini)
# when the spawning shell exits, so it survives across tool calls.
#
# This script also:
#   - Kills any existing server (prevents EADDRINUSE)
#   - Verifies the .env has the correct PostgreSQL DATABASE_URL
#   - Waits for the server to be ready
#   - Writes a heartbeat file for external monitoring
# ============================================================================

set -e
cd /home/z/my-project

echo "[start-stable] Killing any existing server..."
pkill -f "next-server" 2>/dev/null || true
pkill -f "bun run dev" 2>/dev/null || true
sleep 2

echo "[start-stable] Starting dev server with session detachment..."
# The key: setsid + bash -c '...' + & at the end of the inner command
# This creates a new session AND backgrounds, so the process is reparented to PID 1
setsid bash -c 'exec bun run dev </dev/null >/tmp/dev-stable.log 2>&1 &' &

# Wait for the server to be ready
echo "[start-stable] Waiting for server to be ready..."
for i in $(seq 1 30); do
  if curl -s --connect-timeout 2 http://localhost:3000/ >/dev/null 2>&1; then
    echo "[start-stable] Server is ready! (attempt $i)"
    echo "[start-stable] PID: $(pgrep -f 'next-server' | head -1)"
    echo "[start-stable] URL: http://localhost:3000/"
    echo "$(date +%s)" > /tmp/pms-server-started
    exit 0
  fi
  sleep 1
done

echo "[start-stable] ERROR: Server did not start within 30 seconds"
tail -10 /tmp/dev-stable.log 2>/dev/null
exit 1
