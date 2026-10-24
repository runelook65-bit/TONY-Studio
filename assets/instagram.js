/* Instagram direct publishing for TONY Studio — requires site-owner Meta setup. */
(function(){
 'use strict';
 let connected=false, configured=false,unlocked=false,publishing=false;
 const $=id=>document.getElementById(id);
 function message(text,type='info'){
  const el=$('tonyIgMessage');
  if(!el)return;
  el.textContent=text;
  el.className='mt-2 text-xs '+(type==='error'?'text-red-300':type==='success'?'text-green-300':'text-zinc-400');
 }
 function makeCaption(){
  const s=window.TONYStudio.state;
  const parts=[
   (s.photoKind === 'ai' ? 'AI-generated illustration · ' : '') + (s.badgeText && s.badgeText.toUpperCase()==='BREAKING'?'🚨 ':'')+s.headline.trim(),
   s.summary.trim(),
   '📍 '+(s.region||'NEW YORK CITY')
  ];
  if(s.sourceUrl)parts.push('Source: '+s.sourceUrl);
  if(s.imageCredit)parts.push((s.photoKind === 'ai' ? 'Art: ' : 'Photo: ') + s.imageCredit);
  if(s.photoSourceUrl)parts.push('Image source: '+s.photoSourceUrl);
  return parts.filter(Boolean).join('\n\n').slice(0,2200);
 }
 function mount(){
  const section=document.querySelector('main > section');
  if(!section||$('tonyIgPanel')||!window.TONYStudio)return;
  const wrap=document.createElement('section');
  wrap.id='tonyIgPanel';
  wrap.className='bg-[#121216] border border-white/15 rounded-2xl p-4 sm:p-5 shadow-lg';
  wrap.innerHTML=
   '<div class="flex gap-3 items-center mb-2"><span class="rounded-lg bg-gradient-to-tr from-fuchsia-700 via-red-500 to-yellow-400 text-white font-black px-3 py-2 text-sm">IG</span>'+
   '<div><h2 class="text-base font-bold text-white">Publish Directly to Instagram</h2><p class="text-[11px] text-zinc-400">TONY Studio → Instagram Feed · Single-image post</p></div></div>'+
   '<p id="tonyIgConnection" class="text-xs text-zinc-300 mb-3" role="status">Checking Instagram connection…</p>'+
   '<div id="tonyIgAdmin" class="hidden rounded-lg border border-amber-300/20 bg-zinc-900 p-3 mb-3">'+
   '<label for="tonyIgPassword" class="text-xs font-semibold text-white block mb-1">Studio Admin Password</label>'+
   '<div class="flex gap-2"><input id="tonyIgPassword" type="password" autocomplete="current-password" placeholder="Admin password configured in Vercel" class="min-w-0 flex-1 rounded-lg p-2.5 text-xs bg-black border border-white/10 text-white" />'+
   '<button id="tonyIgUnlock" type="button" class="px-3 py-2 rounded-lg bg-[#FFC300] text-black text-xs font-bold">Unlock</button></div></div>'+
   '<div class="flex gap-2 flex-wrap mb-3"><button id="tonyIgConnect" type="button" class="hidden rounded-xl bg-[#FFC300] text-black px-3 py-2.5 text-xs font-black">Connect Instagram Account</button>'+
   '<button id="tonyIgDisconnect" type="button" class="hidden rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-xs text-white">Disconnect</button>'+
   '<button id="tonyIgFillCaption" type="button" class="rounded-xl bg-zinc-800 border border-white/10 px-3 py-2.5 text-xs text-white">Fill Caption</button></div>'+
   '<label for="tonyIgCaption" class="block text-xs font-semibold text-zinc-300 mb-1">Instagram Caption</label>'+
   '<textarea id="tonyIgCaption" rows="5" maxlength="2200" placeholder="Verified news caption..." class="w-full rounded-xl p-3 text-sm bg-zinc-900 border border-white/10 text-white resize-y"></textarea>'+
   '<div class="flex gap-2 items-start my-3"><input id="tonyIgConfirm" type="checkbox" class="accent-yellow-400 mt-1" />'+
   '<label for="tonyIgConfirm" class="text-xs text-zinc-300">I verified the report and its sources, own or have licensed the image, and authorize public posting to my connected Instagram account.</label></div>'+
   '<button id="tonyIgPublish" type="button" disabled class="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 px-4 font-black text-sm text-black">Publish on Instagram</button>'+
   '<p id="tonyIgMessage" role="status" aria-live="polite" class="mt-2 text-xs text-zinc-400">Complete article verification, image rights review and Ready to Publish status first.</p>'+
   '<div id="tonyIgResult" class="hidden mt-3 rounded-lg border border-green-500/25 p-3 text-xs text-green-300"></div>'+
   '<p class="text-[11px] text-zinc-500 mt-3">PNG export and local drafts remain available. This button publishes to Instagram; it is not a scheduled post.</p>';
  section.insertBefore(wrap,section.children[1]||null);
  $('tonyIgUnlock').addEventListener('click',unlock);
  $('tonyIgPassword').addEventListener('keydown',e=>{if(e.key==='Enter')unlock();});
  $('tonyIgConnect').addEventListener('click',()=>{location.assign('/api/instagram/connect');});
  $('tonyIgDisconnect').addEventListener('click',disconnect);
  $('tonyIgFillCaption').addEventListener('click',()=>{$('tonyIgCaption').value=makeCaption();message('Headline and source added to caption. Proofread before publishing.');});
  $('tonyIgPublish').addEventListener('click',publish);
  $('tonyIgCaption').value=makeCaption();
  refresh();
 }
 async function request(path,opts){
  const response=await fetch(path,{credentials:'same-origin',headers:{'Content-Type':'application/json'},...opts});
  let data;
  try{data=await response.json();}catch{throw new Error('The server returned an invalid response.');}
  if(!response.ok)throw new Error(data.error||'Request failed.');
  return data;
 }
 async function refresh(){
  try{
   const data=await request('/api/instagram/access');
   configured=data.configured;unlocked=data.unlocked;connected=data.connected;
   $('tonyIgAdmin').classList.toggle('hidden',!configured||unlocked);
   $('tonyIgConnect').classList.toggle('hidden',!configured||!unlocked||connected);
   $('tonyIgDisconnect').classList.toggle('hidden',!connected);
   $('tonyIgPublish').disabled=!connected||publishing;
   const state=!configured?'⚠ Instagram is not configured in Meta/Vercel yet.':
     !unlocked?'🔒 Unlock the newsroom to publish.':
     connected?'✓ @'+data.account.username+' is connected ('+data.account.accountType+').':
     'No account connected. Connect a Business or Creator account.';
   $('tonyIgConnection').textContent=state;
   const flag=new URLSearchParams(location.search).get('instagram');
   if(flag){
    if(flag==='connected')message('Instagram connected. Review the post before publishing.','success');
    else message('Instagram connection failed ('+flag+'). Check Meta app permissions.','error');
    history.replaceState({},'',location.pathname+location.hash);
   }
  }catch(e){message(e.message,'error');}
 }
 async function unlock(){
  const password=$('tonyIgPassword').value;
  try{
   await request('/api/instagram/access',{method:'POST',body:JSON.stringify({password})});
   $('tonyIgPassword').value='';
   await refresh();
  }catch(e){message(e.message,'error');}
 }
 async function disconnect(){
  if(!confirm('Disconnect Instagram from this browser?'))return;
  try{await request('/api/instagram/access',{method:'DELETE'});connected=false;await refresh();message('Account disconnected from this browser.','success');}
  catch(e){message(e.message,'error');}
 }
 async function publish(){
  if(publishing||!connected)return;
  const s=window.TONYStudio.state;
  if(s.publicationStatus!=='ready')return message('Editorial status must be Ready to Publish.','error');
  if(!s.sourceUrl||!['cross-checked','official-source'].includes(s.verificationStatus))
   return message('A source URL and completed source verification are required.','error');
  if(!['licensed','original','ai-generated'].includes(s.imagePermission))
   return message('Confirm licensed or original image rights.','error');
  if(!$('tonyIgConfirm').checked)return message('Check the publication consent box.','error');
  const caption=$('tonyIgCaption').value.trim();
  if(!caption||caption.length>2200)return message('Instagram caption must be 1–2,200 characters.','error');
  if(!confirm('Publish this image and caption to your connected Instagram account NOW?'))return;
  let imageData;
  try{
   window.TONYStudio.renderCanvas();
   imageData=window.TONYStudio.canvas.toDataURL('image/jpeg',0.87);
  }catch(e){return message('Could not render JPEG. Re-upload the photo.','error');}
  if(imageData.length>4_000_000)return message('Image too large. Reduce the source photo size and retry.','error');
  publishing=true;$('tonyIgPublish').disabled=true;
  $('tonyIgResult').classList.add('hidden');
  try{
   message('Uploading JPEG and submitting to Instagram…');
   let data=await request('/api/instagram/publish',{method:'POST',body:JSON.stringify({
    imageData,caption,sourceUrl:s.sourceUrl,verificationStatus:s.verificationStatus,imagePermission:s.imagePermission,photoKind:s.photoKind||'manual'
   })});
   let loops=0;
   while(data.status==='processing' && loops++<8){
    message('Instagram is processing the image. Checking status…');
    await new Promise(r=>setTimeout(r,2300));
    data=await request('/api/instagram/publish',{method:'POST',body:JSON.stringify({pendingToken:data.pendingToken})});
   }
   if(data.status!=='published'){
    message('Instagram is still processing. Check your account before retrying to avoid duplicates.','error');
    return;
   }
   s.publicationStatus='published';
   const select=$('tonyPublicationStatus');
   if(select){select.value='published';select.dispatchEvent(new Event('change'));}
   const save=$('tonySaveDraft');
   if(save)save.click();
   $('tonyIgConfirm').checked=false;
   const result=$('tonyIgResult');
   result.classList.remove('hidden');
   result.textContent='Published on Instagram · Media ID: '+data.id;
   if(data.permalink){
    const link=document.createElement('a');
    link.href=data.permalink;link.target='_blank';link.rel='noopener noreferrer';
    link.textContent=' · View on Instagram ↗';
    link.className='underline font-semibold';
    result.appendChild(link);
   }
   message('Instagram publication confirmed by Meta.','success');
  }catch(e){
   message(e.message+' Check Instagram before retrying to avoid duplicate posts.','error');
  }finally{publishing=false;$('tonyIgPublish').disabled=!connected;}
 }
 document.addEventListener('DOMContentLoaded',mount);
})();
