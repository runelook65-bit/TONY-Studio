const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const creative = require('../assets/creative-suite.js');
const carousel = require('../assets/carousel-studio.js');
const index = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const newsroom = fs.readFileSync(path.join(__dirname,'../assets/newsroom.js'),'utf8');

test('cover crop remains within bounds across portrait, square and landscape formats', () => {
  for (const image of [[4000,2000],[2000,4000],[1080,1080]]) {
    for (const canvas of [[1080,1080],[1080,1350]]) {
      for (const x of [0,50,100]) for (const y of [0,50,100]) {
        const p = creative.photoPlacement(...image,...canvas,110,x,y,100000,-100000);
        assert.ok(p && p.width >= canvas[0] && p.height >= canvas[1]);
        assert.ok(p.x <= 0 && p.x + p.width >= canvas[0] - 0.001);
        assert.ok(p.y <= 0 && p.y + p.height >= canvas[1] - 0.001);
      }
    }
  }
  assert.equal(creative.photoPlacement(0,200,1080,1080,100,50,50,0,0),null);
  const left = creative.photoPlacement(2000,1000,1080,1080,100,0,50,0,0);
  const right = creative.photoPlacement(2000,1000,1080,1080,100,100,50,0,0);
  assert.ok(left.x > right.x);
});
test('template selection preserves classic canvas and paints distinct editorial frames', () => {
  const ctx = {
    calls:[], save(){this.calls.push('save')}, restore(){this.calls.push('restore')},
    fillRect(...args){this.calls.push(['fill', ...args])},
    strokeRect(...args){this.calls.push(['stroke',...args])},
    fillText(...args){this.calls.push(['text',...args])}
  };
  creative.paintFrame(ctx,{layoutVariant:'classic'},1080,1350);
  assert.equal(ctx.calls.length,2,'canvas context must be balanced');
  ctx.calls = [];
  creative.paintFrame(ctx,{layoutVariant:'metro'},1080,1350);
  assert.ok(ctx.calls.filter(v=>Array.isArray(v)).length >= 3);
  ctx.calls = [];
  creative.paintFrame(ctx,{layoutVariant:'bulletin'},1080,1350);
  assert.ok(ctx.calls.some(v=>Array.isArray(v) && v[0] === 'stroke'));
  ctx.calls = [];
  creative.paintFrame(ctx,{layoutVariant:'classic',_tonyExportSlide:{index:2,total:4}},1080,1350);
  assert.ok(ctx.calls.some(v=>Array.isArray(v) && v[0] === 'text' && v[1] === '02 / 04'));
});
test('focal and layout controls operate on shared editor state', () => {
  const dom = new JSDOM('<!doctype html><body><section><label id="dropZone"></label></section></body>',
    {runScripts:'outside-only',url:'https://tony-studio-lmeo.vercel.app'});
  const w = dom.window;
  let renders = 0;
  w.TONYStudio={state:{zoom:100,panX:15,panY:-8},renderCanvas:()=>{renders++;}};
  w.eval(fs.readFileSync(path.join(__dirname,'../assets/creative-suite.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const layout = w.document.querySelector('[data-tony-layout="metro"]');
  assert.ok(layout);
  layout.click();
  assert.equal(w.TONYStudio.state.layoutVariant,'metro');
  assert.equal(layout.getAttribute('aria-pressed'),'true');
  const range = w.document.getElementById('tonyFocusX');
  range.value='80';range.dispatchEvent(new w.Event('input'));
  assert.equal(w.TONYStudio.state.focusX,80);
  assert.equal(w.TONYStudio.state.panX,0);
  w.document.getElementById('tonyFocusReset').click();
  assert.equal(w.TONYStudio.state.focusX,50);
  assert.ok(renders >= 3);
  dom.window.close();
});
test('carousel pages have editorial validation and never inherit extra slides', () => {
  const state={headline:'NYC board approves a new neighborhood project',summary:'The decision was recorded at a public session.',carouselSlides:[]};
  assert.match(carousel.validatePages(state),/Add at least one/);
  state.carouselSlides=[{headline:'What changes next',summary:'The timetable was published by the agency.'}];
  assert.equal(carousel.validatePages(state),null);
  state.carouselSlides[0].summary='';
  assert.match(carousel.validatePages(state),/Page 2/);
  state.carouselSlides[0].summary='Restored context';
  assert.equal(carousel.pagesFromState(state).length,2);
  assert.equal(carousel.normalizeSlides([{headline:3,summary:null}])[0].headline,'');
  assert.equal(carousel.normalizeSlides(Array(18).fill({headline:'X',summary:'Y'})).length,5);
});
test('ZIP archive uses standard uncompressed PNG entries with valid CRC and directory offsets', () => {
  assert.equal(carousel.crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,4]);
  const zip = carousel.zipPngFiles([{bytes:png},{bytes:png}]);
  const dv = new DataView(zip.buffer);
  assert.equal(dv.getUint32(0,true),0x04034b50);
  const nameLen = dv.getUint16(26,true);
  const name = new TextDecoder().decode(zip.subarray(30,30+nameLen));
  assert.equal(name,'TONY-slide-01.png');
  assert.equal(dv.getUint32(14,true),carousel.crc32(png));
  const endOffset = zip.length - 22;
  assert.equal(dv.getUint32(endOffset,true),0x06054b50);
  assert.equal(dv.getUint16(endOffset+10,true),2);
  const centralStart = dv.getUint32(endOffset+16,true);
  assert.equal(dv.getUint32(centralStart,true),0x02014b50);
  assert.throws(()=>carousel.zipPngFiles([{bytes:png}]),/2–6/);
  assert.throws(()=>carousel.zipPngFiles([{bytes:new Uint8Array(10)},{bytes:png}]),/not a PNG/);
});
test('carousel UI edits slides but never changes original headline during preview', () => {
  const dom = new JSDOM('<!doctype html><body><div id="actions"><button id="btnDownloadPNG"></button></div></body>',
    {runScripts:'outside-only',url:'https://tony-studio-lmeo.vercel.app'});
  const w=dom.window;
  w.TextEncoder=TextEncoder;
  let renders=0;
  const original='Verified city headline';
  w.TONYStudio={state:{headline:original,summary:'Verified source summary',carouselSlides:[]},
    canvas:{toDataURL:()=> 'data:image/jpeg;base64,YWJj'},renderCanvas:()=>{renders++;}};
  w.eval(fs.readFileSync(path.join(__dirname,'../assets/carousel-studio.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.ok(w.document.getElementById('tonyCarouselPanel'));
  w.document.getElementById('tonyCarouselAdd').click();
  assert.equal(w.TONYStudio.state.carouselSlides.length,1);
  const h=w.document.getElementById('tonyCarouselHeadline');
  const s=w.document.getElementById('tonyCarouselSummary');
  h.value='What happens next';h.dispatchEvent(new w.Event('input'));
  s.value='Verified public documents';s.dispatchEvent(new w.Event('input'));
  w.document.getElementById('tonyCarouselRefresh').click();
  assert.equal(w.TONYStudio.state.headline,original);
  assert.equal(w.TONYStudio.state.carouselSlides[0].headline,'What happens next');
  assert.ok(renders>=3);
  w.document.getElementById('tonyCarouselRemove').click();
  assert.equal(w.TONYStudio.state.carouselSlides.length,0);
  dom.window.close();
});
test('actual editor and draft paths wire layouts, photo focus, carousel and original brand controls',()=>{
  for(const script of ['creative-suite','carousel-studio']){
    assert.match(index,new RegExp('src="/assets/'+script.replace('-','\\-')+'\\.js'));
  }
  assert.match(index,/window\.TONYCreative\?\.photoPlacement/);
  assert.match(index,/window\.TONYCreative\?\.paintFrame/);
  assert.match(index,/carouselSlides: window\.TONYCarousel\?\.normalizeSlides/);
  assert.match(index,/state\.carouselSlides = \[\]/);
  assert.match(newsroom,/carouselSlides:window\.TONYCarousel\?\.serializeSlides/);
  assert.match(newsroom,/app\.state\.carouselSlides = window\.TONYCarousel\?\.normalizeSlides/);
  assert.match(index,/window\.TONYTypography\.fitHeadline/);
});
