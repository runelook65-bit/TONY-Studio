/* TONY Studio — safe headline composition. Source text is never rewritten. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TONYTypography = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const MIN_SIZE = 28;
  const MAX_SIZE = 76;
  const $ = id => document.getElementById(id);
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));

  function breakWord(ctx, word, maxWidth) {
    const chars = Array.from(word);
    const result = [];
    let fragment = '';
    for (const char of chars) {
      if (fragment && ctx.measureText(fragment + char).width > maxWidth) {
        result.push(fragment);
        fragment = char;
      } else {
        fragment += char;
      }
    }
    if (fragment) result.push(fragment);
    return result;
  }

  // Shared line-break algorithm for the canvas renderer and fit prediction.
  function wrapLines(ctx, text, maxWidth) {
    if (!text || !Number.isFinite(maxWidth) || maxWidth <= 0) return [];
    const lines = [];
    for (const paragraph of String(text).split('\n')) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      let line = '';
      for (const word of words) {
        const segments = ctx.measureText(word).width > maxWidth
          ? breakWord(ctx, word, maxWidth) : [word];
        for (const segment of segments) {
          const candidate = line ? line + ' ' + segment : segment;
          if (line && ctx.measureText(candidate).width > maxWidth) {
            lines.push(line);
            line = segment;
          } else {
            line = candidate;
          }
        }
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function ellipsize(ctx, text, maxWidth) {
    let result = String(text || '').trimEnd();
    if (ctx.measureText(result + '…').width <= maxWidth) return result + '…';
    const chars = Array.from(result);
    while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) chars.pop();
    return chars.join('').trimEnd() + '…';
  }

  // Uses the same baseline and badge geometry as index.html's canvas painter.
  function fitHeadline(ctx, text, options) {
    const width = Number(options.width);
    const bottom = Number(options.bottom);
    const safeTop = Number(options.safeTop ?? 225);
    const maxLines = Math.max(1, Number(options.maxLines ?? 5));
    const auto = options.auto !== false;
    const preferred = Math.round(clamp(options.preferredSize ?? 60, MIN_SIZE, MAX_SIZE));
    let chosen = null;
    for (let size = preferred; size >= (auto ? MIN_SIZE : preferred); size -= 1) {
      ctx.font = '800 ' + size + 'px Inter, sans-serif';
      const required = wrapLines(ctx, text, width);
      const lineHeight = Math.round(size * 1.13);
      const baseline = bottom - required.length * lineHeight + size * 0.78;
      const badgeTop = baseline - size * 0.85 - 72;
      const fits = required.length <= maxLines && badgeTop >= safeTop;
      chosen = {fontSize: size, lines: required, lineHeight, badgeTop, overflow: !fits,
        requiredLines: required.length};
      if (fits || !auto) break;
    }
    if (!chosen) return {fontSize: preferred, lines: [], lineHeight: 0, badgeTop: bottom,
      overflow: false, requiredLines: 0};
    if (chosen.overflow) {
      ctx.font = '800 ' + chosen.fontSize + 'px Inter, sans-serif';
      const visible = chosen.lines.slice(0, maxLines);
      while (visible.length > 1) {
        const baseline = bottom - visible.length * chosen.lineHeight + chosen.fontSize * 0.78;
        if (baseline - chosen.fontSize * 0.85 - 72 >= safeTop) break;
        visible.pop();
      }
      // The explicit ellipsis is intentional; text is not silently omitted.
      if (visible.length) visible[visible.length - 1] =
        ellipsize(ctx, visible[visible.length - 1], width);
      chosen.lines = visible;
    }
    return chosen;
  }

  function reportLayout({headline, summaryOverflow, auto}) {
    const output = $('tonyTypographyStatus');
    if (!output) return;
    const issues = [];
    if (headline?.overflow) issues.push('Headline shortened in the graphic. Shorten it before publishing.');
    if (summaryOverflow) issues.push('Summary shortened to 4 lines in the graphic.');
    const size = headline?.fontSize ? ' · ' + headline.fontSize + 'px' : '';
    output.textContent = issues.length
      ? issues.join(' ') + ' The original text remains in the editor.'
      : (auto ? 'Auto-fit on' : 'Manual headline size') + size + ' · Text fits the canvas.';
    output.classList.toggle('text-amber-300', issues.length > 0);
    output.classList.toggle('text-zinc-400', issues.length === 0);
    output.dataset.overflow = String(Boolean(issues.length));
    const toggle = $('tonyAutoFitToggle');
    if (toggle) {
      toggle.textContent = auto ? 'Auto-fit: On' : 'Auto-fit: Off';
      toggle.setAttribute('aria-pressed', String(auto));
    }
  }

  function mount() {
    const headline = $('headlineInput');
    if (!headline || $('tonyTypographyPanel') || !window.TONYStudio) return;
    const container = document.createElement('div');
    container.id = 'tonyTypographyPanel';
    container.className = 'mt-2 rounded-xl border border-white/10 bg-zinc-900/60 p-3';
    container.innerHTML =
      '<div class="flex items-center justify-between gap-2">' +
      '<label for="tonyAutoFitToggle" class="text-xs text-zinc-200 font-semibold">Smart Headline</label>' +
      '<button type="button" id="tonyAutoFitToggle" aria-pressed="true" class="rounded-lg border border-[#FFC300]/60 px-3 py-2 text-xs font-bold text-[#FFC300]">Auto-fit: On</button></div>' +
      '<p id="tonyTypographyStatus" role="status" aria-live="polite" class="mt-2 text-[11px] text-zinc-400">Fits headlines to the canvas without changing the news text.</p>';
    headline.insertAdjacentElement('afterend', container);
    $('tonyAutoFitToggle').addEventListener('click', () => {
      const app = window.TONYStudio;
      app.state.autoFitHeadline = !app.state.autoFitHeadline;
      app.renderCanvas();
    });
    const slider = $('titleSizeRange');
    if (slider) {
      slider.min = String(MIN_SIZE);
      slider.addEventListener('input', () => { window.TONYStudio.state.autoFitHeadline = false; });
    }
    window.TONYStudio.renderCanvas();
  }

  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', mount);
  return {wrapLines, fitHeadline, ellipsize, reportLayout, MIN_SIZE, MAX_SIZE};
});
