// slide/assets/sjulia-runtime.js
// Load the SubsetJuliaVM WASM runtime once per presentation and warm it up.

import init, * as sjulia from './assets/pkg/subset_julia_vm_web.js';

async function bootSjulia() {
  try {
    await init();
    window.sjulia = sjulia;
    console.log('[sjulia] WASM module loaded');
  } catch (e) {
    console.error('[sjulia] Failed to load WASM module:', e);
    window.dispatchEvent(new CustomEvent('sjulia:ready', { detail: { error: e } }));
    return;
  }

  try {
    // Warm up the plot path so the first user execution is faster.
    sjulia.run_from_source('using Plots\nplot(sin)\n', BigInt(42));
    console.log('[sjulia] Plot warmup completed');
  } catch (e) {
    // Warmup failure is non-fatal; let the user see runtime errors if any.
    console.warn('[sjulia] Plot warmup failed:', e);
  }

  window.dispatchEvent(new CustomEvent('sjulia:ready', { detail: { error: null } }));
}

bootSjulia();
