/* TONY editorial preflight: local review workflow; never auto-publishes. */
(function(root, build) {
  'use strict';
  const api=build();
  if (typeof module === 'object' && module.exports) module.exports=api;
  if (root) root.TONYEditorialGate=api;
})(typeof window !== 'undefined' ? window : null, function() {
  'use strict';
  const $=id=>document.getElementById(id);
  function assess(state) {
    const s=state||{};
    const issues=[];
    let validUrl=false;
    try{
      const url=new URL(String(s.sourceUrl||''));
      validUrl=url.protocol==='https:' && Boolean(url.hostname);
    }catch{}
    if(!validUrl)issues.push({id:'source',message:'Add an HTTPS source article URL.'});
    if(!['official-source','cross-checked'].includes(s.verificationStatus))
      issues.push({id:'verification',message:'Cross-check the story or confirm an official source.'});
    const title=String(s.headline||'').trim();
    if(!title || /^(your new york story starts here|\[demo\])/i.test(title))
      issues.push({id:'headline',message:'Replace demo text with an accurate news headline.'});
    const summary=String(s.summary||'').trim();
    if(!summary || /^(paste a verified nyc article url)/i.test(summary))
      issues.push({id:'summary',message:'Add sourced facts to the story summary.'});
    if(!s.activeImage || !(s.activeImage.naturalWidth>0))
      issues.push({id:'image',message:'Choose a usable cover image.'});
    if(!['licensed','original','ai-generated'].includes(s.imagePermission))
      issues.push({id:'rights',message:'Confirm ownership or valid image usage rights.'});
    if(s.imagePermission==='licensed' && !String(s.imageCredit||s.photoSourceCredit||'').trim())
      issues.push({id:'credit',message:'Add required photographer and license credit.'});
    if(s.photoKind==='ai' && s.imagePermission!=='ai-generated')
      issues.push({id:'ai',message:'Disclose synthetic artwork as an AI-generated illustration.'});
    return issues;
  }
  function syncControls() {
    const s=typeof window!=='undefined'?window.TONYStudio?.state:null;
    const summary=$('tonyPreflightStatus'), checkList=$('tonyPreflightIssues');
    if(!s || !summary || !checkList)return;
    const issues=assess(s);
    // A changed story is not allowed to keep an obsolete Ready state.
    if(s.publicationStatus==='ready' && issues.length) {
      s.publicationStatus='review';
      const input=$('tonyPublicationStatus');
      if(input)input.value='review';
    }
    checkList.replaceChildren();
    for(const issue of issues){
      const li=document.createElement('li');
      li.textContent=issue.message;
      li.className='text-[11px] text-amber-200 leading-relaxed';
      checkList.append(li);
    }
    if(!issues.length){
      const li=document.createElement('li');
      li.textContent='Source, news copy, image and credits are ready for your final editorial decision.';
      li.className='text-[11px] text-emerald-300';
      checkList.append(li);
    }
    summary.textContent=issues.length?issues.length+' editorial checks remaining':
      (s.publicationStatus==='ready'?'Approved locally for publishing':'All preflight checks passed · awaiting explicit approval');
    $('tonyPreflightApprove').disabled=Boolean(issues.length)||s.publicationStatus==='published';
    $('tonyPreflightRequest').disabled=s.publicationStatus==='published';
  }
  function setStatus(value) {
    const app=window.TONYStudio, select=$('tonyPublicationStatus');
    if(!app || !select)return;
    if(value==='ready'){
      const issues=assess(app.state);
      if(issues.length){syncControls();app.showToast?.(issues[0].message);return;}
    }
    select.value=value;
    select.dispatchEvent(new Event('change'));
    syncControls();
    app.showToast?.(value==='ready'?'Local editorial review approved — not published':
      value==='review'?'Story moved to editorial review':'Story returned to drafts');
  }
  function mount() {
    const status=$('tonyPublicationStatus');
    if(!status || $('tonyPreflightPanel'))return;
    const panel=document.createElement('section');
    panel.id='tonyPreflightPanel';
    panel.className='mt-3 p-3 rounded-xl border border-white/15 bg-zinc-900/70';
    panel.innerHTML=
      '<div class="flex flex-wrap gap-2 items-center justify-between">'+
      '<h3 class="text-xs font-black text-white">TONY Editorial Preflight</h3>'+
      '<span id="tonyPreflightStatus" role="status" aria-live="polite" class="text-[11px] text-[#FFC300]"></span></div>'+
      '<p class="text-[11px] text-zinc-400 mt-2">Local single-editor review, inspired by staged newsroom workflows. Approval does not schedule or publish.</p>'+
      '<ul id="tonyPreflightIssues" class="mt-2 pl-3 list-disc space-y-1"></ul>'+
      '<div class="flex flex-wrap gap-2 mt-3">'+
      '<button type="button" id="tonyPreflightRequest" class="px-3 py-2.5 rounded-lg bg-zinc-800 text-white text-xs font-bold">Request Review</button>'+
      '<button type="button" id="tonyPreflightApprove" class="px-3 py-2.5 rounded-lg bg-[#FFC300] text-black text-xs font-black">Approve for Publishing</button>'+
      '<button type="button" id="tonyPreflightReset" class="px-3 py-2.5 rounded-lg border border-white/15 text-zinc-300 text-xs font-bold">Return to Draft</button>'+
      '</div>';
    status.parentElement.insertAdjacentElement('afterend',panel);
    $('tonyPreflightRequest').addEventListener('click',()=>setStatus('review'));
    $('tonyPreflightApprove').addEventListener('click',()=>setStatus('ready'));
    $('tonyPreflightReset').addEventListener('click',()=>setStatus('draft'));
    for(const id of ['tonySourceUrl','tonyImageCredit','tonyVerification','tonyImagePermission',
      'tonyPublicationStatus','headlineInput','summaryInput','imageUploadInput']){
      const input=$(id);
      if(input){input.addEventListener('input',syncControls);input.addEventListener('change',syncControls);}
    }
    syncControls();
  }
  if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',mount);
  return {assess,syncControls,mount};
});
