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
quarto preview
```

The project home page is served at `/`, and the reveal.js deck is served at
`/slide/slide.html`.

## Build (manual)

From the repository root:

```bash
# 1. Build the WASM package (or skip if ./web/pkg is already fresh)
scripts/wasm_build_with_cache.sh --out-dir ./web/pkg

# 2. Copy artifacts into ./slide
mkdir -p slide/pkg
cp -R web/pkg/* slide/pkg/
cp web/plotly.min.js slide/assets/plotly.min.js

# 3. Render the website and slides
quarto render
```

Open `_site/slide/slide.html` in a browser. Because of WASM fetch / ES module
restrictions, use a local server rather than `file://`:

```bash
cd _site
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Development preview

```bash
quarto preview
```

Note: if the executor stays blank, confirm that `slide/pkg/` and
`slide/assets/plotly.min.js` exist, then render again.

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

- `slide.qmd` — the single Quarto reveal.js source file containing all slides.
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
node slide/test-render.js
```

This requires Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Install the test dependency with `npm install` first.
# AtelierArith_JuliaCon2026_talk
