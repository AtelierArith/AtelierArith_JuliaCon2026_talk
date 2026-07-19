// slide/assets/slide-executor.js
// Attach an interactive Julia executor to every .sjulia-executor element.

import { registerJuliaLanguage, setWasmModule } from './julia-language.js';

(function () {
  const RUN_TIMEOUT_MS = 5000;
  const MONACO_CDN = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs';
  const MIN_EDITOR_RATIO = 0.35;
  const MAX_EDITOR_RATIO = 0.8;

  let monacoLoadPromise = null;
  let juliaLanguageRegistered = false;

  function loadMonaco() {
    if (monacoLoadPromise) return monacoLoadPromise;

    monacoLoadPromise = new Promise((resolve, reject) => {
      if (window.monaco && window.monaco.editor) {
        resolve(window.monaco);
        return;
      }

      if (typeof window.require !== 'function') {
        reject(new Error('Monaco loader is not available'));
        return;
      }

      window.require.config({ paths: { vs: MONACO_CDN } });
      window.require(['vs/editor/editor.main'], (monaco) => resolve(monaco), reject);
    });

    return monacoLoadPromise;
  }

  function registerJulia(monaco) {
    if (juliaLanguageRegistered) return;
    registerJuliaLanguage(monaco);
    if (window.sjulia) {
      setWasmModule(window.sjulia);
    }
    juliaLanguageRegistered = true;
  }

  function createUi(container) {
    container.classList.add('sjulia-executor-ready');

    const code = document.createElement('div');
    code.className = 'sjulia-code';
    code.setAttribute('aria-label', 'Julia code editor');
    code.dataset.initialCode = (container.getAttribute('data-code') || '').replace(/\\n/g, '\n');

    const runBtn = document.createElement('button');
    runBtn.className = 'sjulia-run-btn';
    runBtn.textContent = 'Run';
    runBtn.disabled = true;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'sjulia-clear-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.type = 'button';

    const output = document.createElement('pre');
    output.className = 'sjulia-output';

    const plot = document.createElement('div');
    plot.className = 'sjulia-plot hidden';

    const divider = document.createElement('div');
    divider.className = 'sjulia-divider';
    divider.setAttribute('role', 'separator');
    divider.setAttribute('aria-orientation', 'vertical');
    divider.setAttribute('aria-label', 'Resize editor and output panes');
    divider.tabIndex = 0;

    const controls = document.createElement('div');
    controls.className = 'sjulia-controls';
    controls.appendChild(clearBtn);
    controls.appendChild(runBtn);

    container.appendChild(code);
    container.appendChild(divider);
    container.appendChild(controls);
    container.appendChild(output);
    container.appendChild(plot);

    return { container, code, divider, runBtn, clearBtn, output, plot, editor: null };
  }

  function clearOutput(ui) {
    ui.output.textContent = '';
    ui.output.classList.remove('sjulia-error');
    ui.plot.classList.add('hidden');
    ui.plot.innerHTML = '';
  }

  function showOutput(ui, text, isError) {
    ui.output.textContent = text;
    ui.output.classList.toggle('sjulia-error', !!isError);
    ui.plot.classList.add('hidden');
    ui.plot.innerHTML = '';
  }

  function showPlot(ui, artifactData) {
    ui.output.textContent = '';
    ui.output.classList.remove('sjulia-error');
    ui.plot.classList.remove('hidden');
    ui.plot.innerHTML = '';

    if (typeof Plotly === 'undefined') {
      showOutput(ui, '[Plotly.js not loaded — cannot render plot]', true);
      return;
    }

    try {
      const parsed = JSON.parse(artifactData);
      const traces = parsed.traces || [];
      const layout = {
        paper_bgcolor: '#1e1f1c',
        plot_bgcolor: '#272822',
        font: { color: '#f8f8f2' },
        margin: { l: 48, r: 20, t: 24, b: 48 },
        ...(parsed.layout || {})
      };
      Plotly.newPlot(ui.plot, traces, layout, { responsive: true });
      resizeUi(ui);
    } catch (e) {
      showOutput(ui, `[Plotly render error: ${e.message}]`, true);
    }
  }

  function resizeUi(ui) {
    if (ui.editor) ui.editor.layout();
    if (typeof Plotly !== 'undefined' && !ui.plot.classList.contains('hidden')) {
      Plotly.Plots.resize(ui.plot);
    }
  }

  function setEditorRatio(ui, ratio) {
    const clamped = Math.min(MAX_EDITOR_RATIO, Math.max(MIN_EDITOR_RATIO, ratio));
    ui.container.style.setProperty('--sjulia-editor-ratio', clamped.toFixed(3));
    ui.divider.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
    resizeUi(ui);
  }

  function setupDivider(ui) {
    const drag = (clientX) => {
      const rect = ui.container.getBoundingClientRect();
      if (rect.width <= 0) return;
      setEditorRatio(ui, (clientX - rect.left) / rect.width);
    };

    ui.divider.addEventListener('pointerdown', (event) => {
      if (window.matchMedia('(max-width: 767px)').matches) return;
      event.preventDefault();
      ui.container.classList.add('sjulia-resizing');
      ui.divider.setPointerCapture(event.pointerId);
      drag(event.clientX);
    });

    ui.divider.addEventListener('pointermove', (event) => {
      if (!ui.divider.hasPointerCapture(event.pointerId)) return;
      drag(event.clientX);
    });

    const stopDrag = (event) => {
      if (ui.divider.hasPointerCapture(event.pointerId)) {
        ui.divider.releasePointerCapture(event.pointerId);
      }
      ui.container.classList.remove('sjulia-resizing');
      resizeUi(ui);
    };

    ui.divider.addEventListener('pointerup', stopDrag);
    ui.divider.addEventListener('pointercancel', stopDrag);
    ui.divider.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 0.08 : 0.03;
      const current = parseFloat(ui.container.style.getPropertyValue('--sjulia-editor-ratio')) || 0.5;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setEditorRatio(ui, current - step);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setEditorRatio(ui, current + step);
      }
    });
  }

  function setupRunShortcut(ui) {
    document.addEventListener('keydown', (event) => {
      const isRunShortcut = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
      if (!isRunShortcut || ui.runBtn.disabled) return;

      const activeSlide = ui.container.closest('section.present, .present');
      if (!activeSlide) return;

      event.preventDefault();
      runCode(ui);
    }, true);
  }

  async function runCode(ui) {
    if (!window.sjulia) {
      showOutput(ui, '[sjulia runtime not loaded]', true);
      return;
    }

    const source = ui.editor ? ui.editor.getValue() : ui.code.dataset.initialCode;
    if (!source.trim()) return;

    ui.runBtn.disabled = true;
    ui.runBtn.textContent = 'Running…';
    showOutput(ui, '', false);

    try {
      const result = await Promise.race([
        new Promise((resolve) => {
          // run_from_source is synchronous in the wasm-bindgen wrapper.
          resolve(window.sjulia.run_from_source(source, BigInt(42)));
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Execution timed out')), RUN_TIMEOUT_MS)
        )
      ]);

      if (result.success) {
        const mime = result.artifact_mime;
        if (mime === 'application/vnd.plotly+json' && result.artifact_data) {
          showPlot(ui, result.artifact_data);
        } else {
          let text = result.output || '';
          if (result.value !== 0 && !Number.isNaN(result.value)) {
            text += (text ? '\n' : '') + `Result: ${result.value}`;
          }
          if (!text) text = 'Completed';
          showOutput(ui, text, false);
        }
      } else {
        const text = result.output
          ? `${result.output}\n${result.error_message || ''}`
          : (result.error_message || 'Execution failed');
        showOutput(ui, text, true);
      }
    } catch (e) {
      showOutput(ui, e.message || 'Execution failed', true);
    } finally {
      ui.runBtn.disabled = false;
      ui.runBtn.textContent = 'Run';
    }
  }

  async function attachEditor(ui) {
    const monaco = await loadMonaco();
    registerJulia(monaco);

    ui.editor = monaco.editor.create(ui.code, {
      value: ui.code.dataset.initialCode,
      language: 'julia',
      theme: 'julia-monokai',
      fontSize: 22,
      fontFamily: "'Fira Code', 'Consolas', 'Monaco', monospace",
      fontLigatures: true,
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 4,
      insertSpaces: true,
      wordWrap: 'on',
      renderWhitespace: 'none',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      padding: { top: 10, bottom: 10 },
      lineHeight: 30,
      renderLineHighlight: 'line',
      overviewRulerLanes: 0,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        useShadows: false,
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      wordBasedSuggestions: 'off',
      suggest: {
        snippetsPreventQuickSuggestions: false,
        showKeywords: true,
        showFunctions: true,
        showVariables: true,
        showConstants: true
      }
    });

    ui.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runCode(ui));
    if (window.Reveal && typeof window.Reveal.on === 'function') {
      window.Reveal.on('slidechanged', () => ui.editor.layout());
    }
    ui.runBtn.disabled = false;
  }

  function attachExecutor(container) {
    const ui = createUi(container);

    setupDivider(ui);
    setupRunShortcut(ui);
    ui.runBtn.addEventListener('click', () => runCode(ui));
    ui.clearBtn.addEventListener('click', () => clearOutput(ui));
    attachEditor(ui).catch((e) => {
      showOutput(ui, `[Monaco editor failed to load: ${e.message}]`, true);
    });

    return ui;
  }

  function enableAll() {
    document.querySelectorAll('.sjulia-executor').forEach((container) => {
      if (container.classList.contains('sjulia-executor-ready')) return;
      attachExecutor(container);
    });
  }

  if (window.sjulia) {
    enableAll();
  } else {
    window.addEventListener('sjulia:ready', enableAll);
  }
})();
