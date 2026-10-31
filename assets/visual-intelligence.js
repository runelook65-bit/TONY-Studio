/* TONY Visual Intelligence: reviewed archive photos and clearly marked AI illustrations. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const S=()=>window.TONYStudio.state;
let items=[],activeRequest=false,settings=null;
let sourcePreviewRequest=0;

function info(msg,err=false){
 const el=$('tonyVisualMessage'); if(!el)return;
 el.textContent=msg;el.style.color=err?'#FCA5A5':'#a1a1aa';
}
function safeUrl(url){
 try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}
}
async function json(path,options){
 const r=await fetch(path,{credentials:'same-origin',...options});
 let result;try{result=await r.json();}catch{throw Error('Server returned an invalid response.');}
 if(!r.ok)throw Error(result.error||'Visual request failed.');
 return result;
}
async function refreshConfig(){
 try{
  settings=await json('/api/visual/access');
  $('tonyVisualAdmin').hidden=!settings.gemini||settings.canGenerate||!settings.adminConfigured;
  $('tonyVisualUnavailable').hidden=Boolean(settings.gemini);
  $('tonyGenerateButton').disabled=!settings.canGenerate;
  $('tonyVisualPexels').disabled=!settings.pexels;
  if(!settings.pexels)$('tonyVisualPexels').title='Add PEXELS_API_KEY in Vercel to enable stock photos.';
  $('tonyVisualConnection').textContent=settings.canGenerate?'Gemini connected · Editorial illustration mode':
    settings.gemini ? (settings.adminConfigured?'Unlock Gemini illustration generation below.':'Set TONY_VISUAL_PASSWORD in Vercel to enable AI image generation.'):
    'Gemini not configured. Wikimedia Commons photo search is available.';
 }catch(e){info(e.message,true)}
}
function photoSearchQuery(){
 const s=S();
 const t=(s.headline||'').replace(/[\[\]!"'“”‘’]/g,' ').replace(/\s+/g,' ').trim();
 const generic=/^(Your New York story|Example NYC|Untitled)/i.test(t);
 const stop=new Set(['city','council','officials','says','about','with','from','after','over','against','will','that','news','the','and','for','are','new','york','nyc','manhattan','brooklyn','queens','bronx','staten','island']);
 const words=t.toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>3&&!stop.has(x)).slice(0,3);
 return ((s.region&&s.region!=='NEW YORK CITY'?s.region:'New York City')+' '+(generic?'city skyline':words.join(' ')||'city')).trim();
}
function setBusy(b){
 activeRequest=b;
 for(const id of ['tonyVisualSearchButton','tonyGenerateButton','tonyVisualUnlock'])if($(id))$(id).disabled=b||(id==='tonyGenerateButton'&&!settings?.canGenerate);
}
function makeResult(item){
 const card=document.createElement('article');
 card.className='tony-visual-result rounded-xl border border-white/10 bg-zinc-900 overflow-hidden';
 const picture=document.createElement('img');
 picture.alt=item.title||'Editorial stock or archive photo';
 picture.loading='lazy';picture.referrerPolicy='no-referrer';
 const img=safeUrl(item.imageUrl);if(img)picture.src=img;
 picture.className='w-full h-32 object-cover bg-zinc-800';
 const body=document.createElement('div');body.className='p-2 space-y-1.5';
 const title=document.createElement('p');title.className='text-[11px] font-bold text-white leading-snug';
 title.textContent=(item.title||'Photo').slice(0,110);
 const rights=document.createElement('p');rights.className='text-[10px] text-zinc-400 leading-snug';
 rights.textContent=item.license+' · '+item.photographer;
 const link=document.createElement('a');link.className='text-[11px] text-[#FFC300] underline inline-block';
 link.textContent='View license & source ↗';link.target='_blank';link.rel='noopener noreferrer';link.href=safeUrl(item.sourceUrl)||'#';
 const use=document.createElement('button');use.className='w-full rounded-lg bg-[#FFC300] text-black py-2 text-[11px] font-black';
 use.type='button';use.textContent='Use this photo';
 use.addEventListener('click',()=>usePhoto(item,use));
 body.append(title,rights,link,use);card.append(picture,body);return card;
}
async function search(){
 if(activeRequest)return;
 const q=$('tonyVisualQuery').value.trim(),provider=$('tonyVisualProvider').value;
 if(q.length<3){info('Enter a subject or location to find photos.',true);return;}
 setBusy(true);info('Searching '+(provider==='commons'?'Wikimedia Commons':'Pexels')+' for illustrative photos...');
 $('tonyVisualResults').replaceChildren();
 try{
  const data=await json('/api/visual/search?'+new URLSearchParams({q,source:provider}));
  items=data.items||[];
  for(const item of items)$('tonyVisualResults').append(makeResult(item));
  if(provider==='pexels')$('tonyVisualAttribution').hidden=false;
  else $('tonyVisualAttribution').hidden=true;
  info(items.length?items.length+' photos found. Check the source, license, date and relevance before using.':
     'No suitable licensed photos found. Try a broader borough or subject name.',!items.length);
  return items.length;
 }catch(e){info(e.message,true);return 0;}
 finally{setBusy(false)}
}
function editorialImage({kind,credit}){
 const s=S();s.photoKind=kind;
 s.photoSourceCredit=credit||'';
 const creditInput=$('tonyImageCredit'),rights=$('tonyImagePermission'),status=$('tonyPublicationStatus');
 if(creditInput){creditInput.value=credit||'';creditInput.dispatchEvent(new Event('input',{bubbles:true}));}
 if(rights){rights.value=kind==='ai'?'ai-generated':'unknown';rights.dispatchEvent(new Event('change',{bubbles:true}));}
 if(status){status.value='review';status.dispatchEvent(new Event('change',{bubbles:true}));}
}
function applyDataImage(dataUrl,meta){
 return new Promise((resolve,reject)=>{
  if(!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl||''))return reject(Error('Invalid photo data.'));
  const image=new Image();
  image.onload=()=>{
   const app=window.TONYStudio;
   app.state.activeImage=image;app.state.panX=0;app.state.panY=0;app.state.zoom=100;
   app.state.focusX=50;app.state.focusY=50;window.TONYCreative?.syncControls();
   const zoom=$('zoomRange');if(zoom){zoom.value='100';zoom.dispatchEvent(new Event('input'))}
   editorialImage(meta);app.renderCanvas();
   const tab=window.TONYMobile?.switchView;
   if(tab)tab('design',{scroll:false});
   app.showToast(meta.kind==='ai'?'AI illustration applied with disclosure':'Source photo applied · review license');
   resolve();
  };
  image.onerror=()=>reject(Error('Could not decode the selected photo.'));
  image.src=dataUrl;
 });
}
async function usePhoto(photo,button){
 if(activeRequest)return;
 setBusy(true);button.textContent='Importing…';info('Preparing the photo and license credit...');
 try{
  const data=await json('/api/visual/import',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({importToken:photo.importToken})});
  await applyDataImage(data.dataUrl,{kind:data.photoKind||'archive',credit:data.credit||''});
  S().photoSourceUrl=data.sourceUrl||'';S().photoLicense=data.license||'';
  info('Photo applied. This is archive/stock imagery, not proof of the reported event. Verify rights before publishing.');
 }catch(e){info(e.message,true)}
 finally{button.textContent='Use this photo';setBusy(false)}
}
async function unlock(){
 const password=$('tonyVisualPassword').value;
 if(!password)return info('Enter your Visual Studio password.',true);
 setBusy(true);
 try{
  await json('/api/visual/access',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});
  $('tonyVisualPassword').value='';
  await refreshConfig();info('AI illustration generation is unlocked.');
 }catch(e){info(e.message,true)}
 finally{setBusy(false)}
}
async function generate(){
 if(activeRequest||!settings?.canGenerate)return;
 const s=S();
 if(!s.headline||/Your New York story starts here/i.test(s.headline))
  return info('Enter a specific story headline before creating an illustration.',true);
 if(!s.summary)return info('Add the story summary first.',true);
 if(!confirm('Generate an AI illustration with Gemini? It is not a documentary photograph. API usage may be billed.'))return;
 setBusy(true);info('Generating a clearly illustrative visual. This may take a while...');
 try{
  const data=await json('/api/visual/generate',{method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({headline:s.headline,summary:s.summary,borough:s.region,category:s.badgeText})});
  await applyDataImage(data.dataUrl,{kind:'ai',credit:data.credit});
  S().photoSourceUrl='';S().photoLicense='AI-generated';
  info('AI illustration applied. Visible AI ILLUSTRATION label is included in PNG and Instagram images.');
 }catch(e){info(e.message,true)}
 finally{setBusy(false)}
}

/* Article-first visual matching. These are safe *subject* suggestions, never purported event photography. */
function visualQueries(story){
 const borough=['MANHATTAN','BROOKLYN','QUEENS','BRONX','STATEN ISLAND'].includes(story?.borough)
  ? story.borough : 'New York City';
 const combined=(String(story?.headline||'')+' '+String(story?.summary||'')).slice(0,550);
 const category=String(story?.category||'NYC NEWS').toUpperCase();
 const landmarks=[
  [/\bhunts point\b/i,'Hunts Point Bronx'],[/\btimes square\b/i,'Times Square'],
  [/\bcentral park\b/i,'Central Park'],[/\bcity hall\b/i,'New York City Hall'],
  [/\bbrooklyn bridge\b/i,'Brooklyn Bridge'],[/\bconey island\b/i,'Coney Island'],
  [/\bflushing\b/i,'Flushing Queens'],[/\bastoria\b/i,'Astoria Queens'],
  [/\bjfk\b|john f kennedy airport/i,'JFK Airport'],[/\blaguardia\b/i,'LaGuardia Airport'],
  [/\bstaten island ferry\b/i,'Staten Island Ferry']
 ];
 const subject=[
  [/\be-bike\b|\blithium\b|\bbattery\b/i,'electric bicycle'],
  [/\bsubway\b|\btrain\b|\bmta\b/i,'subway train station'],
  [/\bbus\b|\btraffic\b/i,'city bus traffic'],
  [/\bapartment\b|\brent\b|\btenant\b|\bhousing\b/i,'apartment buildings'],
  [/\bschool\b|\beducation\b/i,'public school building'],
  [/\brestaurant\b|\bfood\b/i,'restaurant streetscape'],
  [/\bflood\b|\brain\b/i,'rainy streetscape'],
  [/\bsnow\b|\bstorm\b/i,'city winter skyline'],
  [/\bmayor\b|\bcouncil\b|\belection\b/i,'city hall exterior']
 ];
 const generic={
  TRANSIT:'subway station',WEATHER:'city skyline weather',HOUSING:'apartment buildings',
  POLITICS:'city hall exterior','PUBLIC SAFETY':'city streetscape',BUSINESS:'financial district buildings',
  'CITY LIFE':'neighborhood street photography','NYC NEWS':'New York City skyline'
 };
 const landmark=landmarks.find(([re])=>re.test(combined))?.[1];
 const topic=subject.find(([re])=>re.test(combined))?.[1]||generic[category]||generic['NYC NEWS'];
 const first=landmark ? landmark+' '+topic : borough+' '+topic;
 const fallback='New York City '+(generic[category]||generic['NYC NEWS']);
 return [...new Set([first,fallback])].map(q=>q.slice(0,110));
}
function showSourceReference(story){
 const container=$('tonyVisualSourceReference');
 if(!container)return Promise.resolve();
 const sourceUrl=safeUrl(story?.source_url);
 const current=++sourcePreviewRequest;
 container.replaceChildren();
 if(!sourceUrl)return Promise.resolve();
 const title=document.createElement('p');
 title.textContent='Checking the original article for a photo reference…';
 title.className='text-xs text-zinc-400';
 container.append(title);
 return fetch('/api/article?url='+encodeURIComponent(sourceUrl),{headers:{accept:'application/json'}})
  .then(async r=>{if(!r.ok)throw Error('Article preview unavailable');return r.json()})
  .then(article=>{
   if(current!==sourcePreviewRequest)return;
   container.replaceChildren();
   if(article.sourceUrl!==sourceUrl||!safeUrl(article.imageUrl)){
    title.textContent='No source photo preview available. Check the original article below.';
    container.append(title);return;
   }
   const label=document.createElement('p');
   label.className='text-[11px] font-black tracking-wide text-amber-300';
   label.textContent='SOURCE PHOTO · REFERENCE ONLY';
   const row=document.createElement('div');row.className='flex items-center gap-3 mt-2';
   const img=document.createElement('img');img.src=article.imageUrl;img.alt='Preview supplied by original publisher; reuse rights not established';
   img.loading='lazy';img.referrerPolicy='no-referrer';img.className='w-24 h-20 rounded-lg object-cover bg-zinc-900';
   const box=document.createElement('div');box.className='flex-1 min-w-0';
   const desc=document.createElement('p');desc.className='text-[11px] text-zinc-400';
   desc.textContent='This is the publisher’s reference image. Do not copy it into a TONY post without a separate license or explicit permission.';
   const link=document.createElement('a');link.href=sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
   link.className='inline-block mt-1 text-[#FFC300] text-xs underline';link.textContent='Review original article ↗';
   box.append(desc,link);row.append(img,box);container.append(label,row);
  }).catch(()=>{
   if(current!==sourcePreviewRequest)return;
   container.replaceChildren();
   title.textContent='Publisher photo preview unavailable. Open the article to review visual context.';
   const link=document.createElement('a');link.href=sourceUrl;link.target='_blank';link.rel='noopener noreferrer';
   link.className='block mt-1 text-[#FFC300] text-xs underline';link.textContent='Read original article ↗';
   container.append(title,link);
  });
}
async function suggestForStory(story){
 if(!$('tonyVisualPanel')||!story||typeof story!=='object')return 0;
 const suggestions=visualQueries(story);
 $('tonyVisualProvider').value='commons';
 $('tonyVisualQuery').value=suggestions[0];
 const preview=showSourceReference(story);
 info('Finding reuse-eligible archive imagery related to the article topic. Selection still requires editorial review.');
 let count=await search();
 if(!count&&suggestions[1]&&suggestions[1]!==suggestions[0]){
  $('tonyVisualQuery').value=suggestions[1];
  count=await search();
 }
 await preview;
 if(!count)info('No matching Commons photos. Try Pexels (if configured), upload your own licensed photo, or create a labeled AI illustration.',true);
 return count;
}

function mount(){
 const section=$('dropZone')?.parentElement;
 if(!section||$('tonyVisualPanel')||!window.TONYStudio)return;
 const panel=document.createElement('section');
 panel.id='tonyVisualPanel';
 panel.className='tony-visual-panel mt-4 pt-4 border-t border-white/10';
 panel.innerHTML=
 '<div class="flex items-start justify-between gap-2 mb-3"><div>'+
 '<p class="text-[10px] font-black tracking-widest text-[#FFC300]">TONY VISUAL INTELLIGENCE</p>'+
 '<h3 class="text-sm font-black text-white mt-1">Find or Create the Visual</h3>'+
 '<p class="text-xs text-zinc-400 mt-1">Use licensed photos or AI artwork. The original article is the factual source.</p>'+
 '</div><span class="text-xl" aria-hidden="true">✦</span></div>'+
 '<label for="tonyVisualQuery" class="text-xs text-zinc-300 font-semibold">Photo search</label>'+
 '<div class="flex gap-2 mt-1"><input id="tonyVisualQuery" class="min-w-0 flex-1 bg-zinc-900 text-white border border-white/15 rounded-xl px-3 py-2.5 text-sm" placeholder="e.g. Hunts Point Produce Market Bronx" />'+
 '<button id="tonyVisualSearchButton" type="button" class="bg-[#FFC300] text-black px-3 rounded-xl text-xs font-black">Find Photos</button></div>'+
 '<div class="flex flex-wrap gap-2 mt-2 items-center">'+
 '<label for="tonyVisualProvider" class="text-xs text-zinc-400">Photo library</label>'+
 '<select id="tonyVisualProvider" class="bg-zinc-900 text-white border border-white/15 rounded-lg p-2 text-xs">'+
 '<option value="commons">Wikimedia Commons</option><option id="tonyVisualPexels" value="pexels">Pexels (stock)</option></select>'+
 '<button id="tonyVisualPrefill" type="button" class="text-xs text-[#FFC300] font-semibold">Use story keywords</button></div>'+
 '<div id="tonyVisualSourceReference" class="mt-3 rounded-xl border border-amber-300/20 bg-zinc-900/60 p-3" role="note"></div>'+ 
 '<div id="tonyVisualResults" class="tony-visual-results mt-3" aria-label="Photo search results"></div>'+
 '<p id="tonyVisualAttribution" hidden class="text-[11px] text-zinc-400 mt-2">Photos provided by <a class="underline text-[#FFC300]" href="https://www.pexels.com/" target="_blank" rel="noopener noreferrer">Pexels</a>.</p>'+
 '<p class="text-[11px] text-amber-300 mt-3">Editorial check: stock/archive imagery is not necessarily from this event. Confirm accuracy and image rights before publication.</p>'+
 '<div class="border-t border-white/10 pt-3 mt-4">'+
 '<div class="flex gap-2 items-center justify-between"><div><h4 class="text-sm font-bold text-white">Gemini · AI Illustration</h4>'+
 '<p id="tonyVisualConnection" class="text-[11px] text-zinc-400 mt-1">Checking configuration…</p></div>'+
 '<span class="text-xs rounded-md px-2 py-1 bg-zinc-800 text-white">AI ART</span></div>'+
 '<p class="text-xs text-zinc-400 mt-2">Conceptual artwork only. Never a fabricated picture of a real breaking-news event.</p>'+
 '<div id="tonyVisualAdmin" hidden class="mt-3 flex flex-wrap gap-2"><input id="tonyVisualPassword" type="password" autocomplete="current-password" class="flex-1 min-w-0 rounded-lg bg-zinc-900 text-white border border-white/15 p-2.5 text-sm" placeholder="AI Studio password" />'+
 '<button id="tonyVisualUnlock" type="button" class="px-3 rounded-lg bg-zinc-700 text-white text-xs font-bold">Unlock</button></div>'+
 '<p id="tonyVisualUnavailable" hidden class="text-[11px] text-amber-300 mt-2">Add GEMINI_API_KEY in Vercel to enable AI art.</p>'+
 '<button id="tonyGenerateButton" disabled type="button" class="mt-3 w-full px-3 py-3 bg-[#FFC300] text-black text-xs rounded-xl font-black disabled:opacity-40">✦ Generate AI Illustration</button></div>'+
 '<p id="tonyVisualMessage" role="status" aria-live="polite" class="text-[11px] text-zinc-400 mt-3"></p>';
 section.appendChild(panel);
 $('tonyVisualSearchButton').addEventListener('click',search);
 $('tonyVisualPrefill').addEventListener('click',()=>{$('tonyVisualQuery').value=photoSearchQuery();info('Story keywords added; you can refine them before searching.');});
 $('tonyVisualQuery').addEventListener('keydown',e=>{if(e.key==='Enter')search();});
 $('tonyVisualUnlock').addEventListener('click',unlock);
 $('tonyVisualPassword').addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});
 $('tonyGenerateButton').addEventListener('click',generate);
 $('tonyVisualQuery').value=photoSearchQuery();
 refreshConfig();
}
window.TONYVisual={mount,applyDataImage,photoSearchQuery,visualQueries,suggestForStory};
document.addEventListener('DOMContentLoaded',mount);
})();