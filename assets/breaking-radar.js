/* TONY Breaking News Radar: ranked source-attributed tips, not automatic publication. */
(function(){
 'use strict';
 const ENDPOINT='https://cdyffufhgqsggkieyakk.supabase.co/functions/v1/tony-news-radar';
 const COLORS={TRANSIT:'#2563EB',WEATHER:'#0EA5E9',HOUSING:'#8B5CF6',POLITICS:'#16A34A','PUBLIC SAFETY':'#E11D2E',BUSINESS:'#F59E0B','CITY LIFE':'#FFC300'};
 const $=id=>document.getElementById(id);
 let stories=[],loading=false,latest=null;
 const ago=date=>{
  const minutes=Math.max(0,Math.floor((Date.now()-new Date(date).getTime())/60000));
  return minutes<1?'just now':minutes<60?minutes+'m ago':minutes<1440?Math.floor(minutes/60)+'h ago':Math.floor(minutes/1440)+'d ago';
 };
 function setStatus(msg,isError=false){
  const el=$('tonyRadarStatus');
  if(!el)return;
  el.textContent=msg;
  el.className='text-[11px] '+(isError?'text-red-300':'text-zinc-400');
 }
 function clear(el){if(el)el.replaceChildren();}
 function tag(text,className){
  const e=document.createElement('span');e.className=className;e.textContent=text;return e;
 }
 function show(){
  const target=$('tonyRadarStories');
  if(!target)return;
  clear(target);
  const borough=$('tonyRadarBorough').value,onlyHigh=$('tonyRadarHigh').checked;
  const selected=stories.filter(s=>(borough==='ALL'||s.borough===borough||s.borough==='NEW YORK CITY')&&(!onlyHigh||s.priority==='high'||s.priority==='breaking')).slice(0,16);
  $('tonyRadarCount').textContent=stories.length+' NEW TIPS';
  if(!selected.length){target.append(tag('No matching fresh articles. Try another borough or switch off high-priority mode.','block text-sm text-zinc-400 py-4'));return;}
  selected.forEach((story,index)=>{
   const box=document.createElement('article');
   box.className='tony-radar-story';
   const top=document.createElement('div');top.className='flex justify-between items-center gap-2';
   const left=document.createElement('div');left.className='flex gap-1.5 flex-wrap items-center';
   const priority=story.priority==='breaking'?'BREAKING CANDIDATE':story.priority==='high'?'HIGH PRIORITY':'NYC UPDATE';
   left.append(tag(priority,'tony-radar-priority '+(story.priority==='breaking'?'tony-radar-red':story.priority==='high'?'tony-radar-yellow':'')));
   left.append(tag(story.borough,'tony-radar-borough'));
   top.append(left,tag(ago(story.source_published_at),'text-[10px] text-zinc-500 whitespace-nowrap'));
   const headline=document.createElement('h3');headline.className='text-sm text-white font-extrabold mt-2 leading-snug';headline.textContent=story.headline;
   const summary=document.createElement('p');summary.className='text-xs text-zinc-400 mt-1 line-clamp-2';summary.textContent=story.summary||'Read the original source for details.';
   const details=document.createElement('div');details.className='mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-zinc-400';
   details.append(tag(story.source_name+' · '+story.category,''));
   details.append(tag('Priority '+story.score+'/100',''));
   if(story.source_count>1)details.append(tag(story.source_count+' sources','text-[#FFC300]'));
   if(story.is_sensitive)details.append(tag('Sensitive · extra verification','text-amber-300'));
   const buttons=document.createElement('div');buttons.className='mt-3 flex gap-2';
   const prepare=document.createElement('button');
   prepare.type='button';prepare.className='tony-radar-prepare';
   prepare.textContent='Prepare Post + Find Images';
   prepare.addEventListener('click',()=>apply(story));
   const source=document.createElement('a');source.className='tony-radar-source';
   source.href=story.source_url;source.target='_blank';source.rel='noopener noreferrer';
   source.textContent='Read Source ↗';
   buttons.append(prepare,source);box.append(top,headline,summary,details,buttons);target.append(box);
  });
 }
 async function apply(story){
  const app=window.TONYStudio;
  const newsroom=window.TONYNewsroom;
  if(!app||!newsroom)return setStatus('Studio editor is not ready.',true);
  const t=newsroom.nyTime(story.source_published_at);
  app.applyPreset({badgeText:story.category||'NYC NEWS',badgeColor:COLORS[story.category]||'#FFC300',
   headline:story.headline,summary:story.summary||'Details are being verified. See original source.',
   region:story.borough||'NEW YORK CITY',dateLang:'EN'});
  app.state.dateValue=t.date;app.state.timeValue=t.time;
  app.dateInput.value=t.date;app.timeInput.value=t.time;
  app.state.sourceName=story.source_name;
  app.state.sourcePublishedAt=story.source_published_at;
  app.state.activeImage=null;app.state.photoKind='manual';
  app.state.photoSourceUrl='';app.state.photoSourceCredit='';app.state.photoLicense='';
  app.state.panX=0;app.state.panY=0;app.state.zoom=100;
  newsroom.setEditorial({sourceUrl:story.source_url,verificationStatus:'needs-review',
   imagePermission:'unknown',imageCredit:'',publicationStatus:'review'});
  const articleInput=$('tonyArticleUrl');if(articleInput)articleInput.value=story.source_url;
  app.renderCanvas();
  const draft=$('tonyDraftMessage');if(draft)draft.textContent='Imported from '+story.source_name+'. Independent verification and licensed imagery are REQUIRED.';
  app.showToast('News tip loaded · verify before publishing');
  if(window.TONYMobile?.switchView)window.TONYMobile.switchView('design');
  if(window.TONYVisual?.suggestForStory){
   setStatus('Draft created. Finding suitable licensed imagery; review each suggestion before posting.');
   try {
    const count=await window.TONYVisual.suggestForStory(story);
    setStatus(count+' reuse-eligible photo suggestions prepared. Photo rights and story facts still require review.');
   }catch(err){
    setStatus('Draft prepared; image recommendations unavailable. Use Upload Photo or Gemini illustration.',true);
   }
  } else {
   setStatus('Draft prepared. Open the Design step to add an authorized photo.');
  }
 }
 async function refresh(){
  if(loading)return;loading=true;
  $('tonyRadarRefresh').disabled=true;
  setStatus('Checking NYC sources…');
  try{
   const res=await fetch(ENDPOINT,{headers:{accept:'application/json'},cache:'no-store'});
   if(!res.ok)throw Error('Radar temporarily unavailable ('+res.status+').');
   const data=await res.json();
   stories=Array.isArray(data.stories)?data.stories.filter(s=>s&&typeof s.headline==='string'&&typeof s.source_url==='string'&&/^https:\/\//.test(s.source_url)):[];
   latest=data.updatedAt||new Date().toISOString();
   show();
   setStatus('Checked '+new Date(latest).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET · Updated by server every 10 min · Editor approval required');
  }catch(err){setStatus(err.message||'Could not load the newsroom feed.',true);}
  finally{loading=false;$('tonyRadarRefresh').disabled=false;}
 }
 function mount(){
  const article=$('tonyArticlePanel');if(!article||$('tonyRadarPanel'))return;
  const panel=document.createElement('div');
  panel.id='tonyRadarPanel';
  panel.className='tony-mobile-panel tony-radar-panel bg-[#121216] border border-white/15 rounded-2xl p-4 sm:p-5 shadow-lg';
  panel.dataset.tonyMobilePanel='story';panel.style.setProperty('--tony-mobile-order','0');
  panel.innerHTML=
   '<div class="flex justify-between gap-3 items-center"><div>'+
   '<div class="flex gap-2 items-center"><span class="tony-radar-live-dot"></span><h2 class="font-black text-white tracking-wide text-sm uppercase">Breaking News Radar</h2></div>'+
   '<p class="mt-1 text-[11px] text-zinc-400">NYC stories ranked by timeliness, relevance & source coverage.</p></div>'+
   '<button type="button" id="tonyRadarRefresh" class="tony-radar-refresh">↻ Refresh</button></div>'+
   '<div class="mt-3 flex flex-wrap gap-2 items-center justify-between">'+
   '<span id="tonyRadarCount" class="text-[10px] text-[#FFC300] font-black">LOADING</span>'+
   '<div class="flex gap-2 flex-wrap items-center"><label class="text-[11px] text-zinc-400" for="tonyRadarBorough">Borough</label>'+
   '<select id="tonyRadarBorough" class="rounded-lg bg-zinc-900 border border-white/15 text-xs text-white px-2 py-1.5">'+
   '<option value="ALL">All NYC</option><option>MANHATTAN</option><option>BROOKLYN</option>'+
   '<option>QUEENS</option><option>BRONX</option><option>STATEN ISLAND</option></select></div></div>'+
   '<label class="flex items-center gap-2 my-2 text-xs text-zinc-300"><input id="tonyRadarHigh" type="checkbox" class="accent-yellow-400" /> Show high-priority only</label>'+
   '<div id="tonyRadarStories" class="tony-radar-stories" aria-label="Recent NYC news tips"></div>'+
   '<p id="tonyRadarStatus" role="status" aria-live="polite" class="mt-3 text-[11px] text-zinc-400">Loading radar…</p>'+
   '<p class="mt-2 text-[10px] text-zinc-500">Rankings indicate editorial urgency, NOT factual certainty. Source links open original articles. No automatic Instagram publishing.</p>';
  article.before(panel);
  $('tonyRadarRefresh').addEventListener('click',refresh);
  $('tonyRadarBorough').addEventListener('change',show);
  $('tonyRadarHigh').addEventListener('change',show);
  refresh();
  setInterval(()=>{if(document.visibilityState==='visible')refresh();},90_000);
 }
 document.addEventListener('DOMContentLoaded',mount);
 window.TONYRadar={refresh,apply};
})();