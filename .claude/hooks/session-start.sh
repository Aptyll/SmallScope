#!/bin/sh
# Cloud sessions start from a fresh clone, so the pre-push guard is off until
# something turns it on. This turns it on before the agent's first command.
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
sh scripts/setup-hooks.sh || exit 0
echo "Pre-push guard is on: a push to main, or of a branch behind origin/main, is refused. Run /sync, then push."
