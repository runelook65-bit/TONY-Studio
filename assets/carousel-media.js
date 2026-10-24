/* TONY: per-slide media registry. Decoded photos stay in this browser tab only. */
(function(root, build) {
  'use strict';
  const api = build();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TONYCarouselMedia = api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';
  const images = new Map();
  const ALLOWED = new Set(['image/jpeg','image/png','image/webp']);
  const RIGHTS = new Set(['original','licensed','ai-generated']);
  const $ = id => document.getElementById(id);
  const clamp = (v, min, max) => {
    const n = Number(v);
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  };
  function getImage(id) {
    return typeof id === 'string' ? images.get(id) || null : null;
  }
  function putImage(id, img) {
    if (typeof id !== 'string' || !/^[a-z0-9_-]{1,72}$/i.test(id)) throw Error('Invalid slide identifier.');
    if (!img || !(img.naturalWidth > 0) || !(img.naturalHeight > 0)) throw Error('Image has no usable dimensions.');
    images.set(id, img);
  }
  function remove(id) { images.delete(id); }
  function clear() { images.clear(); }
  function exportWarning(state) {
    // A ZIP is a distribution artifact: review both the news and every photograph.
    const url = String(state.sourceUrl || '');
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') throw Error('Invalid protocol');
    } catch { return 'Add a valid HTTPS article source in Editorial Review before exporting.'; }
    if (!['cross-checked','official-source'].includes(state.verificationStatus)) {
      return 'Cross-check the article or verify an official source before exporting.';
    }
    if (state.activeImage && !RIGHTS.has(state.imagePermission)) {
      return 'Review the cover photo rights before exporting the carousel.';
    }
    if (state.activeImage && state.photoKind === 'ai' && state.imagePermission !== 'ai-generated') {
      return 'Mark the AI-generated cover as an AI illustration before exporting.';
    }
    for (let i = 0; i < (state.carouselSlides || []).length; i++) {
      const slide = state.carouselSlides[i];
      if (!getImage(slide.id)) continue;
      if (!RIGHTS.has(slide.imagePermission)) {
        return 'Page ' + (i + 2) + ': select confirmed image rights before exporting.';
      }
      if (slide.imagePermission === 'licensed' && !String(slide.imageCredit || '').trim()) {
        return 'Page ' + (i + 2) + ': add photographer / license credit.';
      }
    }
    return null;
  }
  function selectSlide() {
    const app = window.TONYStudio;
    const index = window.TONYCarousel?.currentIndex() ?? 0;
    const slide = index ? app?.state.carouselSlides?.[index - 1] : null;
    return {app,index,slide};
  }
  function status(text,error=false) {
    const el=$('tonyCarouselVisualStatus');
    if (!el) return;
    el.textContent=text;
    el.classList.toggle('text-amber-300',error);
    el.classList.toggle('text-zinc-400',!error);
  }
  function syncControls() {
    if (!$('tonyCarouselMediaPanel')) return;
    const {slide}=selectSlide();
    const panel=$('tonyCarouselMediaPanel');
    panel.hidden=!slide;
    if (!slide) return;
    const custom=Boolean(getImage(slide.id));
    $('tonyCarouselMediaName').textContent=custom?'Independent slide photo loaded':'Using cover photo (no separate file)';
    $('tonyCarouselUseCover').disabled=!custom;
    const select=$('tonyCarouselSlideLayout');
    select.value=['inherit','classic','metro','bulletin'].includes(slide.layoutVariant)?slide.layoutVariant:'inherit';
    for(const axis of ['X','Y']){
      const slider=$('tonyCarouselSlideFocus'+axis);
      const val=clamp(slide['focus'+axis]??50,0,100);
      slider.value=String(val);
      $('tonyCarouselSlideFocus'+axis+'Value').textContent=String(val)+'%';
    }
    $('tonyCarouselSlideRights').value=custom?(slide.imagePermission||'unknown'):'unknown';
    $('tonyCarouselSlideRights').disabled=!custom;
    $('tonyCarouselSlideCredit').value=custom?(slide.imageCredit||''):'';
    $('tonyCarouselSlideCredit').disabled=!custom;
    $('tonyCarouselSlideRightsHelp').textContent=custom
      ? 'Confirm rights for this page separately. Choosing AI-generated adds the illustration label.'
      : 'Cover image rights are reviewed in the main Editorial Review panel.';
  }
  function showPreview() {
    window.TONYCarousel?.preview();
  }
  function onLayout(value) {
    const {slide}=selectSlide();
    if (!slide) return;
    slide.layoutVariant=['classic','metro','bulletin'].includes(value)?value:'inherit';
    syncControls(); showPreview();
  }
  async function readImage(file) {
    if (!file || !ALLOWED.has(file.type)) throw Error('Choose a JPG, PNG or WEBP photograph.');
    if (!file.size || file.size > 15 * 1024 * 1024) throw Error('Photo must be 15 MB or smaller.');
    const objectUrl=URL.createObjectURL(file);
    try {
      const img=new Image();
      await new Promise((resolve,reject)=>{
        img.onload=resolve;
        img.onerror=()=>reject(Error('Photo could not be decoded.'));
        img.src=objectUrl;
      });
      if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth > 12000 || img.naturalHeight > 12000)
        throw Error('Photo dimensions are unsupported.');
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  async function upload(file) {
    const {app,slide}=selectSlide();
    if (!slide || !app) return;
    const id=slide.id;
    status('Decoding this slide photo…');
    try {
      const img=await readImage(file);
      const target=app.state.carouselSlides.find(s=>s.id===id);
      if (!target) return; // user deleted the slide during decode
      putImage(id,img);
      target.imagePermission='unknown';
      target.imageCredit='';
      target.focusX=50;
      target.focusY=50;
      target.zoom=100;
      if (selectSlide().slide?.id===id) {
        syncControls();showPreview();
      }
      status('Separate photo loaded. Confirm rights and preview before export.');
    } catch (e) {
      status(e.message||'Could not import the photo.',true);
    } finally {
      if ($('tonyCarouselPhoto')) $('tonyCarouselPhoto').value='';
    }
  }
  function mount() {
    if (!$('tonyCarouselEditor') || $('tonyCarouselMediaPanel')) return;
    const parent=$('tonyCarouselEditor');
    const panel=document.createElement('fieldset');
    panel.id='tonyCarouselMediaPanel';
    panel.className='border-t border-white/10 pt-3 mt-3 space-y-3';
    panel.innerHTML=
      '<legend class="text-xs font-black text-[#FFC300]">This Slide: Photo & Layout</legend>'+
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">'+
      '<div><label for="tonyCarouselPhoto" class="block text-xs text-zinc-300 mb-1">Upload separate photo</label>'+
      '<input type="file" id="tonyCarouselPhoto" accept="image/jpeg,image/png,image/webp" class="w-full max-w-full text-[11px] text-zinc-300 file:mr-2 file:bg-zinc-800 file:text-white file:border-0 file:rounded-lg file:p-2"></div>'+
      '<div><label for="tonyCarouselSlideLayout" class="block text-xs text-zinc-300 mb-1">Slide design</label>'+
      '<select id="tonyCarouselSlideLayout" class="w-full rounded-lg bg-zinc-900 border border-white/15 p-2 text-xs text-white">'+
      '<option value="inherit">Use cover style</option><option value="classic">Classic News</option>'+
      '<option value="metro">Metro Dispatch</option><option value="bulletin">City Bulletin</option></select></div></div>'+
      '<div class="flex flex-wrap gap-2 justify-between items-center"><span id="tonyCarouselMediaName" class="text-[11px] text-zinc-400"></span>'+
      '<button type="button" id="tonyCarouselUseCover" class="text-xs font-bold text-[#FFC300]">Use cover photo</button></div>'+
      '<div class="grid grid-cols-2 gap-3">'+
      ['X','Y'].map(axis=>'<div><label class="text-[11px] text-zinc-300" for="tonyCarouselSlideFocus'+axis+'">'+
      (axis==='X'?'Horizontal focus':'Vertical focus')+'</label><input id="tonyCarouselSlideFocus'+axis+
      '" type="range" min="0" max="100" step="5" class="w-full accent-[#FFC300]">'+
      '<output id="tonyCarouselSlideFocus'+axis+'Value" for="tonyCarouselSlideFocus'+axis+'" class="text-[11px] text-zinc-400"></output></div>').join('')+'</div>'+
      '<div><label for="tonyCarouselSlideRights" class="block text-xs text-zinc-300 mb-1">Image rights for this slide</label>'+
      '<select id="tonyCarouselSlideRights" class="w-full rounded-lg bg-zinc-900 border border-white/15 p-2 text-xs text-white">'+
      '<option value="unknown">Not reviewed</option><option value="original">Original photo / owned by us</option>'+
      '<option value="licensed">Licensed / permission granted</option><option value="ai-generated">AI-generated illustration</option></select>'+
      '<p id="tonyCarouselSlideRightsHelp" class="text-[11px] text-zinc-400 mt-1"></p></div>'+
      '<div><label for="tonyCarouselSlideCredit" class="block text-xs text-zinc-300 mb-1">Photographer / license credit</label>'+
      '<input type="text" id="tonyCarouselSlideCredit" maxlength="200" placeholder="Photographer, license, URL…" class="w-full rounded-lg bg-zinc-900 border border-white/15 p-2 text-xs text-white"></div>'+
      '<p id="tonyCarouselVisualStatus" role="status" aria-live="polite" class="text-[11px] text-zinc-400">Photo files stay in this browser tab; local draft storage saves only text and design settings.</p>';
    parent.append(panel);
    $('tonyCarouselPhoto').addEventListener('change',e=>{if (e.target.files?.[0]) upload(e.target.files[0]);});
    $('tonyCarouselUseCover').addEventListener('click',()=>{
      const {slide}=selectSlide(); if(!slide)return;
      remove(slide.id);
      slide.imagePermission='unknown';slide.imageCredit='';
      syncControls();showPreview();status('This page now uses the cover photo.');
    });
    $('tonyCarouselSlideLayout').addEventListener('change',e=>onLayout(e.target.value));
    for(const axis of ['X','Y']){
      $('tonyCarouselSlideFocus'+axis).addEventListener('input',e=>{
        const {slide}=selectSlide(); if(!slide)return;
        slide['focus'+axis]=clamp(e.target.value,0,100);
        syncControls();showPreview();
      });
    }
    $('tonyCarouselSlideRights').addEventListener('change',e=>{
      const {slide}=selectSlide();if(!slide || !getImage(slide.id))return;
      slide.imagePermission=RIGHTS.has(e.target.value)?e.target.value:'unknown';
      showPreview();
    });
    $('tonyCarouselSlideCredit').addEventListener('input',e=>{
      const {slide}=selectSlide();if(!slide || !getImage(slide.id))return;
      slide.imageCredit=e.target.value.slice(0,200);
    });
    syncControls();
  }
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded',mount);
  return {getImage,putImage,remove,clear,exportWarning,readImage,syncControls,mount};
});
