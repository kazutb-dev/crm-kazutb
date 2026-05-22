#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -lt 1 || -z "${1:-}" ]]; then
    echo "Usage: $0 \"commit message\"" >&2
    exit 1
fi

message="$1"

# Keep behavior aligned with existing interactive safecommit helper.
BLOCKED_REGEX='(^|/)\.env$|(^|/)\.env\.|^backups/|(^|/).*\.sql$|(^|/).*\.sql\.gz$|(^|/).*\.dump$|(^|/).*\.tar\.gz$|^vendor/|^node_modules/|^skills/'
ALLOWED_REGEX='(^|/)\.env\.example$'

git add .

blocked_files="$(git diff --cached --name-only | grep -E "${BLOCKED_REGEX}" | grep -Ev "${ALLOWED_REGEX}" || true)"
if [[ -n "$blocked_files" ]]; then
    echo
    echo "WARNING: Dangerous files found in staged. Auto-unstaging:"
    while IFS= read -r f; do
        [[ -z "$f" ]] && continue
        echo "  - $f"
        git restore --staged "$f"
    done <<< "$blocked_files"
    echo
fi

echo "Staged files:"
git diff --cached --name-only || true
echo
echo "Staged stat:"
git diff --cached --stat || true

if git diff --cached --quiet; then
    echo
    echo "Nothing to commit after removing dangerous files."
    exit 1
fi

echo
git commit -m "$message"
