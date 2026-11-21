#!/usr/bin/env bash
# Runs a prompt with OpenCode, rotating free models until the verify command passes.
#
# Usage: bash scripts/opencode-task.sh <prompt-file> [verify-command]
#   prompt-file     Markdown file with the full task prompt.
#   verify-command  Shell command that must exit 0 for the attempt to count as done
#                   (e.g. "cd backend && ./mvnw -B -q verify"). Optional.
#
# Models are read from .claude/opencode-models.txt (one "provider/model" per line, # comments).
# Output: "OK <model>" (exit 0) or "ALL_MODELS_FAILED" (exit 2). Logs in .agent-logs/.
set -uo pipefail

PROMPT_FILE="${1:?prompt file required}"
VERIFY_CMD="${2:-}"
MODELS_FILE=".claude/opencode-models.txt"
LOG_DIR=".agent-logs"
mkdir -p "$LOG_DIR"

if ! command -v opencode >/dev/null 2>&1; then
  echo "OPENCODE_NOT_INSTALLED"; echo "ALL_MODELS_FAILED"; exit 2
fi

mapfile -t MODELS < <(grep -vE '^[[:space:]]*(#|$)' "$MODELS_FILE" 2>/dev/null | tr -d '\r')
if [ "${#MODELS[@]}" -eq 0 ]; then
  echo "NO_MODELS_CONFIGURED in $MODELS_FILE"; echo "ALL_MODELS_FAILED"; exit 2
fi

PREAMBLE="Follow AGENTS.md. Do not commit or push. The working tree may contain a partial
attempt from a previous model: inspect it with git diff, then finish or fix it.
"
PROMPT="${PREAMBLE}
$(cat "$PROMPT_FILE")"

for MODEL in "${MODELS[@]}"; do
  LOG="$LOG_DIR/opencode-$(date +%Y%m%d-%H%M%S)-${MODEL//\//_}.log"
  echo ">> opencode ($MODEL) -> $LOG"
  if opencode run --auto --model "$MODEL" "$PROMPT" >"$LOG" 2>&1; then
    if [ -z "$VERIFY_CMD" ]; then echo "OK $MODEL"; exit 0; fi
    echo ">> verify: $VERIFY_CMD" | tee -a "$LOG"
    if bash -c "$VERIFY_CMD" >>"$LOG" 2>&1; then
      echo "OK $MODEL"; exit 0
    fi
    echo "VERIFY_FAILED with $MODEL"
  else
    echo "OPENCODE_FAILED with $MODEL (quota, rate limit or crash)"
  fi
  echo "---- last lines of $LOG ----"; tail -n 30 "$LOG"
done

echo "ALL_MODELS_FAILED"
exit 2
