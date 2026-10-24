/* TONY newsroom tools: URL intake, editorial safeguards and browser-local drafts. */
(function () {
  'use strict';
  const KEY_DRAFT = 'tony.newsroom.draft.v1';
  const KEY_FEED = 'tony.newsroom.feed.v1';
  const MAX_SAVED_POSTS = 12;
  const NYC_TZ = 'America/New_York';
  let currentArticle = null;

  function $(id) { return document.getElementById(id); }
  function info(message, isError) {
    const el = $('tonyArticleMessage');
    if (el) {
      el.textContent = message;
      el.style.color = isError ? '#FCA5A5' : '#A1A1AA';
    }
  }
  function nyTime(when) {
    const value = when ? new Date(when) : new Date();
    const d = Number.isNaN(value.getTime()) ? new Date() : value;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: NYC_TZ, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(d).map(p => [p.type,p.value]));
    return { date: parts.year + '-' + parts.month + '-' + parts.day, time: parts.hour + ':' + parts.minute };
  }
  function newBox(label, id, placeholder) {
    return '<div><label for="' + id + '" class="block text-xs font-semibold text-zinc-300 mb-1">' +
      label + '</label><input id="' + id + '" type="text" placeholder="' + placeholder +
      '" class="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFC300]" /></div>';
  }
  function mount() {
    const section = document.querySelector('main > section');
    if (!section || $('tonyArticleUrl')) return;
    const panel = document.createElement('div');
    panel.id = 'tonyArticlePanel';
    panel.className = 'bg-[#121216] border border-[#FFC300]/35 rounded-2xl p-4 sm:p-5 shadow-lg';
    panel.innerHTML =
      '<div class="flex gap-2 items-center mb-2">' +
      '<span class="text-xs font-black rounded-md px-2 py-1 bg-[#FFC300] text-black">NYC</span>' +
      '<h2 class="font-bold text-sm uppercase tracking-wide text-white">Create a Draft from a News URL</h2></div>' +
      '<p class="text-[11px] text-zinc-400 mb-3">Paste a source link to prefill the headline, description, borough and category. Verify all details before publishing.</p>' +
      '<label for="tonyArticleUrl" class="block text-xs font-semibold text-zinc-300 mb-1">Article URL (HTTPS)</label>' +
      '<div class="flex flex-col sm:flex-row gap-2">' +
      '<input id="tonyArticleUrl" type="url" inputmode="url" placeholder="https://gothamist.com/news/..." class="min-w-0 flex-1 bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFC300]" />' +
      '<button type="button" id="tonyFetchArticle" class="px-4 py-2.5 rounded-xl text-xs font-black bg-[#FFC300] text-black hover:bg-[#ffd030]">Import Article</button></div>' +
      '<div id="tonyArticleMessage" role="status" aria-live="polite" class="mt-2 text-xs text-zinc-400">Supported NYC news outlets and official city sources only.</div>' +
      '<div id="tonyArticlePreview" class="hidden mt-3 rounded-xl border border-white/10 bg-zinc-900/80 p-3">' +
      '<div class="flex gap-3 items-start"><img id="tonyArticleThumb" class="hidden w-20 h-20 rounded-lg object-cover bg-black" alt="Source article thumbnail preview" />' +
      '<div class="min-w-0 flex-1"><div id="tonyArticleSite" class="text-[11px] text-[#FFC300] font-bold"></div>' +
      '<div id="tonyArticleTitle" class="text-sm text-white font-semibold mt-1"></div>' +
      '<div id="tonyArticleDescription" class="text-xs text-zinc-400 mt-1"></div></div></div>' +
      '<p class="text-[11px] text-amber-300 mt-3">Source photos are for reference only. Do not publish without image rights.</p>' +
      '<button type="button" id="tonyApplyArticle" class="mt-3 w-full bg-white text-black text-xs font-black py-2.5 rounded-xl hover:bg-zinc-200">Apply Headline, Category & Borough</button></div>' +
      '<div class="border-t border-white/10 mt-4 pt-4 space-y-3">' +
      '<div class="flex justify-between items-center"><h3 class="text-xs font-bold text-white uppercase tracking-wide">Editorial Review</h3>' +
      '<span class="text-[10px] text-zinc-500">Local draft · Not an Instagram post</span></div>' +
      newBox('Source URL', 'tonySourceUrl', 'https://...') +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
      '<div><label for="tonyVerification" class="block text-xs font-semibold text-zinc-300 mb-1">Source Verification</label>' +
      '<select id="tonyVerification" class="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white">' +
      '<option value="needs-review">Not yet verified</option><option value="cross-checked">Cross-checked with another source</option>' +
      '<option value="official-source">Verified with an official source</option></select></div>' +
      '<div><label for="tonyImagePermission" class="block text-xs font-semibold text-zinc-300 mb-1">Image Rights</label>' +
      '<select id="tonyImagePermission" class="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white">' +
      '<option value="unknown">Rights not reviewed</option><option value="licensed">Licensed / permission granted</option>' +
      '<option value="original">Original photo / owned by us</option><option value="ai-generated">AI-generated illustration (disclosed)</option><option value="none">Do not use an image</option></select></div></div>' +
      newBox('Photo Credit / License Note', 'tonyImageCredit', 'Photographer, agency or license') +
      '<div><label for="tonyPublicationStatus" class="block text-xs font-semibold text-zinc-300 mb-1">Publication Status (manual)</label>' +
      '<select id="tonyPublicationStatus" class="w-full bg-zinc-900 border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white">' +
      '<option value="draft">Draft</option><option value="review">In Editorial Review</option>' +
      '<option value="ready">Ready to Publish</option><option value="published">Manually Published on Instagram</option></select></div>' +
      '<div class="flex flex-wrap gap-2">' +
      '<button type="button" id="tonySaveDraft" class="grow px-3 py-2.5 rounded-xl bg-[#FFC300] text-black text-xs font-black">Save Draft</button>' +
      '<button type="button" id="tonyLoadDraft" class="grow px-3 py-2.5 rounded-xl bg-zinc-800 text-white text-xs font-semibold">Restore Draft</button></div>' +
      '<p id="tonyDraftMessage" role="status" aria-live="polite" class="text-[11px] text-zinc-400">Drafts are stored in this browser and are not synchronized across devices.</p></div>';
    section.insertBefore(panel, section.firstChild);
    $('tonyFetchArticle').addEventListener('click', fetchArticle);
    $('tonyArticleUrl').addEventListener('keydown', e => { if (e.key === 'Enter') fetchArticle(); });
    $('tonyApplyArticle').addEventListener('click', applyArticle);
    $('tonySaveDraft').addEventListener('click', saveDraft);
    $('tonyLoadDraft').addEventListener('click', loadDraft);
    $('tonySourceUrl').addEventListener('input', syncEditorial);
    $('tonyVerification').addEventListener('change', syncEditorial);
    $('tonyImagePermission').addEventListener('change', syncEditorial);
    $('tonyImageCredit').addEventListener('input', syncEditorial);
    $('tonyPublicationStatus').addEventListener('change', syncEditorial);
  }
  function syncEditorial() {
    const app = window.TONYStudio;
    if (!app) return;
    app.state.sourceUrl = $('tonySourceUrl').value.trim();
    app.state.verificationStatus = $('tonyVerification').value;
    app.state.imagePermission = $('tonyImagePermission').value;
    app.state.imageCredit = $('tonyImageCredit').value.trim();
    let next = $('tonyPublicationStatus').value;
    if (next === 'ready' && (!app.state.sourceUrl || app.state.verificationStatus === 'needs-review' || app.state.imagePermission === 'unknown')) {
      next = 'review';
      $('tonyPublicationStatus').value = 'review';
      $('tonyDraftMessage').textContent = 'Ready to Publish requires an article source, verification and image rights review.';
    }
    app.state.publicationStatus = next;
  }
  function setEditorial(post) {
    $('tonySourceUrl').value = post.sourceUrl || '';
    $('tonyVerification').value = post.verificationStatus || 'needs-review';
    $('tonyImagePermission').value = post.imagePermission || 'unknown';
    $('tonyImageCredit').value = post.imageCredit || '';
    $('tonyPublicationStatus').value = post.publicationStatus || 'draft';
    syncEditorial();
  }
  async function fetchArticle() {
    const input = $('tonyArticleUrl');
    if (!input.value.trim()) { info('Enter an article URL.', true); return; }
    try {
      const parsed = new URL(input.value.trim());
      if (parsed.protocol !== 'https:') { info('Use an HTTPS URL.', true); return; }
    } catch { info('Enter a valid URL.', true); return; }
    const button = $('tonyFetchArticle');
    button.disabled = true;
    button.textContent = 'Importing…';
    info('Reading the source headline and article metadata…', false);
    $('tonyArticlePreview').classList.add('hidden');
    try {
      const response = await fetch('/api/article?url=' + encodeURIComponent(input.value.trim()), {headers:{accept:'application/json'}});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'The source could not be loaded.');
      currentArticle = data;
      $('tonyArticleSite').textContent = data.sourceName || 'NEWS SOURCE';
      $('tonyArticleTitle').textContent = data.title || '';
      $('tonyArticleDescription').textContent = data.description || 'Description not available. Check the article manually.';
      const thumb = $('tonyArticleThumb');
      if (data.imageUrl) {
        thumb.src = data.imageUrl;
        thumb.classList.remove('hidden');
        thumb.onerror = () => thumb.classList.add('hidden');
      } else {
        thumb.removeAttribute('src');
        thumb.classList.add('hidden');
      }
      $('tonyArticlePreview').classList.remove('hidden');
      info('Draft imported. Verify the article and photo rights before publishing.', false);
    } catch(e) {
      currentArticle = null;
      info(e.message || 'Import failed. Enter article details manually.', true);
    } finally {
      button.disabled = false;
      button.textContent = 'Import Article';
    }
  }
  function applyArticle() {
    if (!currentArticle || !window.TONYStudio) return;
    const a = currentArticle;
    const app = window.TONYStudio;
    app.applyPreset({
      badgeText: a.category || 'NYC NEWS', badgeColor: a.categoryColor || '#FFC300',
      headline: a.title || '', summary: a.description || '', region: a.region || 'NEW YORK CITY',
      dateLang: 'EN'
    });
    // Preserve the currently uploaded, licensed image; never import an unknown-rights source photo.
    const t = nyTime(a.publishedAt || null);
    app.state.dateValue = t.date;
    app.state.timeValue = t.time;
    app.dateInput.value = t.date;
    app.timeInput.value = t.time;
    app.state.sourceName = a.sourceName || '';
    app.state.sourcePublishedAt = a.publishedAt || null;
    app.renderCanvas();
    setEditorial({ sourceUrl: a.sourceUrl, verificationStatus: 'needs-review', imagePermission: 'unknown', imageCredit: '', publicationStatus: 'draft' });
    $('tonyDraftMessage').textContent = a.publishedAt
      ? 'Publication time came from the source (New York time). Confirm before posting.'
      : 'No publication timestamp was found; using New York local time.';
    app.showToast('Article draft imported for review');
  }
  function serializeCurrent() {
    const s = window.TONYStudio.state;
    return {
      badgeText:s.badgeText,badgeColor:s.badgeColor,headline:s.headline,summary:s.summary,
      autoFitHeadline:s.autoFitHeadline !== false,
      region:s.region,dateValue:s.dateValue,timeValue:s.timeValue,dateLang:s.dateLang,
      sourceUrl:s.sourceUrl || '',sourceName:s.sourceName || '',
      sourcePublishedAt:s.sourcePublishedAt || null,
      verificationStatus:s.verificationStatus || 'needs-review',
      imagePermission:s.imagePermission || 'unknown',imageCredit:s.imageCredit || '',
      publicationStatus:s.publicationStatus || 'draft',
      photoKind:s.photoKind || 'manual',photoSourceUrl:s.photoSourceUrl || '',
      photoSourceCredit:s.photoSourceCredit || '',photoLicense:s.photoLicense || '',
      photoFilter:s.photoFilter || 'gotham',filterIntensity:s.filterIntensity ?? 70,
      layoutVariant:s.layoutVariant || 'classic',
      focusX:s.focusX ?? 50,focusY:s.focusY ?? 50,
      carouselSlides:window.TONYCarousel?.normalizeSlides(s.carouselSlides) || [],
      brandLogoMode:s.brandLogoMode || 'logo',brandLogoSize:s.brandLogoSize || 120,
      savedAt:new Date().toISOString()
    };
  }
  function saveDraft() {
    try {
      syncEditorial();
      localStorage.setItem(KEY_DRAFT, JSON.stringify(serializeCurrent()));
      $('tonyDraftMessage').textContent = 'Draft saved on this device. Uploaded photos are not saved.';
      window.TONYStudio.showToast('News draft saved');
    } catch {
      $('tonyDraftMessage').textContent = 'Browser storage is unavailable or full. Could not save draft.';
    }
  }
  function loadDraft() {
    try {
      const raw = localStorage.getItem(KEY_DRAFT);
      if (!raw) { $('tonyDraftMessage').textContent = 'No saved draft found.'; return; }
      const d = JSON.parse(raw);
      const app = window.TONYStudio;
      app.applyPreset({badgeText:d.badgeText || 'NYC NEWS',badgeColor:d.badgeColor || '#FFC300',
        headline:d.headline || '',summary:d.summary || '',region:d.region || 'NEW YORK CITY',dateLang:'EN'});
      if (/^\d{4}-\d\d-\d\d$/.test(d.dateValue || '')) { app.state.dateValue=d.dateValue;app.dateInput.value=d.dateValue; }
      if (/^\d\d:\d\d$/.test(d.timeValue || '')) { app.state.timeValue=d.timeValue;app.timeInput.value=d.timeValue; }
      app.state.sourceName=d.sourceName || '';
      app.state.sourcePublishedAt=d.sourcePublishedAt || null;
      setEditorial(d);
      // Browser draft storage does not persist uploaded images: require new image rights review.
      app.state.photoKind = 'manual';
      app.state.photoSourceUrl = '';
      app.state.photoSourceCredit = '';
      app.state.photoLicense = '';
      const copyrightStatus = $('tonyImagePermission');
      if (copyrightStatus) { copyrightStatus.value = 'unknown'; copyrightStatus.dispatchEvent(new Event('change')); }
      app.state.autoFitHeadline = d.autoFitHeadline !== false;
      app.state.photoFilter = d.photoFilter || 'gotham';
      app.state.filterIntensity = d.filterIntensity ?? 70;
      app.state.layoutVariant = d.layoutVariant || 'classic';
      // Saved drafts never persist the photo itself. Re-importing resets photo focus.
      app.state.focusX = 50;
      app.state.focusY = 50;
      app.state.carouselSlides = window.TONYCarousel?.normalizeSlides(d.carouselSlides) || [];
      window.TONYCreative?.syncControls();
      window.TONYCarousel?.syncControls();
      app.state.brandLogoMode = d.brandLogoMode || 'logo';
      app.state.brandLogoSize = d.brandLogoSize || 120;
      window.TONYEffects?.syncControls();
      app.renderCanvas();
      $('tonyDraftMessage').textContent = 'Draft restored. Re-upload the photo if needed.';
      app.showToast('Draft loaded');
    } catch { $('tonyDraftMessage').textContent = 'Could not read saved draft.'; }
  }
  function compactPreview(dataUrl) {
    try {
      const image = new Image();
      // Persisting a 1080px base64 canvas can exhaust localStorage.
      // This uses the currently drawn canvas as the source, not external images.
      const canvas = window.TONYStudio.canvas;
      const c = document.createElement('canvas'); c.width = 260; c.height = 325;
      const g = c.getContext('2d');
      if (!g || !canvas) return '';
      const h = Math.round(c.width * canvas.height / canvas.width);
      c.height = h;
      g.drawImage(canvas,0,0,c.width,c.height);
      return c.toDataURL('image/jpeg',0.58);
    } catch { return ''; }
  }
  function persistFeed() {
    const app = window.TONYStudio;
    if (!app) return;
    try {
      const posts = app.state.feedPosts.slice(0,MAX_SAVED_POSTS).map(p => ({
        id:p.id, badgeText:p.badgeText, badgeColor:p.badgeColor, headline:p.headline,
        summary:p.summary, region:p.region, dateValue:p.dateValue, timeValue:p.timeValue,
        dateLang:p.dateLang,sourceUrl:p.sourceUrl || '',sourceName:p.sourceName || '',
        verificationStatus:p.verificationStatus || 'needs-review',
        imagePermission:p.imagePermission || 'unknown',imageCredit:p.imageCredit || '',
        publicationStatus:p.publicationStatus || 'draft',
        photoKind:p.photoKind || 'manual',photoSourceUrl:p.photoSourceUrl || '',
        photoSourceCredit:p.photoSourceCredit || '',photoLicense:p.photoLicense || '',
        photoFilter:p.photoFilter || 'gotham',filterIntensity:p.filterIntensity ?? 70,
        layoutVariant:p.layoutVariant || 'classic',
        carouselSlides:window.TONYCarousel?.normalizeSlides(p.carouselSlides) || [],
        // Photos are not stored in browser drafts: never reuse stale focal coordinates.
        focusX:50,focusY:50,
        brandLogoMode:p.brandLogoMode || 'logo',brandLogoSize:p.brandLogoSize || 120,
        previewUrl: p.previewUrl && p.previewUrl.length < 85000 ? p.previewUrl : ''
      }));
      localStorage.setItem(KEY_FEED,JSON.stringify(posts));
    } catch { /* private mode / quota: editor still works without persistence */ }
  }
  function restoreFeed() {
    try {
      const raw = localStorage.getItem(KEY_FEED);
      const saved = raw && JSON.parse(raw);
      if (!Array.isArray(saved)) return false;
      const app = window.TONYStudio;
      app.state.feedPosts = saved.filter(p => p && typeof p.headline === 'string')
        .slice(0,MAX_SAVED_POSTS).map(p => Object.assign(p,{imageRef:null,previewUrl:p.previewUrl || ''}));
      app.renderFeedGrid();
      return true;
    } catch { return false; }
  }
  function captureFeedPreview() {
    // Called by the existing editor after rendering each saved grid post.
    const app = window.TONYStudio;
    if (!app || !app.state.feedPosts.length) return;
    const first = app.state.feedPosts[0];
    const preview = compactPreview();
    if (preview) first.previewUrl = preview;
    persistFeed();
  }
  function setDefaults() {
    const app = window.TONYStudio;
    if (!app) return;
    const t = nyTime();
    app.state.dateValue = t.date;
    app.state.timeValue = t.time;
    app.state.dateLang = 'EN';
    app.state.region = 'NEW YORK CITY';
    app.state.badgeText = 'NYC NEWS';
    app.state.badgeColor = '#FFC300';
    app.state.headline = 'Your New York story starts here';
    app.state.summary = 'Paste a verified NYC article URL or write your own report.';
    app.dateInput.value = t.date;
    app.timeInput.value = t.time;
    app.applyPreset({badgeText:app.state.badgeText,badgeColor:app.state.badgeColor,
      headline:app.state.headline,summary:app.state.summary,region:app.state.region,dateLang:'EN'});
    app.renderCanvas();
  }
  window.TONYNewsroom = { mount, restoreFeed, captureFeedPreview, persistFeed, setDefaults, setEditorial, nyTime };
  document.addEventListener('DOMContentLoaded', mount);
})();
