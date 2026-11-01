#!/usr/bin/env bash
# The checks of the CI job "check" (.github/workflows/build.yml), run
# locally, e.g. from the pre-push hook (tools/install-hooks.sh): type check,
# tests, build and the Helm chart (lint, template, package). Not here: the
# image build and its Trivy scan (make image, see docs/DEVELOPMENT.md).
# Needs node_modules (npm ci) and helm.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

step() { printf '\n== %s\n' "$*"; }

if [ ! -d node_modules ]; then
  echo "check-all: node_modules missing, run npm ci first" >&2
  exit 1
fi
step "type check"; npm run --silent lint
step "tests";      npm test
step "build";      npm run --silent build
step "helm chart"
if ! command -v helm >/dev/null; then
  echo "check-all: helm not found (CI uses v3.22.1, .github/actions/setup-helm)" >&2
  exit 1
fi
helm lint charts/gamewe-web --strict
helm template gamewe charts/gamewe-web --set secretEnv.ADMIN_SECRET=x --set ingress.enabled=true --set persistence.enabled=true > /dev/null
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
helm package charts/gamewe-web --destination "$tmp" > /dev/null
printf '\ncheck-all: ok\n'
