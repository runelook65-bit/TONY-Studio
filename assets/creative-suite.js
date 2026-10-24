/* TONY Creative Suite: original editorial templates and manual photo focal framing. */
(function (root, build) {
  'use strict';
  const api = build();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TONYCreative = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const TEMPLATES = Object.freeze({
    classic: {label:'Classic News', description:'Original TONY newsroom composition'},
    metro: {label:'Metro Dispatch', description:'Transit-map inspired editorial framing'},
    bulletin: {label:'City Bulletin', description:'Bold front-page inspired graphic treatment'}
  });
  const $ = id => document.getElementById(id);
  function clamp(value, min, max) {
    const n = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  }
  function normalizeState(state) {
    if (!TEMPLATES[state.layoutVariant]) state.layoutVariant = 'classic';
    state.focusX = clamp(state.focusX ?? 50, 0, 100);
    state.focusY = clamp(state.focusY ?? 50, 0, 100);
    state.panX = Number.isFinite(Number(state.panX)) ? Number(state.panX) : 0;
    state.panY = Number.isFinite(Number(state.panY)) ? Number(state.panY) : 0;
  }
  function photoPlacement(imageWidth, imageHeight, canvasWidth, canvasHeight, zoom, focusX, focusY, panX, panY) {
    const iw = Number(imageWidth), ih = Number(imageHeight);
    const cw = Number(canvasWidth), ch = Number(canvasHeight);
    if (![iw, ih, cw, ch].every(n => Number.isFinite(n) && n > 0)) return null;
    const scale = Math.max(cw / iw, ch / ih) * clamp(zoom ?? 100, 100, 220) / 100;
    const width = iw * scale;
    const height = ih * scale;
    const overflowX = Math.max(0, width - cw), overflowY = Math.max(0, height - ch);
    const x = clamp(-overflowX * clamp(focusX ?? 50, 0, 100) / 100 + (Number(panX) || 0), -overflowX, 0);
    const y = clamp(-overflowY * clamp(focusY ?? 50, 0, 100) / 100 + (Number(panY) || 0), -overflowY, 0);
    return {x, y, width, height, overflowX, overflowY, scale};
  }
  function paintFrame(ctx, state, width, height) {
    const template = TEMPLATES[state.layoutVariant] ? state.layoutVariant : 'classic';
    ctx.save();
    if (template === 'metro') {
      ctx.fillStyle = 'rgba(5,9,15,0.38)';
      ctx.fillRect(0, height * 0.48, width, height * 0.52);
      ctx.fillStyle = '#FFC300';
      ctx.fillRect(0, 0, width, 18);
      ctx.fillRect(44, height * 0.60, 6, height * 0.26);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(64, height - 126, width - 128, 2);
    } else if (template === 'bulletin') {
      ctx.fillStyle = 'rgba(0,0,0,0.40)';
      ctx.fillRect(0, height * 0.45, width, height * 0.55);
      ctx.strokeStyle = '#FFC300';
      ctx.lineWidth = 5;
      ctx.strokeRect(28, 28, width - 56, height - 56);
      ctx.fillStyle = '#FFC300';
      ctx.fillRect(width - 250, 28, 222, 14);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(64, height * 0.51, width - 128, 2);
    }
    if (state._tonyExportSlide && state._tonyExportSlide.total > 1) {
      const {index,total} = state._tonyExportSlide;
      ctx.fillStyle = 'rgba(0,0,0,0.80)';
      ctx.fillRect(width - 180, 205, 116, 42);
      ctx.fillStyle = '#FFC300';
      ctx.font = '800 22px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(index).padStart(2,'0') + ' / ' + String(total).padStart(2,'0'), width - 122, 226);
    }
    ctx.restore();
  }
  function mount() {
    const app = window.TONYStudio;
    const photo = $('dropZone')?.parentElement;
    if (!app || !photo || $('tonyCreativePanel')) return;
    normalizeState(app.state);
    const section = document.createElement('section');
    section.id = 'tonyCreativePanel';
    section.className = 'mt-4 border-t border-white/10 pt-4 space-y-3';
    section.innerHTML =
      '<div><h3 class="text-sm font-bold text-white">Creative Layouts & Photo Focus</h3>' +
      '<p class="mt-1 text-[11px] text-zinc-400">Original TONY templates. Focus is a manual crop control, not AI subject detection.</p></div>' +
      '<div role="group" aria-label="TONY layout templates" id="tonyCreativeTemplates" class="grid grid-cols-1 sm:grid-cols-3 gap-2">' +
      Object.entries(TEMPLATES).map(([id, t]) =>
        '<button type="button" data-tony-layout="' + id + '" aria-pressed="false" title="' + t.description +
        '" class="px-3 py-3 rounded-lg border border-white/15 bg-zinc-900 text-xs font-bold text-zinc-200">' + t.label + '</button>'
      ).join('') + '</div>' +
      '<div class="grid grid-cols-2 gap-3">' +
      '<div><label for="tonyFocusX" class="text-xs text-zinc-300">Horizontal focus</label><input id="tonyFocusX" type="range" min="0" max="100" step="5" class="w-full accent-[#FFC300]"><output id="tonyFocusXValue" for="tonyFocusX" class="text-[11px] text-zinc-400"></output></div>' +
      '<div><label for="tonyFocusY" class="text-xs text-zinc-300">Vertical focus</label><input id="tonyFocusY" type="range" min="0" max="100" step="5" class="w-full accent-[#FFC300]"><output id="tonyFocusYValue" for="tonyFocusY" class="text-[11px] text-zinc-400"></output></div></div>' +
      '<button id="tonyFocusReset" type="button" class="text-xs font-bold text-[#FFC300]">Center photo focus</button>';
    photo.appendChild(section);
    for (const button of section.querySelectorAll('[data-tony-layout]')) button.addEventListener('click', () => {
      app.state.layoutVariant = button.dataset.tonyLayout;
      syncControls();
      app.renderCanvas();
    });
    for (const axis of ['X','Y']) {
      $('tonyFocus' + axis).addEventListener('input', event => {
        app.state['focus' + axis] = clamp(event.target.value, 0, 100);
        app.state.panX = 0;
        app.state.panY = 0;
        syncControls();
        app.renderCanvas();
      });
    }
    $('tonyFocusReset').addEventListener('click', () => {
      app.state.focusX = app.state.focusY = 50;
      app.state.panX = app.state.panY = 0;
      syncControls();
      app.renderCanvas();
    });
    syncControls();
    app.renderCanvas();
  }
  function syncControls() {
    const state = typeof window !== 'undefined' ? window.TONYStudio?.state : null;
    if (!state) return;
    normalizeState(state);
    for (const button of document.querySelectorAll('[data-tony-layout]')) {
      const selected = button.dataset.tonyLayout === state.layoutVariant;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('border-[#FFC300]', selected);
      button.classList.toggle('text-[#FFC300]', selected);
    }
    for (const axis of ['X','Y']) {
      const slider = $('tonyFocus' + axis), output = $('tonyFocus' + axis + 'Value');
      const val = state['focus' + axis];
      if (slider) slider.value = String(val);
      if (output) output.textContent = val + '%';
    }
  }
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', mount);
  return {TEMPLATES, clamp, normalizeState, photoPlacement, paintFrame, syncControls, mount};
});
