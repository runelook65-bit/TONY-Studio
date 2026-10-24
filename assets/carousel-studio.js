/* TONY Carousel Studio: reviewed copy becomes downloadable multi-page PNG ZIP drafts.
   This feature deliberately does NOT publish a multi-image Instagram post. */
(function (root, build) {
  'use strict';
  const api = build();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TONYCarousel = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const MAX_PAGES = 6;
  const $ = id => document.getElementById(id);
  const encoder = new TextEncoder();

  function normalizeSlides(input) {
    return (Array.isArray(input) ? input : []).slice(0, MAX_PAGES - 1).map(s => ({
      headline: typeof s?.headline === 'string' ? s.headline.slice(0, 500) : '',
      summary: typeof s?.summary === 'string' ? s.summary.slice(0, 1500) : ''
    }));
  }
  function pagesFromState(state) {
    return [
      {headline: String(state.headline || ''), summary: String(state.summary || '')},
      ...normalizeSlides(state.carouselSlides)
    ];
  }
  function validatePages(state) {
    const pages = pagesFromState(state);
    if (pages.length < 2) return 'Add at least one follow-up page to build a carousel.';
    if (pages.length > MAX_PAGES) return 'A carousel can contain at most six pages.';
    if (/^(your new york story starts here|\[demo\])/i.test(pages[0].headline.trim())) {
      return 'Replace the demo headline with a verified story before exporting.';
    }
    for (let i = 0; i < pages.length; i++) {
      if (!pages[i].headline.trim() || !pages[i].summary.trim()) {
        return 'Page ' + (i + 1) + ' needs a headline and summary.';
      }
    }
    return null;
  }

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zipPngFiles(files) {
    if (!Array.isArray(files) || files.length < 2 || files.length > MAX_PAGES) throw Error('Export must contain 2–6 pages.');
    const chunks = [], directory = [];
    let cursor = 0, total = 0;
    function u16(view, offset, value) { view.setUint16(offset, value, true); }
    function u32(view, offset, value) { view.setUint32(offset, value >>> 0, true); }
    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      if (!(item?.bytes instanceof Uint8Array) || item.bytes.length < 8) throw Error('Invalid PNG page ' + (i + 1));
      // PNG signature only. No untrusted filenames enter the ZIP.
      if (![137,80,78,71,13,10,26,10].every((n,k) => item.bytes[k] === n)) throw Error('Page ' + (i + 1) + ' is not a PNG.');
      total += item.bytes.length;
      if (total > 90 * 1024 * 1024) throw Error('Carousel is too large (90 MB limit).');
      const filename = encoder.encode('TONY-slide-' + String(i + 1).padStart(2,'0') + '.png');
      const hash = crc32(item.bytes), size = item.bytes.length;
      const local = new Uint8Array(30 + filename.length);
      const lv = new DataView(local.buffer);
      u32(lv,0,0x04034b50); u16(lv,4,20); u16(lv,6,0); u16(lv,8,0);
      u32(lv,14,hash); u32(lv,18,size); u32(lv,22,size); u16(lv,26,filename.length);
      local.set(filename,30);
      chunks.push(local, item.bytes);
      const central = new Uint8Array(46 + filename.length);
      const cv = new DataView(central.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0);u16(cv,10,0);
      u32(cv,16,hash);u32(cv,20,size);u32(cv,24,size);u16(cv,28,filename.length);
      u32(cv,42,cursor);central.set(filename,46);
      directory.push(central);
      cursor += local.length + size;
    }
    const directorySize = directory.reduce((n, part) => n + part.length, 0);
    const end = new Uint8Array(22);
    const view = new DataView(end.buffer);
    u32(view,0,0x06054b50);u16(view,8,files.length);u16(view,10,files.length);
    u32(view,12,directorySize);u32(view,16,cursor);
    const zip = new Uint8Array(cursor + directorySize + end.length);
    let offset = 0;
    for (const chunk of [...chunks, ...directory, end]) {zip.set(chunk, offset); offset += chunk.length;}
    return zip;
  }

  let current = 0, busy = false;
  function setStatus(text, error = false) {
    const status = $('tonyCarouselStatus');
    if (!status) return;
    status.textContent = text;
    status.classList.toggle('text-amber-300', error);
    status.classList.toggle('text-zinc-400', !error);
  }
  function syncControls() {
    const state = window.TONYStudio?.state;
    if (!state || !$('tonyCarouselPanel')) return;
    state.carouselSlides = normalizeSlides(state.carouselSlides);
    current = Math.min(current, state.carouselSlides.length);
    paintEditor();
  }
  function paintEditor() {
    const app = window.TONYStudio;
    if (!app || !$('tonyCarouselPages')) return;
    const pages = pagesFromState(app.state), tabs = $('tonyCarouselPages');
    tabs.replaceChildren();
    for (let i = 0; i < pages.length; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Page ' + (i + 1);
      b.setAttribute('aria-pressed', String(i === current));
      b.className = 'rounded-lg border px-3 py-2 text-xs font-bold ' +
        (i === current ? 'border-[#FFC300] text-[#FFC300] bg-zinc-800' : 'border-white/15 text-zinc-300 bg-zinc-900');
      b.addEventListener('click', () => {current = i; paintEditor(); updatePreview();});
      tabs.appendChild(b);
    }
    const isCover = current === 0;
    $('tonyCarouselCoverNote').hidden = !isCover;
    $('tonyCarouselEditor').hidden = isCover;
    if (!isCover) {
      $('tonyCarouselHeadline').value = pages[current].headline;
      $('tonyCarouselSummary').value = pages[current].summary;
    }
    $('tonyCarouselRemove').disabled = isCover || busy;
    $('tonyCarouselAdd').disabled = pages.length >= MAX_PAGES || busy;
    $('tonyCarouselDownload').disabled = busy || pages.length < 2;
    $('tonyCarouselCount').textContent = pages.length + ' / ' + MAX_PAGES + ' pages';
  }
  function withPage(app, index, total, action) {
    const state = app.state;
    const original = {
      headline:state.headline, summary:state.summary, exportSlide:state._tonyExportSlide
    };
    const slide = pagesFromState(state)[index];
    if (!slide) throw Error('Carousel page was not found.');
    try {
      state.headline = slide.headline;
      state.summary = slide.summary;
      state._tonyExportSlide = {index:index + 1, total};
      app.renderCanvas();
      return action(app.canvas);
    } finally {
      state.headline = original.headline;
      state.summary = original.summary;
      if (original.exportSlide === undefined) delete state._tonyExportSlide;
      else state._tonyExportSlide = original.exportSlide;
      app.renderCanvas();
    }
  }
  function updatePreview() {
    const app = window.TONYStudio;
    const preview = $('tonyCarouselPreview');
    if (!app || !preview) return;
    try {
      preview.src = withPage(app,current, pagesFromState(app.state).length, canvas => canvas.toDataURL('image/jpeg',0.64));
      preview.alt = 'Page ' + (current + 1) + ' carousel design preview';
    } catch {
      preview.removeAttribute('src');
      setStatus('Preview could not be rendered. Recheck the image source.', true);
    }
  }
  function updateSlideText() {
    const slides = window.TONYStudio?.state.carouselSlides;
    if (!slides || current < 1 || !slides[current - 1]) return;
    slides[current - 1].headline = $('tonyCarouselHeadline').value.slice(0,500);
    slides[current - 1].summary = $('tonyCarouselSummary').value.slice(0,1500);
    setStatus('Draft updated. Preview again to inspect the new text.');
  }
  async function toPngBytes(canvas) {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(output => output ? resolve(output) : reject(Error('PNG export failed.')), 'image/png');
    });
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function downloadZip() {
    if (busy) return;
    const app = window.TONYStudio;
    if (!app) return;
    const err = validatePages(app.state);
    if (err) {setStatus(err, true);return;}
    const button = $('tonyCarouselDownload');
    busy = true;
    button.disabled = true;
    const pages = pagesFromState(app.state);
    const original = {
      headline:app.state.headline, summary:app.state.summary,
      exportSlide:app.state._tonyExportSlide
    };
    try {
      const files = [];
      // Keep canvas state coherent across awaits; Instagram actions are not invoked.
      for (let i = 0; i < pages.length; i++) {
        // Clone the painted canvas synchronously. The main editor is restored
        // before the async PNG encoder starts, so publishing cannot see a
        // temporary carousel headline or slide marker.
        const pageCanvas = withPage(app, i, pages.length, canvas => {
          const copy = document.createElement('canvas');
          copy.width = canvas.width;
          copy.height = canvas.height;
          const ctx = copy.getContext('2d');
          if (!ctx) throw Error('Canvas unavailable for carousel export.');
          ctx.drawImage(canvas, 0, 0);
          return copy;
        });
        setStatus('Exporting page ' + (i + 1) + ' of ' + pages.length + '…');
        files.push({bytes: await toPngBytes(pageCanvas)});
      }
      const archive = zipPngFiles(files);
      const url = URL.createObjectURL(new Blob([archive], {type:'application/zip'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'TONY-NYC-carousel-' + new Date().toISOString().slice(0,10) + '.zip';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Carousel ZIP ready. These are downloadable drafts, not an Instagram publication.');
    } catch (error) {
      setStatus(error.message || 'Could not create carousel archive.', true);
    } finally {
      app.state.headline = original.headline;
      app.state.summary = original.summary;
      if (original.exportSlide === undefined) delete app.state._tonyExportSlide;
      else app.state._tonyExportSlide = original.exportSlide;
      app.renderCanvas();
      busy = false;
      paintEditor();
    }
  }
  function mount() {
    const app = window.TONYStudio;
    const actions = $('btnDownloadPNG')?.parentElement;
    if (!app || !actions || $('tonyCarouselPanel')) return;
    app.state.carouselSlides = normalizeSlides(app.state.carouselSlides);
    const panel = document.createElement('section');
    panel.id = 'tonyCarouselPanel';
    panel.className = 'mt-5 border-t border-white/10 pt-4 space-y-3';
    panel.innerHTML =
      '<div class="flex flex-wrap justify-between gap-2 items-start"><div>' +
      '<h3 class="text-sm font-black text-white">Instagram Carousel Builder</h3>' +
      '<p class="text-[11px] text-zinc-400 mt-1">2–6 original news slides in one ZIP. No automatic Instagram posting.</p></div>' +
      '<span id="tonyCarouselCount" class="text-xs text-[#FFC300] font-bold"></span></div>' +
      '<div id="tonyCarouselPages" class="flex gap-2 overflow-x-auto pb-1" aria-label="Carousel pages"></div>' +
      '<p id="tonyCarouselCoverNote" class="text-xs text-zinc-400">Cover uses the main Story headline and summary. Change them in the editor.</p>' +
      '<div id="tonyCarouselEditor" class="space-y-2" hidden>' +
      '<label for="tonyCarouselHeadline" class="block text-xs font-semibold text-zinc-300">Slide headline</label>' +
      '<textarea id="tonyCarouselHeadline" maxlength="500" rows="2" class="w-full rounded-lg bg-zinc-900 border border-white/15 p-2.5 text-sm text-white"></textarea>' +
      '<label for="tonyCarouselSummary" class="block text-xs font-semibold text-zinc-300">Supporting facts / context</label>' +
      '<textarea id="tonyCarouselSummary" maxlength="1500" rows="3" class="w-full rounded-lg bg-zinc-900 border border-white/15 p-2.5 text-xs text-white"></textarea></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="button" id="tonyCarouselAdd" class="px-3 py-2.5 rounded-lg bg-zinc-800 text-white text-xs font-bold">+ Add page</button>' +
      '<button type="button" id="tonyCarouselRemove" class="px-3 py-2.5 rounded-lg bg-zinc-800 text-white text-xs font-bold">Remove page</button>' +
      '<button type="button" id="tonyCarouselRefresh" class="px-3 py-2.5 rounded-lg border border-[#FFC300]/50 text-[#FFC300] text-xs font-bold">Preview page</button></div>' +
      '<img id="tonyCarouselPreview" alt="Carousel slide preview" class="mx-auto rounded-lg border border-white/10 w-44 max-w-full" />' +
      '<button type="button" id="tonyCarouselDownload" class="w-full rounded-lg bg-[#FFC300] p-3 text-xs font-black text-black">Download carousel ZIP (PNG slides)</button>' +
      '<p id="tonyCarouselStatus" role="status" aria-live="polite" class="text-[11px] text-zinc-400">Verify every slide and image permission before sharing. This ZIP does not post to Instagram.</p>';
    actions.insertAdjacentElement('afterend', panel);
    $('tonyCarouselAdd').addEventListener('click', () => {
      const slides = app.state.carouselSlides;
      if (busy || slides.length >= MAX_PAGES - 1) return;
      slides.push({headline:'',summary:''});
      current = slides.length;
      paintEditor();
      setStatus('Add sourced facts for the new slide, then preview it.');
    });
    $('tonyCarouselRemove').addEventListener('click', () => {
      if (busy || current === 0) return;
      app.state.carouselSlides.splice(current - 1,1);
      current = Math.min(current,app.state.carouselSlides.length);
      paintEditor();
      updatePreview();
    });
    $('tonyCarouselHeadline').addEventListener('input', updateSlideText);
    $('tonyCarouselSummary').addEventListener('input', updateSlideText);
    $('tonyCarouselRefresh').addEventListener('click', updatePreview);
    $('tonyCarouselDownload').addEventListener('click', downloadZip);
    paintEditor();
    updatePreview();
  }
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', mount);
  return {normalizeSlides, pagesFromState, validatePages, crc32, zipPngFiles, syncControls, mount};
});
