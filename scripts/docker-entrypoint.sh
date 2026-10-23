#!/bin/sh
# Applies BASE_PATH to the prebuilt files, then starts the server.
set -e
/app/scripts/set-base-path.sh "${BASE_PATH:-}" /app
exec "$@"
