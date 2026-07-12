# sjulia Live Slides

Quarto reveal.js slides with an embedded SubsetJuliaVM runtime. Each slide can
run ~5 lines of Julia code and visualize the result, including Plotly graphs
from `using Plots; plot(...)`.

## Prerequisites

- [Quarto](https://quarto.org/)
- `wasm-pack` (`cargo install wasm-pack`)
- Python 3 (for the local static server)

## Quick start

```bash
./slide/launch.sh          # stage assets if missing, then `quarto preview`
./slide/launch.sh --static # ... then `quarto render` + a plain static server
./slide/launch.sh --build  # force a WASM rebuild and restage
```

`launch.sh` exists because `slide/pkg/` and `slide/assets/plotly.min.js` are
gitignored, so a fresh checkout has no WASM runtime or Plotly bundle — the deck
renders but every executor stays blank. The script stages both from `./web`
(building the WASM package first if `./web/pkg` is absent) whenever `slide/pkg`
is missing, then serves.

## Build (manual)

From the repository root:

```bash
# 1. Build the WASM package (or skip if ./web/pkg is already fresh)
scripts/wasm_build_with_cache.sh --out-dir ./web/pkg

# 2. Copy artifacts into ./slide
mkdir -p slide/pkg
cp -R web/pkg/* slide/pkg/
cp web/plotly.min.js slide/assets/plotly.min.js

# 3. Render the slides
cd slide
quarto render
```

Open `slide/_site/index.html` in a browser. Because of WASM fetch / ES module
restrictions, use a local server rather than `file://`:

```bash
cd slide/_site
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Development preview

```bash
./slide/launch.sh    # or, once assets are staged: cd slide && quarto preview
```

Note: if `quarto preview` serves `.wasm` without the `application/wasm` MIME
type, the wasm-bindgen loader logs a warning and falls back to
`WebAssembly.instantiate()`, so the runtime still loads. The blank-slide symptom
is almost always the missing `slide/pkg/` — run `./slide/launch.sh` (or the
manual copy step above) first.

## Adding a new executable slide

In any `.qmd` file, add a raw HTML block:

```markdown
```{=html}
<div class="sjulia-executor" data-code="println(&quot;Hello&quot;)"></div>
```
```

Use `&quot;` for double quotes inside the `data-code` attribute, and `\\n` for
literal backslash-n if needed. The executor replaces `\\n` with real newlines
at runtime.

## Files

- `launch.sh` — one-shot launcher: stages the gitignored runtime assets (`pkg/`, `assets/plotly.min.js`) when missing, then runs `quarto preview` (or `--static`).
- `index.qmd` — the single Quarto reveal.js source file containing all slides.
- `sjulia-runtime.js` — loads the WASM module and warms it up (loaded as a module script to preserve `import.meta.url`).
- `assets/after-body.html` — HTML fragment loaded after the body; contains the `<script>` tags for Plotly, the runtime, and the executor.
- `assets/slide-executor.js` — attaches UI and executes code per slide.
- `assets/slide-executor.css` — styles the executor card.
- `assets/plotly.min.js` — Plotly bundle (copied from `../web`).
- `pkg/` — wasm-pack output (copied from `../web/pkg`).
- `test-render.js` — headless smoke test using Playwright + system Chrome (optional).

## Testing

After rendering, run the headless smoke test:

```bash
cd slide
node test-render.js
```

This requires Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` and the Playwright core package installed in `../web/node_modules`.
# AtelierArith_JuliaCon2026_talk
