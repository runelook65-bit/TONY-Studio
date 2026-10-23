const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SCRIPT = fs.readFileSync(path.join(__dirname,'../assets/mobile.js'),'utf8');
const CSS = fs.readFileSync(path.join(__dirname,'../assets/mobile.css'),'utf8');

function fixture() {
  const dom = new JSDOM(
    '<!doctype html><html><body><header><div><div></div><div></div></div></header>' +
    '<main><section>' +
    '<div id="tonyArticlePanel"><input id="tonyArticleUrl"/></div>' +
    '<section id="tonyIgPanel"><button id="tonyIgPublish" disabled>Publish</button>' +
    '<button id="tonyIgConnect" class="hidden"></button><p id="tonyIgMessage"></p></section>' +
    '<div><label id="dropZone"></label><button id="btnSampleMetro"></button></div>' +
    '<div><textarea id="headlineInput">Initial headline</textarea></div>' +
    '<div><input id="regionInput" value="NEW YORK CITY"/><div><button class="region-chip" data-region="MANHATTAN"></button></div></div>' +
    '<div><div>Brand settings</div><button id="btnRatioSquare"></button></div>' +
    '</section><section>' +
    '<div><canvas id="newsCanvas"></canvas><button id="btnDownloadPNG">Save PNG</button>' +
    '<button id="btnPublishToGrid"></button><button id="btnCopyCaption"></button></div>' +
    '<div><div id="feedGridContainer"></div></div>' +
    '</section></main></body></html>',
    {url:'https://tony-studio-lmeo.vercel.app/',runScripts:'outside-only',pretendToBeVisual:true}
  );
  const {window} = dom;
  window.matchMedia = q => ({ matches:q.includes('767'),media:q,addListener(){},removeListener(){} });
  window.scrollTo = () => {};
  let downloaded = 0;
  let published = 0;
  const canvas = {toDataURL:()=>'data:image/jpeg;base64,ZHVtbXk='};
  window.TONYStudio = {
    state:{headline:'Initial headline',region:'NEW YORK CITY'},
    canvas,renderCanvas(){},
    showToast(){},
    get downloaded(){return downloaded}
  };
  window.document.getElementById('btnDownloadPNG').addEventListener('click',()=>downloaded++);
  window.document.getElementById('tonyIgPublish').addEventListener('click',()=>published++);
  window.eval(SCRIPT);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  return {window,document:window.document,dom,getDownloaded:()=>downloaded,getPublished:()=>published};
}
test('mobile CSS targets safe areas and preserves separate desktop styling',()=>{
  assert.match(CSS,/@media \(max-width: 767px\)/);
  assert.match(CSS,/env\(safe-area-inset-bottom/);
  assert.match(CSS,/tony-mobile-navigation/);
  assert.match(CSS,/#newsCanvas/);
  assert.match(CSS,/#tonyIgPanel/);
});
test('mobile navigation groups all editor panels in three steps',()=>{
  const {window,document,dom} = fixture();
  assert.equal(document.body.dataset.tonyMobileView,'story');
  assert.equal(document.querySelectorAll('.tony-mobile-panel[data-tony-mobile-panel="story"]').length,3);
  assert.equal(document.querySelectorAll('.tony-mobile-panel[data-tony-mobile-panel="design"]').length,3);
  assert.equal(document.querySelectorAll('.tony-mobile-panel[data-tony-mobile-panel="publish"]').length,3);
  assert.equal(document.getElementById('tonyMobileBack').hidden,true);
  assert.equal(document.querySelector('[data-tony-tab="story"]').getAttribute('aria-selected'),'true');
  window.TONYMobile.switchView('design');
  assert.equal(document.body.dataset.tonyMobileView,'design');
  assert.equal(document.getElementById('tonyMobileBack').hidden,false);
  assert.equal(document.querySelector('[data-tony-tab="design"]').getAttribute('aria-selected'),'true');
  window.TONYMobile.switchView('publish');
  assert.equal(document.getElementById('tonyMobileSecondary').hidden,false);
  assert.equal(document.getElementById('tonyMobileSummaryTitle').textContent,'Initial headline');
  dom.window.close();
});
test('mobile publish button does not bypass disabled Instagram security gate',()=>{
  const {document,getPublished,dom} = fixture();
  document.querySelector('[data-tony-tab="publish"]').click();
  document.getElementById('tonyMobileNext').click();
  assert.equal(getPublished(),0);
  document.getElementById('tonyIgPublish').disabled=false;
  document.getElementById('tonyMobileNext').click();
  assert.equal(getPublished(),1);
  dom.window.close();
});
test('mobile quick actions trigger existing desktop PNG export',()=>{
  const {document,getDownloaded,dom}=fixture();
  document.querySelector('[data-tony-tab="publish"]').click();
  document.getElementById('tonyMobileSecondary').click();
  assert.equal(getDownloaded(),1);
  dom.window.close();
});
test('borough shortcuts update the shared canvas model and new headline updates count',()=>{
  const {window,document,dom}=fixture();
  const brooklyn=document.querySelector('[data-region="BROOKLYN"]');
  assert.ok(brooklyn);
  brooklyn.click();
  assert.equal(window.TONYStudio.state.region,'BROOKLYN');
  const headline=document.getElementById('headlineInput');
  headline.value='A new Brooklyn headline';
  headline.dispatchEvent(new window.Event('input',{bubbles:true}));
  assert.equal(document.getElementById('tonyMobileHeadlineCount').textContent,headline.value.length+' characters');
  dom.window.close();
});
test('brand options start collapsed but can expand without removing existing controls',()=>{
  const {document,dom}=fixture();
  const toggle=document.getElementById('tonyMobileBrandToggle');
  assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.ok(document.querySelector('#tonyMobileBrandSettings #btnRatioSquare'));
  toggle.click();
  assert.equal(toggle.getAttribute('aria-expanded'),'true');
  dom.window.close();
});
