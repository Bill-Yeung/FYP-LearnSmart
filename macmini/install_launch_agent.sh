#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="${GATEWAY_VENV:-/Users/ituser/gateway-venv}"
LABEL="${GATEWAY_LAUNCH_LABEL:-com.youstube.gateway}"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG_PATH="${GATEWAY_LOG:-/Users/ituser/gateway.log}"
UID_NUM="$(id -u)"

mkdir -p "$HOME/Library/LaunchAgents"
touch "$LOG_PATH"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>

  <key>ProgramArguments</key>
  <array>
    <string>$VENV/bin/python3</string>
    <string>$REPO_ROOT/macmini/app.py</string>
    <string>--env-file</string>
    <string>$REPO_ROOT/macmini/.env.prod</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$REPO_ROOT/macmini</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>PYTHONUNBUFFERED</key>
    <string>1</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>

  <key>ThrottleInterval</key>
  <integer>10</integer>

  <key>StandardOutPath</key>
  <string>$LOG_PATH</string>

  <key>StandardErrorPath</key>
  <string>$LOG_PATH</string>
</dict>
</plist>
PLIST

plutil -lint "$PLIST"

launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
launchctl bootout "gui/$UID_NUM" "$PLIST" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST"
launchctl kickstart -k "gui/$UID_NUM/$LABEL"

echo "Installed launchd service: $LABEL"
echo "Plist: $PLIST"
launchctl print "gui/$UID_NUM/$LABEL" | sed -n '1,80p' || true
