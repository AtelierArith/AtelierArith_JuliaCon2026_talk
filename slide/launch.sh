#!/usr/bin/env bash
#
# Launch the sjulia live slides locally.
#
# Why this exists: `quarto preview` in ./slide renders the reveal.js deck, but
# the interactive Julia executors and Plotly plots stay blank on a fresh
# checkout because two runtime assets are gitignored and therefore missing:
#
#   slide/pkg/                  <- wasm-pack output (imported by sjulia-runtime.js)
#   slide/assets/plotly.min.js  <- Plotly bundle (loaded by assets/after-body.html)
#
# Without slide/pkg the ES module `import ... from './pkg/subset_julia_vm_web.js'`
# 404s, `window.sjulia` is never set, and every executor shows nothing.
#
# This script stages those assets when slide/pkg is missing (building the WASM
# package first if ./web/pkg is not present yet), then starts a server.
#
# Usage:
#   ./slide/launch.sh                 # build/stage if needed, then `quarto preview`
#   ./slide/launch.sh --static        # ... then `quarto render` + python http.server
#   ./slide/launch.sh --build         # force a WASM rebuild + restage
#   ./slide/launch.sh --port 4444     # choose the port
#   ./slide/launch.sh -- --no-browser # forward extra args to quarto preview
#
set -euo pipefail

SLIDE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SLIDE_DIR/.." && pwd)"

MODE="preview"     # preview | static
FORCE_BUILD=false
PORT=""
FORWARD=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --static)  MODE="static"; shift ;;
    --preview) MODE="preview"; shift ;;
    --build)   FORCE_BUILD=true; shift ;;
    --port)    PORT="${2:?--port needs a value}"; shift 2 ;;
    --port=*)  PORT="${1#*=}"; shift ;;
    --)        shift; FORWARD+=("$@"); break ;;
    -h|--help)
      sed -n '3,23p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *)         FORWARD+=("$1"); shift ;;
  esac
done

info() { printf '\033[1;36m[launch]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[launch]\033[0m %s\n' "$*" >&2; exit 1; }

command -v quarto >/dev/null 2>&1 || die "quarto not found on PATH (https://quarto.org/)."

# --- Stage runtime assets when slide/pkg is missing (or --build) -------------
if $FORCE_BUILD || [[ ! -f "$SLIDE_DIR/pkg/subset_julia_vm_web.js" ]]; then
  # 1. Build the WASM package if ./web/pkg is not there yet (or --build).
  if $FORCE_BUILD || [[ ! -f "$ROOT/web/pkg/subset_julia_vm_web.js" ]]; then
    command -v wasm-pack >/dev/null 2>&1 || die "wasm-pack not found (cargo install wasm-pack)."
    info "Building WASM package into ./web/pkg ..."
    "$ROOT/scripts/wasm_build_with_cache.sh" --out-dir "$ROOT/web/pkg"
  else
    info "Reusing existing ./web/pkg."
  fi

  # 2. Stage web/pkg -> slide/pkg.
  info "Staging web/pkg -> slide/pkg"
  rm -rf "$SLIDE_DIR/pkg"
  mkdir -p "$SLIDE_DIR/pkg"
  cp -R "$ROOT/web/pkg/." "$SLIDE_DIR/pkg/"

  # 3. Stage the Plotly bundle -> slide/assets/plotly.min.js.
  [[ -f "$ROOT/web/plotly.min.js" ]] || die "web/plotly.min.js not found; build the web playground first."
  info "Staging web/plotly.min.js -> slide/assets/plotly.min.js"
  cp "$ROOT/web/plotly.min.js" "$SLIDE_DIR/assets/plotly.min.js"
else
  info "slide/pkg already present (pass --build to rebuild)."
  # Make sure the Plotly bundle is there too (it is gitignored as well).
  if [[ ! -f "$SLIDE_DIR/assets/plotly.min.js" && -f "$ROOT/web/plotly.min.js" ]]; then
    info "Staging web/plotly.min.js -> slide/assets/plotly.min.js"
    cp "$ROOT/web/plotly.min.js" "$SLIDE_DIR/assets/plotly.min.js"
  fi
fi

# --- Serve -------------------------------------------------------------------
cd "$SLIDE_DIR"
if [[ "$MODE" == "static" ]]; then
  info "Rendering with quarto ..."
  quarto render
  local_port="${PORT:-8080}"
  info "Serving _site at http://localhost:${local_port}  (Ctrl+C to stop)"
  cd "$SLIDE_DIR/_site"
  exec python3 -m http.server "$local_port"
else
  # `--render all` forces a full render so freshly-staged assets are copied into
  # _site. The wasm-bindgen loader falls back to WebAssembly.instantiate() when
  # the dev server serves .wasm without the application/wasm MIME type, so the
  # runtime still loads under `quarto preview`.
  args=(--render all)
  [[ -n "$PORT" ]] && args+=(--port "$PORT")
  info "Starting quarto preview ${PORT:+on port $PORT} (Ctrl+C to stop)"
  exec quarto preview "${args[@]}" "${FORWARD[@]}"
fi
