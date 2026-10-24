const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM} = require('jsdom');
const js = fs.readFileSync(path.join(__dirname,'../assets/editor-effects.js'),'utf8');
const index = fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const newsroom = fs.readFileSync(path.join(__dirname,'../assets/newsroom.js'),'utf8');
const logo = fs.readFileSync(path.join(__dirname,'../assets/tony-logo.svg'),'utf8');

function fixture() {
 const dom = new JSDOM('<!doctype html><html><body>'+
 '<div class="bg-[#121216]"><label id="dropZone">Drop a photo</label></div>'+
 '<div class="bg-[#121216]"><div class="grid"><div><input id="brandTitleInput"/></div></div></div>'+
 '</body></html>',{runScripts:'outside-only',url:'https://tony-studio-lmeo.vercel.app'});
 const w=dom.window;let renders=0;
 w.TONYStudio={state:{photoFilter:'gotham',filterIntensity:70,brandLogoMode:'logo',brandLogoSize:120},renderCanvas:()=>renders++};
 w.eval(js);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 return {w,dom,getRenders:()=>renders};
}
test('original photo intensity 0 is neutral and cinema filter is noticeable',()=>{
 const {w,dom}=fixture();
 const fx=w.TONYEffects;
 assert.equal(Object.keys(fx.FILTERS).length,6);
 assert.equal(fx.getGrade('gotham',0).alpha,0);
 assert.match(fx.getGrade('original',100).filter,/contrast\(1.000\)/);
 assert.ok(fx.getGrade('midnight',100).filter.includes('brightness(0.810)'));
 assert.ok(fx.getGrade('taxi',70).alpha>0);
 dom.window.close();
});
test('filter controls actually set shared state and redraw',()=>{
 const {w,dom,getRenders}=fixture(),d=w.document;
 assert.equal(d.querySelectorAll('[data-tony-filter]').length,6);
 assert.equal(d.querySelector('[data-tony-filter="gotham"]').getAttribute('aria-pressed'),'true');
 d.querySelector('[data-tony-filter="taxi"]').click();
 assert.equal(w.TONYStudio.state.photoFilter,'taxi');
 const slider=d.getElementById('tonyFilterStrength');
 slider.value='35';slider.dispatchEvent(new w.Event('input'));
 assert.equal(w.TONYStudio.state.filterIntensity,35);
 assert.equal(d.getElementById('tonyFilterStrengthValue').textContent,'35%');
 d.getElementById('tonyFilterReset').click();
 assert.equal(w.TONYStudio.state.photoFilter,'original');
 assert.equal(w.TONYStudio.state.filterIntensity,0);
 assert.ok(getRenders()>3);
 dom.window.close();
});
test('logo controls default small, toggle and adjust size without affecting photos',()=>{
 const {w,dom}=fixture(),d=w.document;
 assert.equal(d.getElementById('tonyLogoMode').value,'logo');
 assert.equal(d.getElementById('tonyLogoSize').value,'120');
 assert.equal(d.getElementById('tonyWordmarkFields').hidden,true);
 const mode=d.getElementById('tonyLogoMode');
 mode.value='wordmark';mode.dispatchEvent(new w.Event('change'));
 assert.equal(w.TONYStudio.state.brandLogoMode,'wordmark');
 assert.equal(d.getElementById('tonyWordmarkFields').hidden,false);
 mode.value='logo';mode.dispatchEvent(new w.Event('change'));
 const slider=d.getElementById('tonyLogoSize');
 slider.value='96';slider.dispatchEvent(new w.Event('input'));
 assert.equal(w.TONYStudio.state.brandLogoSize,96);
 dom.window.close();
});
test('canvas grading touches photograph only and restores canvas context',()=>{
 const {w,dom}=fixture();
 const seen=[];const ctx={
  canvas:{width:1080,height:1080},filter:'none',globalAlpha:1,
  save(){seen.push('save')},restore(){seen.push('restore')},
  drawImage(){seen.push('image:'+this.filter)},
  fillRect(){seen.push('tint:'+this.globalCompositeOperation)}
 };
 w.TONYEffects.drawPhoto(ctx,{},0,0,1080,1080,'hudson',85);
 assert.ok(seen.some(x=>x.includes('image:contrast(')));
 assert.ok(seen.includes('tint:soft-light'));
 assert.equal(seen.filter(x=>x==='save').length,seen.filter(x=>x==='restore').length);
 dom.window.close();
});
test('real canvas and local drafts share the filter and logo settings',()=>{
 assert.match(index,/window\.TONYEffects\.drawPhoto\(/);
 assert.match(index,/tonyBrandLogoImg/);
 assert.match(index,/logoSize = Math\.max\(80, Math\.min\(160/);
 assert.match(index,/ctx\.clip\(\)/);
 assert.match(index,/src="\/assets\/editor-effects\.js/);
 for(const key of ['photoFilter','filterIntensity','brandLogoMode','brandLogoSize']){
  assert.match(index,new RegExp(key+': state\\.'+key));
  assert.match(newsroom,new RegExp(key+':s\\.'+key));
 }
 assert.match(logo,/viewBox="0 0 200 200"/);
 assert.match(logo,/TONY\. The Only New York logo/);
});
