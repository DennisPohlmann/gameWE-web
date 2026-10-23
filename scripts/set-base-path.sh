#!/bin/sh
# Sets the sub path of a prebuilt gameWE web (Docker image or release
# tarball), e.g. /new behind a reverse proxy, or "" for the root.
#
#   scripts/set-base-path.sh /new [dir]
#
# Prebuilt files carry the placeholder /__gamewe_base__ in place of the sub
# path. It is replaced once; to change the path later, start again from a
# fresh copy (Docker: recreate the container).
set -eu

PLACEHOLDER=/__gamewe_base__
# Quotes from an env file (docker --env-file keeps them) and a trailing
# slash are dropped.
want=$(printf '%s' "${1:-}" | sed -e 's/^["'"'"']//' -e 's/["'"'"']$//' -e 's:/*$::')
dir=${2:-$(dirname "$0")/..}
mark="$dir/.next/BASE_PATH"

case "$want" in
  "") ;;
  /*) printf '%s' "$want" | grep -Eq '^(/[A-Za-z0-9._~-]+)+$' || { echo "BASE_PATH must look like /new, not \"$want\"" >&2; exit 1; } ;;
  *) echo "BASE_PATH must start with /, e.g. /new" >&2; exit 1 ;;
esac

if grep -rqlF "$PLACEHOLDER" "$dir/server.js" "$dir/.next" 2>/dev/null; then
  grep -rlF "$PLACEHOLDER" "$dir/server.js" "$dir/.next" | while IFS= read -r f; do
    sed -i "s:$PLACEHOLDER:$want:g" "$f"
  done
  printf '%s' "$want" > "$mark"
  echo "gameWE web: sub path set to \"${want:-/}\""
elif [ -f "$mark" ] && [ "$(cat "$mark")" != "$want" ]; then
  echo "This copy already runs under \"$(cat "$mark")\". To use \"$want\", start from a fresh copy (Docker: recreate the container)." >&2
  exit 1
fi
