const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const SCRIPT=fs.readFileSync(path.join(__dirname,'../assets/visual-intelligence.js'),'utf8');
const RADAR=fs.readFileSync(path.join(__dirname,'../assets/breaking-radar.js'),'utf8');
function setup({withPhotos=true}={}){
 const dom=new JSDOM('<!doctype html><html><body><div><label id="dropZone"></label></div>'+
 '<div id="tonyImageCredit"></div></body></html>',{runScripts:'outside-only',url:'https://tony-studio-lmeo.vercel.app/'});
 const w=dom.window;
 const calls=[],rendered=[],state={headline:'Hunts Point Bronx e-bike fire incident',summary:'Officials respond to an e-bike battery incident in the Bronx',region:'BRONX',badgeText:'PUBLIC SAFETY',activeImage:null,photoKind:'manual'};
 w.TONYStudio={state,renderCanvas(){rendered.push(1)},showToast(){}};
 w.fetch=async url=>{
  const u=String(url);calls.push(u);
  if(u.includes('/api/visual/access'))return new Response(JSON.stringify({commons:true,pexels:false,gemini:false,canGenerate:false,adminConfigured:false}),{headers:{'content-type':'application/json'}});
  if(u.includes('/api/visual/search'))return new Response(JSON.stringify({items:withPhotos?[{
    id:'commons-42',kind:'commons',title:'Bronx city street',
    imageUrl:'https://upload.wikimedia.org/wikipedia/commons/thumb/test.jpg',
    sourceUrl:'https://commons.wikimedia.org/wiki/File:Bronx_street.jpg',
    license:'CC BY 4.0',photographer:'Test Photographer',importToken:'fake-token'
  }]:[]}),{headers:{'content-type':'application/json'}});
  if(u.includes('/api/article'))return new Response(JSON.stringify({
    sourceUrl:'https://gothamist.com/news/bronx-ebike',imageUrl:'https://media.gothamist.com/article.jpg'
  }),{headers:{'content-type':'application/json'}});
  throw Error('Unexpected URL '+u);
 };
 w.eval(SCRIPT);
 w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {dom,w,calls,state};
}
const story={headline:'Bronx e-bike fire, officials respond in Hunts Point',summary:'Battery incident reported in the Bronx',
 borough:'BRONX',category:'PUBLIC SAFETY',source_url:'https://gothamist.com/news/bronx-ebike'};
test('automated visual queries use borough, story subject and safe generic fallback',()=>{
 const {w,dom}=setup();
 const q=w.TONYVisual.visualQueries(story);
 assert.match(q[0],/Hunts Point Bronx electric bicycle/);
 assert.equal(q[1],'New York City city streetscape');
 const safety=w.TONYVisual.visualQueries({headline:'Shooting involving a victim in Queens',
 summary:'Police investigating',borough:'QUEENS',category:'PUBLIC SAFETY'});
 assert.ok(!safety[0].includes('shooting'));
 assert.ok(!safety[0].includes('victim'));
 assert.ok(safety[0].includes('city streetscape'));
 dom.window.close();
});
test('selection automatically finds source-labeled photos, but does not inject unlicensed article photo',async()=>{
 const {w,dom,calls,state}=setup();
 const count=await w.TONYVisual.suggestForStory(story);
 assert.equal(count,1);
 assert.ok(calls.some(x=>x.includes('/api/visual/search')));
 assert.ok(calls.some(x=>x.includes('/api/article')));
 assert.equal(w.document.querySelectorAll('.tony-visual-result').length,1);
 assert.match(w.document.getElementById('tonyVisualSourceReference').textContent,/REFERENCE ONLY/);
 assert.match(w.document.getElementById('tonyVisualSourceReference').textContent,/Do not copy/);
 assert.equal(state.activeImage,null);
 assert.equal(state.photoKind,'manual');
 dom.window.close();
});
test('no Commons photo causes safe general query fallback',async()=>{
 const {w,dom,calls,state}=setup({withPhotos:false});
 const count=await w.TONYVisual.suggestForStory(story);
 assert.equal(count,0);
 const searches=calls.filter(x=>x.includes('/api/visual/search'));
 assert.equal(searches.length,2);
 assert.match(decodeURIComponent(searches[1]),/New York City city streetscape/);
 assert.equal(state.activeImage,null);
 dom.window.close();
});
test('radar contains reviewed-visual bridge, no auto Instagram publishing',()=>{
 assert.match(RADAR,/Prepare Post \+ Find Images/);
 assert.match(RADAR,/TONYVisual\.suggestForStory\(story\)/);
 assert.match(RADAR,/switchView\('design'\)/);
 assert.match(RADAR,/imagePermission:'unknown'/);
 assert.doesNotMatch(RADAR,/media_publish/);
});
