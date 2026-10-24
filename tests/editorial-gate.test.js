const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM}=require('jsdom');
const gate=require('../assets/editorial-gate.js');
const newsroom=fs.readFileSync(path.join(__dirname,'../assets/newsroom.js'),'utf8');
const instagram=fs.readFileSync(path.join(__dirname,'../assets/instagram.js'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function state(){
  return {
    sourceUrl:'https://www.nyc.gov/site/example/story.page',
    verificationStatus:'official-source',
    imagePermission:'original',
    imageCredit:'TONY owned',
    headline:'New York City officials announce updated transit service',
    summary:'The notice specifies which stations are affected and when.',
    photoKind:'manual',activeImage:{naturalWidth:1800,naturalHeight:1200},
    publicationStatus:'draft'
  };
}
test('preflight requires sourced copy, image rights and verified source',()=>{
  const s=state();
  assert.deepEqual(gate.assess(s),[]);
  s.sourceUrl='javascript:alert(1)';
  assert.ok(gate.assess(s).some(x=>x.id==='source'));
  s.sourceUrl='http://nyc.gov/story';
  assert.ok(gate.assess(s).some(x=>x.id==='source'));
  s.sourceUrl='https://nyc.gov/story';
  s.verificationStatus='needs-review';
  assert.ok(gate.assess(s).some(x=>x.id==='verification'));
  s.verificationStatus='cross-checked';
  s.headline='[DEMO] Example story';
  assert.ok(gate.assess(s).some(x=>x.id==='headline'));
  s.headline='Documented local update';
  s.summary='';
  assert.ok(gate.assess(s).some(x=>x.id==='summary'));
  s.summary='Verified agency reporting';
  s.imagePermission='unknown';
  assert.ok(gate.assess(s).some(x=>x.id==='rights'));
});
test('licensed images need credit, and generated visuals need disclosure',()=>{
  const s=state();
  s.imagePermission='licensed';s.imageCredit='';
  assert.ok(gate.assess(s).some(x=>x.id==='credit'));
  s.photoSourceCredit='Licensed photographer';
  assert.ok(!gate.assess(s).some(x=>x.id==='credit'));
  s.photoKind='ai';
  assert.ok(gate.assess(s).some(x=>x.id==='ai'));
  s.imagePermission='ai-generated';
  assert.ok(!gate.assess(s).some(x=>x.id==='ai'));
  s.activeImage=null;
  assert.ok(gate.assess(s).some(x=>x.id==='image'));
});
test('local review workflow has explicit approval, revocation and no auto publication',()=>{
  const dom=new JSDOM('<!doctype html><html><body>'+
    '<div><select id="tonyPublicationStatus"><option value="draft">Draft</option><option value="review">Review</option><option value="ready">Ready</option><option value="published">Published</option></select></div>'+
    '<input id="tonySourceUrl"><select id="tonyVerification"></select><select id="tonyImagePermission"></select>'+
    '<input id="tonyImageCredit"><textarea id="headlineInput"></textarea><textarea id="summaryInput"></textarea>'+
    '<input id="imageUploadInput" type="file">'+
    '</body></html>',{runScripts:'outside-only',url:'https://tony-studio-lmeo.vercel.app'});
  const w=dom.window;const s=state();
  w.TONYStudio={state:s,showToast:()=>{}};
  const status=w.document.getElementById('tonyPublicationStatus');
  status.addEventListener('change',()=>{s.publicationStatus=status.value;});
  w.eval(fs.readFileSync(path.join(__dirname,'../assets/editorial-gate.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.ok(w.document.getElementById('tonyPreflightPanel'));
  assert.equal(w.document.getElementById('tonyPreflightApprove').disabled,false);
  w.document.getElementById('tonyPreflightRequest').click();
  assert.equal(s.publicationStatus,'review');
  w.document.getElementById('tonyPreflightApprove').click();
  assert.equal(s.publicationStatus,'ready');
  s.verificationStatus='needs-review';
  w.document.getElementById('tonyVerification').dispatchEvent(new w.Event('change'));
  assert.equal(s.publicationStatus,'review','approval revoked by changed verification');
  assert.equal(w.document.getElementById('tonyPreflightApprove').disabled,true);
  assert.match(w.document.getElementById('tonyPreflightStatus').textContent,/editorial checks remaining/);
  w.document.getElementById('tonyPreflightReset').click();
  assert.equal(s.publicationStatus,'draft');
  assert.notEqual(s.publicationStatus,'published','approval is not Instagram publication');
  w.close();
});
test('editor source and Instagram client both use shared editorial gate',()=>{
  assert.match(index,/assets\/editorial-gate\.js/);
  assert.match(newsroom,/window\.TONYEditorialGate\?\.assess\(app\.state\)/);
  assert.match(instagram,/window\.TONYEditorialGate\?\.assess\(s\)/);
});
