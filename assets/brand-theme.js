/* TONY brand themes: primary Taxi Gold and secondary Gotham Red.
   The secondary treatment is intentionally restrained: red framing, ivory type, and charcoal atmosphere. */
(function(root){
 'use strict';
 const THEMES=Object.freeze({
  gold:{label:'TONY Gold',accent:'#FFC300',paper:'#F3F4F6',background:'#0B0B0B',description:'Primary identity · everyday NYC coverage'},
  gotham:{label:'TONY Gotham',accent:'#EF1B2D',paper:'#F2EFEA',background:'#080809',description:'Secondary identity · breaking, investigations and public affairs'}
 });
 const $=id=>document.getElementById(id);
 function paint(ctx,state,width,height){
  if(state.brandTheme!=='gotham')return;
  const accent=THEMES.gotham.accent;
  ctx.save();
  // Fine red perimeter echoes the circular frame in the TONY Gotham logo.
  ctx.strokeStyle=accent;ctx.lineWidth=9;ctx.globalAlpha=.96;
  ctx.strokeRect(18,18,width-36,height-36);
  // A restrained newsroom masthead and red signal rule.
  ctx.globalAlpha=.94;ctx.fillStyle=accent;
  ctx.fillRect(64,198,92,7);
  ctx.fillRect(width-104,198,40,7);
  ctx.fillStyle=THEMES.gotham.paper;
  ctx.font='800 17px Inter, sans-serif';ctx.textAlign='right';ctx.textBaseline='middle';
  if('letterSpacing' in ctx)ctx.letterSpacing='3px';
  ctx.fillText('THE ONLY NEW YORK',width-66,174);
  if('letterSpacing' in ctx)ctx.letterSpacing='0px';
  // Bottom signal line sits above the location/date strip.
  ctx.globalAlpha=.92;ctx.fillStyle=accent;
  ctx.fillRect(64,height-112,Math.min(250,width*.24),5);
  // Small live-news marker; no extra badge text competes with the headline.
  ctx.beginPath();ctx.arc(width-76, height-112, 7, 0, Math.PI*2);ctx.fill();
  ctx.restore();
 }
 function sync(){
  const state=root.TONYStudio?.state;if(!state)return;
  if(!THEMES[state.brandTheme])state.brandTheme='gold';
  document.querySelectorAll('[data-tony-brand-theme]').forEach(button=>{
   const selected=button.dataset.tonyBrandTheme===state.brandTheme;
   button.setAttribute('aria-pressed',String(selected));
   button.classList.toggle('tony-theme-selected',selected);
  });
 }
 function mount(){
  const app=root.TONYStudio;if(!app||$('tonyBrandThemePanel'))return;
  const host=$('tonyCreativePanel')?.parentElement||$('dropZone')?.parentElement;
  if(!host)return;
  const panel=document.createElement('section');
  panel.id='tonyBrandThemePanel';panel.className='tony-brand-theme mt-4 border-t border-white/10 pt-4';
  panel.innerHTML=
   '<div class="flex items-start justify-between gap-3 mb-3"><div><h3 class="text-sm font-bold text-white">TONY Brand Theme</h3><p class="text-[11px] text-zinc-400 mt-1">Choose the visual identity for this story.</p></div><span class="tony-theme-live">LIVE IDENTITY</span></div>'+
   '<div class="grid grid-cols-2 gap-2" role="group" aria-label="TONY brand theme">'+
   '<button type="button" data-tony-brand-theme="gold" aria-pressed="false" class="tony-theme-option"><span class="tony-theme-swatches"><i style="background:#0B0B0B"></i><i style="background:#FFC300"></i><i style="background:#F3F4F6"></i></span><strong>TONY Gold</strong><small>Primary · City desk</small></button>'+
   '<button type="button" data-tony-brand-theme="gotham" aria-pressed="false" class="tony-theme-option"><span class="tony-theme-swatches"><i style="background:#080809"></i><i style="background:#EF1B2D"></i><i style="background:#F2EFEA"></i></span><strong>TONY Gotham</strong><small>Secondary · Signal red</small></button>'+
   '</div><p class="tony-theme-description" id="tonyBrandThemeDescription"></p>';
  host.append(panel);
  panel.querySelectorAll('[data-tony-brand-theme]').forEach(button=>button.addEventListener('click',()=>{
   app.state.brandTheme=button.dataset.tonyBrandTheme;
   sync();app.renderCanvas();
  }));
  sync();
  const description=$('tonyBrandThemeDescription');
  if(description)description.textContent=THEMES[app.state.brandTheme||'gold'].description;
 }
 function init(){if(!root.TONYStudio)return;mount();sync();}
 root.TONYBrandTheme={THEMES,paint,sync,mount};
 if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',init);
})(typeof window!=='undefined'?window:null);
