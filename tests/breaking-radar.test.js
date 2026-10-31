const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const RADAR=fs.readFileSync(path.join(__dirname,'../assets/breaking-radar.js'),'utf8');
const EDGE=fs.readFileSync(path.join(__dirname,'../supabase/functions/tony-news-radar/index.ts'),'utf8');
const HTML=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const SAMPLE={
 id:'tip-001',
 headline:'MTA announces service changes in Brooklyn tonight',
 summary:'Officials announced changes on multiple subway lines.',
 source_name:'Gothamist',source_url:'https://gothamist.com/news/mta-changes',
 source_published_at:new Date().toISOString(),borough:'BROOKLYN',category:'TRANSIT',
 score:81,priority:'high',source_count:2,is_sensitive:false
};
function fixture(){
 const dom=new JSDOM('<!doctype html><html><body><main><section><div id="tonyArticlePanel"></div>'+
 '<input id="tonyArticleUrl"/><input id="tonyDraftMessage"/><textarea id="headlineInput"></textarea></section></main></body></html>',{
 url:'https://tony-studio-lmeo.vercel.app',runScripts:'outside-only',pretendToBeVisual:true
 });
 const w=dom.window,events={preset:[],review:[],render:0,publish:0};
 const state={activeImage:{original:true},photoKind:'ai',photoSourceUrl:'https://example.org/old'};
 w.TONYStudio={
  state,dateInput:{value:''},timeInput:{value:''},applyPreset(p){events.preset.push(p);Object.assign(state,p);},
  renderCanvas(){events.render++},showToast(){},publish(){events.publish++}
 };
 w.TONYNewsroom={
  nyTime(){return {date:'2026-10-31',time:'18:00'};},
  setEditorial(data){events.review.push(data);}
 };
 w.fetch=async()=>new Response(JSON.stringify({stories:[SAMPLE],updatedAt:new Date().toISOString()}),{
  headers:{'content-type':'application/json'}});
 w.eval(RADAR);
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w,events};
}
test('news radar is loaded by TONY Studio with explicit human review',()=>{
 assert.match(HTML,/src="\/assets\/breaking-radar\.js/);
 assert.match(EDGE,/requires_verification:true/);
 assert.match(EDGE,/photo_rights:"unknown"/);
 assert.match(EDGE,/editorial_status:"new"/);
 assert.doesNotMatch(EDGE,/media_publish|instagram\.com\/.*publish/);
 assert.match(EDGE,/on_conflict=source_url/);
});
test('source diversity and safe scheduled ingestion are built in',()=>{
 for(const source of ['Gothamist','THE CITY','City Limits','Hell Gate','PIX11','amNewYork'])assert.match(EDGE,new RegExp(source));
 assert.match(EDGE,/slice\(0,5\)/);
 assert.match(EDGE,/x-tony-cron/);
 assert.match(EDGE,/token_sha256/);
 assert.match(EDGE,/score\.desc/);
 assert.match(EDGE,/perSource\.get/);
});
test('radar builds sourced cards without publishing anything',async()=>{
 const {w,dom,events}=fixture();
 await new Promise(r=>setTimeout(r,30));
 const document=w.document;
 assert.ok(document.getElementById('tonyRadarPanel'));
 assert.equal(document.querySelectorAll('.tony-radar-story').length,1);
 assert.equal(document.querySelector('.tony-radar-story h3').textContent,SAMPLE.headline);
 const source=document.querySelector('a.tony-radar-source');
 assert.equal(source.href,SAMPLE.source_url);
 assert.equal(source.target,'_blank');
 assert.equal(events.publish,0);
 dom.window.close();
});
test('preparing a source tip removes old media and resets editorial rights',async()=>{
 const {w,dom,events}=fixture();
 await new Promise(r=>setTimeout(r,30));
 w.document.querySelector('button.tony-radar-prepare').click();
 assert.equal(events.preset.length,1);
 assert.equal(events.preset[0].headline,SAMPLE.headline);
 assert.equal(events.preset[0].region,'BROOKLYN');
 assert.equal(events.review[0].verificationStatus,'needs-review');
 assert.equal(events.review[0].imagePermission,'unknown');
 assert.equal(events.review[0].publicationStatus,'review');
 assert.equal(w.TONYStudio.state.activeImage,null);
 assert.equal(w.TONYStudio.state.photoSourceUrl,'');
 assert.equal(events.publish,0);
 assert.equal(w.document.getElementById('tonyArticleUrl').value,SAMPLE.source_url);
 dom.window.close();
});
