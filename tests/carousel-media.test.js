const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const carousel = require('../assets/carousel-studio.js');
const media = require('../assets/carousel-media.js');
const html = fs.readFileSync(path.join(__dirname, '../index.html'),'utf8');
const newsroom = fs.readFileSync(path.join(__dirname,'../assets/newsroom.js'),'utf8');
const mobile = fs.readFileSync(path.join(__dirname,'../assets/mobile.css'),'utf8');

function verifiedState() {
  return {
    headline:'City agency releases a verified transit update', summary:'A confirmed public document explains the schedule.',
    sourceUrl:'https://www.nyc.gov/site/example/updates.page',
    verificationStatus:'official-source', imagePermission:'original',
    imageCredit:'TONY newsroom',photoKind:'manual',
    activeImage:{naturalWidth:2000,naturalHeight:1000,complete:true},
    layoutVariant:'classic', focusX:50, focusY:50, panX:8,panY:-3, zoom:115,
    carouselSlides:carousel.normalizeSlides([
      {headline:'What riders need to know',summary:'Details from the city release.'},
      {headline:'What happens next',summary:'Published next steps and timeline.'}
    ])
  };
}

test('slide IDs survive normalization, reordering and browser storage; image rights are not persisted', () => {
  const state=verifiedState();
  const id=state.carouselSlides[0].id;
  state.carouselSlides[0].imagePermission='licensed';
  state.carouselSlides[0].imageCredit='Some Photographer';
  state.carouselSlides[0].focusX=85;
  const copy=carousel.normalizeSlides(state.carouselSlides);
  assert.equal(copy[0].id,id);
  assert.equal(copy[0].focusX,85);
  const stored=carousel.serializeSlides(state.carouselSlides);
  assert.equal(stored[0].id,id);
  assert.equal(stored[0].focusX,85);
  assert.ok(!Object.hasOwn(stored[0],'imagePermission'));
  assert.ok(!Object.hasOwn(stored[0],'imageCredit'));
  assert.ok(!Object.hasOwn(stored[0],'imageRef'));
  assert.equal(carousel.normalizeSlides(stored)[0].imagePermission,'unknown');
  const dup=carousel.normalizeSlides([{id:'duplicate'},{id:'duplicate'}]);
  assert.notEqual(dup[0].id,dup[1].id);
});

test('carousel export blocks unverified story, unreviewed media and uncredited licensed images', () => {
  media.clear();
  const state=verifiedState();
  assert.equal(media.exportWarning(state),null);
  state.verificationStatus='needs-review';
  assert.match(media.exportWarning(state),/Cross-check/);
  state.verificationStatus='official-source';
  state.sourceUrl='http://nyc.gov/story';
  assert.match(media.exportWarning(state),/HTTPS/);
  state.sourceUrl='https://www.nyc.gov/story';
  state.imagePermission='unknown';
  assert.match(media.exportWarning(state),/cover photo rights/);
  state.imagePermission='licensed';state.imageCredit='';
  assert.match(media.exportWarning(state),/credit for the cover/);
  state.imagePermission='original';
  const id=state.carouselSlides[0].id;
  const photo={naturalWidth:1500,naturalHeight:1000,complete:true};
  media.putImage(id,photo);
  assert.equal(media.getImage(id),photo);
  assert.match(media.exportWarning(state),/Page 2/);
  state.carouselSlides[0].imagePermission='licensed';
  assert.match(media.exportWarning(state),/photographer/);
  state.carouselSlides[0].imageCredit='City archive / license reviewed';
  assert.equal(media.exportWarning(state),null);
  state.imagePermission='ai-generated';state.photoKind='ai';
  assert.equal(media.exportWarning(state),null);
  state.imagePermission='original';
  assert.match(media.exportWarning(state),/AI-generated cover/);
  media.clear();
  assert.equal(media.getImage(id),null);
});

test('editorial ZIP contains source and per-slide photo credits in a readable sidecar file', () => {
  media.clear();
  const state=verifiedState();
  const id=state.carouselSlides[0].id;
  media.putImage(id,{naturalWidth:2000,naturalHeight:2000});
  state.carouselSlides[0].imagePermission='licensed';
  state.carouselSlides[0].imageCredit='Jane Doe, CC BY 4.0';
  const notes=carousel.buildEditorialNotes(state,media);
  assert.match(notes,/TONY - THE ONLY NEW YORK/);
  assert.match(notes,/Page 2 image credit: Jane Doe, CC BY 4\.0/);
  assert.match(notes,/Article: https:\/\/www\.nyc\.gov/);
  const png=Uint8Array.from([137,80,78,71,13,10,26,10,1,2,3,4]);
  const zip=carousel.zipPngFiles([{bytes:png},{bytes:png}],notes);
  const dv=new DataView(zip.buffer);
  const end=zip.length-22;
  assert.equal(dv.getUint16(end+10,true),3);
  const text=new TextDecoder().decode(zip);
  assert.match(text,/TONY-image-credits\.txt/);
  assert.match(text,/Jane Doe, CC BY 4\.0/);
  media.clear();
});

test('the carousel editor renders different slide images without changing cover state',()=>{
  media.clear();
  const dom=new JSDOM('<!doctype html><html><body>' +
    '<div id="actions"><button id="btnDownloadPNG"></button></div></body></html>',
    {runScripts:'outside-only',url:'https://tony-studio-lmeo.vercel.app'});
  const w=dom.window;
  w.TextEncoder=TextEncoder;
  const state=verifiedState();
  const imagesSeen=[];
  const app={state,canvas:{width:1080,height:1080,toDataURL:()=> 'data:image/png;base64,YQ=='},
    renderCanvas:()=>imagesSeen.push({
      img:state.activeImage,
      headline:state.headline,
      layout:state.layoutVariant,
      photoKind:state.photoKind,
      focus:state.focusX
    })};
  w.TONYStudio=app;
  w.eval(fs.readFileSync(path.join(__dirname,'../assets/carousel-studio.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(__dirname,'../assets/carousel-media.js'),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  assert.ok(w.document.getElementById('tonyCarouselMediaPanel'));
  const cover=state.activeImage, coverHeadline=state.headline;
  const second=state.carouselSlides[0];
  const other={naturalWidth:2000,naturalHeight:2000,complete:true};
  w.TONYCarouselMedia.putImage(second.id,other);
  second.layoutVariant='metro';
  second.focusX=85;
  second.imagePermission='ai-generated';
  const snapshot=w.TONYCarousel.withPage(app,1,3,()=>({
    photo:state.activeImage,kind:state.photoKind,layout:state.layoutVariant,headline:state.headline,focus:state.focusX
  }));
  assert.equal(snapshot.photo,other);
  assert.equal(snapshot.kind,'ai');
  assert.equal(snapshot.layout,'metro');
  assert.equal(snapshot.focus,85);
  assert.equal(snapshot.headline,'What riders need to know');
  assert.equal(state.activeImage,cover);
  assert.equal(state.headline,coverHeadline);
  assert.equal(state.layoutVariant,'classic');
  assert.equal(state.focusX,50);
  assert.equal(state.panX,8);
  assert.ok(imagesSeen.some(entry=>entry.img===other));
  assert.ok(imagesSeen.at(-1).img===cover);
  const pageIds=state.carouselSlides.map(s=>s.id);
  w.document.getElementById('tonyCarouselPages').querySelectorAll('button')[1].click();
  const layoutSelect=w.document.getElementById('tonyCarouselSlideLayout');
  layoutSelect.value='bulletin';layoutSelect.dispatchEvent(new w.Event('change'));
  assert.equal(state.carouselSlides[0].layoutVariant,'bulletin');
  w.document.getElementById('tonyCarouselMoveRight').click();
  assert.equal(state.carouselSlides[1].id,pageIds[0]);
  assert.equal(w.TONYCarouselMedia.getImage(pageIds[0]),other);
  assert.equal(w.TONYCarousel.currentIndex(),2);
  w.document.getElementById('tonyCarouselRemove').click();
  assert.equal(w.TONYCarouselMedia.getImage(pageIds[0]),null);
  dom.window.close();
  media.clear();
});

test('carousel modules are wired into the editor and mobile tap targets',()=>{
  assert.match(html,/assets\/carousel-media\.js/);
  assert.match(html,/window\.TONYCarouselMedia\?\.clear\(\)/);
  assert.match(html,/window\.TONYCarouselMedia\?\.clear\(\)/);
  assert.match(newsroom,/serializeSlides/);
  assert.match(mobile,/#tonyCarouselPanel/);
  assert.match(mobile,/min-height: 44px/);
});
