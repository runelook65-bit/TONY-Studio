const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const v=require('../lib/visual');
const photoSearch=require('../api/visual/search');
const photoImport=require('../api/visual/import');
const generate=require('../api/visual/generate');
const imageUi=fs.readFileSync(path.join(__dirname,'../assets/visual-intelligence.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const instagram=fs.readFileSync(path.join(__dirname,'../assets/instagram.js'),'utf8');
const instPub=fs.readFileSync(path.join(__dirname,'../api/instagram/publish.js'),'utf8');
const mockSecret='test-visual-signing-secret-at-least-32-characters';
process.env.TONY_SESSION_SECRET=mockSecret;
process.env.INSTAGRAM_REDIRECT_URI='https://tony-studio-lmeo.vercel.app/api/instagram/callback';
function response(){
 const h={};let code=200;
 const o={setHeader(k,val){h[k.toLowerCase()]=val;},getHeader(k){return h[k.toLowerCase()]},
  status(n){code=n;return o;},json(data){return {status:code,data,headers:h};}};
 return o;
}
const request=(method,query={},body={})=>({method,query,body,headers:{origin:'https://tony-studio-lmeo.vercel.app'}});
test('imports require signed media references and reject tampering/SSRF',async()=>{
 const photo={kind:'commons',imageUrl:'https://upload.wikimedia.org/wikipedia/commons/test.jpg',sourceUrl:'https://commons.wikimedia.org/wiki/File:Test.jpg',license:'CC BY 4.0',credit:'Artist',photoKind:'archive'};
 const signed=v.signPhoto(photo);
 assert.equal(v.unsignPhoto(signed).credit,'Artist');
 assert.equal(v.unsignPhoto(signed.slice(0,-3)+'xyz'),null);
 assert.throws(()=>v.assertHost('http://127.0.0.1/private','commons'));
 assert.throws(()=>v.assertHost('https://upload.wikimedia.org.evil.example/image.jpg','commons'));
 const rejected=await photoImport(request('POST',{}, {importToken:'bad'}),response());
 assert.equal(rejected.status,400);
});
test('Wikimedia licensing accepts compatible types and excludes restricted NC/ND',()=>{
 const lic=photoSearch._commonsLicense;
 assert.equal(lic({LicenseShortName:{value:'CC BY-SA 4.0'}}),'CC BY-SA 4.0');
 assert.equal(lic({LicenseShortName:{value:'CC0'}}),'CC0');
 assert.equal(lic({LicenseShortName:{value:'CC BY-NC 4.0'}}),null);
 assert.equal(lic({LicenseShortName:{value:'CC BY-ND 4.0'}}),null);
 assert.equal(lic({LicenseShortName:{value:'Unknown'}}),null);
});
test('search rejects bad requests and does not expose Pexels key',async()=>{
 assert.equal((await photoSearch(request('GET',{q:'x',source:'commons'}),response())).status,400);
 assert.equal((await photoSearch(request('GET',{q:'New York',source:'invalid'}),response())).status,400);
 const old=global.fetch;
 global.fetch=async()=>new Response(JSON.stringify({query:{pages:[{pageid:42,title:'File:Brooklyn waterfront.jpg',
  imageinfo:[{mime:'image/jpeg',thumburl:'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/example.jpg',
   descriptionurl:'https://commons.wikimedia.org/wiki/File:Brooklyn_waterfront.jpg',
   extmetadata:{LicenseShortName:{value:'CC BY 4.0'},Artist:{value:'Test photographer'}}}]}]}}),
 {headers:{'content-type':'application/json'}});
 try{
  const out=await photoSearch(request('GET',{q:'Brooklyn waterfront',source:'commons'}),response());
  assert.equal(out.status,200);
  assert.equal(out.data.items.length,1);
  assert.equal(out.data.items[0].photographer,'Test photographer');
  assert.ok(out.data.items[0].importToken);
  assert.doesNotMatch(JSON.stringify(out.data),/PEXELS_API_KEY|TONY_SESSION_SECRET/);
 }finally{global.fetch=old;}
});
test('Gemini creative brief forbids fabricated incident photography',()=>{
 const prompt=generate._buildPrompt({headline:'NYC housing plan debate',summary:'The city is debating housing spending',borough:'BRONX',category:'HOUSING'});
 assert.match(prompt,/NOT an actual news photograph/);
 assert.match(prompt,/Do not invent or depict specific incidents/);
 assert.match(prompt,/No text, logos/);
});
test('unauthorized Gemini route cannot spend API credits',async()=>{
 const old=process.env.GEMINI_API_KEY;process.env.GEMINI_API_KEY='fake-test-key';
 try{
  const r=await generate(request('POST',{}, {headline:'Something'},),response());
  assert.equal(r.status,401);
 }finally{if(old)process.env.GEMINI_API_KEY=old;else delete process.env.GEMINI_API_KEY;}
});
test('visual UI mounts a real workflow with relevant source and AI controls',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><section><label id="dropZone"></label></section>'+
 '<div id="tonyImageCredit"></div></body></html>',{runScripts:'outside-only',url:'https://tony-studio-lmeo.vercel.app'});
 let renders=0;
 dom.window.TONYStudio={state:{headline:'Bronx transit delays',summary:'Updated service in NYC',region:'BRONX',badgeText:'TRANSIT'},renderCanvas(){renders++},showToast(){}};
 dom.window.fetch=async()=>new dom.window.Response();
 // Stub actual endpoint response with native global Response (jsdom has no Response constructor).
 dom.window.fetch=async()=>new Response(JSON.stringify({commons:true,pexels:false,gemini:false,canGenerate:false,adminConfigured:false}),
  {headers:{'content-type':'application/json'}});
 dom.window.eval(imageUi);
 dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
 await Promise.resolve();await Promise.resolve();
 const doc=dom.window.document;
 assert.ok(doc.getElementById('tonyVisualPanel'));
 assert.ok(doc.getElementById('tonyVisualSearchButton'));
 assert.ok(doc.getElementById('tonyGenerateButton'));
 assert.ok(doc.getElementById('tonyVisualResults'));
 assert.match(doc.getElementById('tonyVisualQuery').value,/BRONX/);
 dom.window.close();
});
test('visual provenance and illustrated media labels flow to PNG and Instagram code',()=>{
 assert.match(html,/AI ILLUSTRATION/);
 assert.match(html,/state\.photoKind === 'ai'/);
 assert.match(html,/visual-intelligence\.js/);
 assert.match(instagram,/AI-generated illustration/);
 assert.match(instPub,/p\.photoKind==='ai'/);
 assert.match(instPub,/Generated artwork requires AI image rights review/);
});
