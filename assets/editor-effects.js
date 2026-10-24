/* TONY Studio color-grading presets and compact logo controls.
   Filters affect only the photograph; headline, yellow badges and other UI stay legible. */
(function () {
  'use strict';
  const FILTERS = Object.freeze({
    original: {label:'Original',contrast:1,saturate:1,brightness:1,sepia:0,hue:0,tint:null,alpha:0},
    gotham: {label:'Gotham Noir',contrast:1.24,saturate:0.62,brightness:0.86,sepia:0.05,hue:0,tint:'#111b2b',alpha:0.17},
    taxi: {label:'Taxi Gold',contrast:1.19,saturate:1.12,brightness:0.94,sepia:0.26,hue:-5,tint:'#ffc300',alpha:0.15},
    midnight: {label:'Midnight Subway',contrast:1.29,saturate:0.77,brightness:0.81,sepia:0,hue:8,tint:'#092a4f',alpha:0.21},
    hudson: {label:'Hudson Blue',contrast:1.16,saturate:0.78,brightness:0.91,sepia:0,hue:7,tint:'#1d5186',alpha:0.15},
    film: {label:'Five Borough Film',contrast:1.12,saturate:0.77,brightness:0.96,sepia:0.17,hue:-3,tint:'#957652',alpha:0.12}
  });
  const $ = id => document.getElementById(id);
  const clamp = (x,min,max) => Math.min(max,Math.max(min,Number.isFinite(Number(x))?Number(x):min));
  const blend = (a,b,t) => a+(b-a)*t;
  function getGrade(id,amount) {
    const p = FILTERS[id] || FILTERS.original;
    const t = clamp(amount,0,100)/100;
    return {
      filter: [
        'contrast('+blend(1,p.contrast,t).toFixed(3)+')',
        'saturate('+blend(1,p.saturate,t).toFixed(3)+')',
        'brightness('+blend(1,p.brightness,t).toFixed(3)+')',
        'sepia('+(p.sepia*t).toFixed(3)+')',
        'hue-rotate('+(p.hue*t).toFixed(1)+'deg)'
      ].join(' '),
      tint: p.tint,
      alpha: p.alpha*t
    };
  }
  function drawPhoto(ctx,image,x,y,w,h,gradeName,intensity) {
    const grade=getGrade(gradeName,intensity);
    ctx.save();
    ctx.filter=grade.filter;
    ctx.drawImage(image,x,y,w,h);
    ctx.restore();
    if(grade.tint && grade.alpha>0) {
      ctx.save();
      ctx.globalCompositeOperation='soft-light';
      ctx.globalAlpha=grade.alpha;
      ctx.fillStyle=grade.tint;
      ctx.fillRect(0,0,ctx.canvas.width,ctx.canvas.height);
      ctx.restore();
    }
  }
  function updateFilterControls() {
    const s=window.TONYStudio?.state;
    if(!s)return;
    for(const button of document.querySelectorAll('[data-tony-filter]')){
      const selected=button.dataset.tonyFilter===s.photoFilter;
      button.setAttribute('aria-pressed',String(selected));
      button.classList.toggle('tony-filter-active',selected);
    }
    const slider=$('tonyFilterStrength');
    const value=$('tonyFilterStrengthValue');
    if(slider)slider.value=String(s.filterIntensity);
    if(value)value.textContent=String(s.filterIntensity)+'%';
  }
  function updateLogoControls(){
    const s=window.TONYStudio?.state;
    if(!s)return;
    const mode=$('tonyLogoMode'),range=$('tonyLogoSize'),value=$('tonyLogoSizeValue'),sizeRow=$('tonyLogoSizeRow'),wordmark=$('tonyWordmarkFields');
    if(mode)mode.value=s.brandLogoMode||'logo';
    if(range)range.value=String(s.brandLogoSize||120);
    if(value)value.textContent=String(s.brandLogoSize||120)+' px';
    if(sizeRow)sizeRow.hidden=s.brandLogoMode!=='logo';
    if(wordmark)wordmark.hidden=s.brandLogoMode!=='wordmark';
  }
  function syncControls(){
    updateFilterControls();updateLogoControls();
  }
  function addFilterPanel(){
    const photoSection=$('dropZone')?.closest('div.bg-\\[\\#121216\\]');
    if(!photoSection || $('tonyFilterPanel'))return;
    const panel=document.createElement('div');
    panel.id='tonyFilterPanel';
    panel.className='tony-photo-effects mt-4 pt-4 border-t border-white/10';
    panel.innerHTML=
      '<div class="flex items-center justify-between gap-2 mb-2">'+
      '<div><h3 class="text-sm font-bold text-white">NYC Photo Filters</h3>'+
      '<p class="text-[11px] text-zinc-400 mt-1">Match your photo to the TONY black & yellow identity.</p></div>'+
      '<button id="tonyFilterReset" type="button" class="text-xs text-[#FFC300] hover:underline">Reset</button></div>'+
      '<div class="tony-filter-grid" role="group" aria-label="NYC photo color filters">'+
      Object.entries(FILTERS).map(([key,item])=>'<button type="button" class="tony-filter-choice" data-tony-filter="'+key+'" aria-pressed="false">'+item.label+'</button>').join('')+
      '</div><div class="mt-3">'+
      '<div class="flex items-center justify-between mb-1"><label for="tonyFilterStrength" class="text-xs font-semibold text-zinc-300">Filter Intensity</label>'+
      '<output id="tonyFilterStrengthValue" for="tonyFilterStrength" class="text-xs font-bold text-[#FFC300]">70%</output></div>'+
      '<input id="tonyFilterStrength" class="w-full accent-[#FFC300] cursor-pointer" type="range" min="0" max="100" step="5" value="70">'+
      '</div>';
    photoSection.appendChild(panel);
    for(const button of panel.querySelectorAll('[data-tony-filter]'))button.addEventListener('click',()=>{
      window.TONYStudio.state.photoFilter=button.dataset.tonyFilter;
      updateFilterControls();
      window.TONYStudio.renderCanvas();
    });
    $('tonyFilterStrength').addEventListener('input',e=>{
      window.TONYStudio.state.filterIntensity=clamp(e.target.value,0,100);
      updateFilterControls();
      window.TONYStudio.renderCanvas();
    });
    $('tonyFilterReset').addEventListener('click',()=>{
      window.TONYStudio.state.photoFilter='original';
      window.TONYStudio.state.filterIntensity=0;
      updateFilterControls();window.TONYStudio.renderCanvas();
    });
  }
  function addLogoPanel(){
    const brandSection=$('brandTitleInput')?.closest('div.bg-\\[\\#121216\\]');
    if(!brandSection || $('tonyLogoMode'))return;
    const field=$('brandTitleInput')?.closest('div.grid');
    if(field)field.id='tonyWordmarkFields';
    const div=document.createElement('div');
    div.className='tony-brand-switch mb-4 border-b border-white/10 pb-4';
    div.innerHTML='<div class="flex gap-3 items-center mb-3">'+
      '<img src="/assets/tony-logo.svg" alt="TONY circular logo" class="w-12 h-12 rounded-full bg-black border border-white/10">'+
      '<div><h3 class="text-sm font-bold text-white">Post Branding</h3>'+
      '<p class="text-[11px] text-zinc-400">Small circular logo in the top-left corner.</p></div></div>'+
      '<label for="tonyLogoMode" class="block text-xs font-semibold text-zinc-300 mb-1">Brand Style</label>'+
      '<select id="tonyLogoMode" class="w-full text-white bg-zinc-900 border border-white/15 rounded-lg px-3 py-2.5 text-sm">'+
      '<option value="logo">TONY Round Logo (recommended)</option><option value="wordmark">Classic Text Wordmark</option><option value="none">No Logo</option></select>'+
      '<div id="tonyLogoSizeRow" class="mt-3">'+
      '<div class="flex justify-between mb-1"><label for="tonyLogoSize" class="text-xs text-zinc-300">Logo Size</label>'+
      '<output for="tonyLogoSize" id="tonyLogoSizeValue" class="text-xs text-[#FFC300]">120 px</output></div>'+
      '<input id="tonyLogoSize" type="range" min="80" max="160" step="4" value="120" class="w-full accent-[#FFC300] cursor-pointer">'+
      '</div>';
    if(field)brandSection.insertBefore(div,field);else brandSection.prepend(div);
    $('tonyLogoMode').addEventListener('change',e=>{
      window.TONYStudio.state.brandLogoMode=e.target.value;
      updateLogoControls();window.TONYStudio.renderCanvas();
    });
    $('tonyLogoSize').addEventListener('input',e=>{
      window.TONYStudio.state.brandLogoSize=clamp(e.target.value,80,160);
      updateLogoControls();window.TONYStudio.renderCanvas();
    });
  }
  function init(){
    if(!window.TONYStudio)return;
    const s=window.TONYStudio.state;
    if(!FILTERS[s.photoFilter])s.photoFilter='gotham';
    s.filterIntensity=clamp(s.filterIntensity??70,0,100);
    if(!['logo','wordmark','none'].includes(s.brandLogoMode))s.brandLogoMode='logo';
    s.brandLogoSize=clamp(s.brandLogoSize??120,80,160);
    addFilterPanel();addLogoPanel();syncControls();window.TONYStudio.renderCanvas();
  }
  window.TONYEffects={FILTERS,getGrade,drawPhoto,syncControls};
  document.addEventListener('DOMContentLoaded',init);
})();