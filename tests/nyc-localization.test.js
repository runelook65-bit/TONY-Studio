const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const mobile=fs.readFileSync(path.join(__dirname,'../assets/mobile.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/mobile.css'),'utf8');
const newsroom=fs.readFileSync(path.join(__dirname,'../assets/newsroom.js'),'utf8');
const ig=fs.readFileSync(path.join(__dirname,'../assets/instagram.js'),'utf8');

test('inline canvas code is valid JavaScript',()=>{
 const source=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(source,'Inline canvas script should exist');
 assert.doesNotThrow(()=>new vm.Script(source[1],{filename:'index.html'}));
});
test('newsroom uses English and does not offer Turkish presets',()=>{
 assert.match(html,/<html lang="en-US"/);
 assert.doesNotMatch(html,/<button[^>]*data-badge="(?:SON DAKİKA|ŞEHİR YAŞAMI|ULAŞIM|ANALİZ)"/);
 assert.doesNotMatch(html,/data-region="(?:İSTANBUL|ANKARA|İZMİR|TÜRKİYE GENELİ)"/);
 assert.doesNotMatch(html,/id="btnPresetTR"|id="btnDateLangTR"/);
 for(const category of ['BREAKING','TRANSIT','POLITICS','PUBLIC SAFETY','HOUSING','CITY LIFE','WEATHER','BUSINESS']) {
   assert.match(html,new RegExp('data-badge="'+category+'"'));
 }
});
test('NYC five boroughs and city-wide option are directly selectable',()=>{
 for(const borough of ['NEW YORK CITY','MANHATTAN','BROOKLYN','QUEENS','BRONX','STATEN ISLAND']) {
   assert.match(html,new RegExp('data-region="'+borough+'"'));
 }
 assert.match(html,/id="regionInput"[^>]*value="NEW YORK CITY"/);
 assert.match(html,/id="badgeTextInput"[^>]*value="NYC NEWS"/);
});
test('US clock formatting is explicit and updates with canvas render',()=>{
 assert.match(html,/id="tonyFormattedDate"/);
 assert.match(html,/America\/New_York/);
 assert.match(html,/dateLabel\.textContent = formatDateTimeDisplay\(\)/);
 assert.match(html,/type="date" lang="en-US"/);
 const months=html.match(/const MONTHS_EN = ([^;]+);/);
 const fmt=html.match(/function formatDateTimeDisplay\(\) \{[\s\S]*?\n    \}/);
 assert.ok(months&&fmt);
 const context={state:{dateValue:'2026-10-23',timeValue:'14:16',showTime:true}};
 vm.runInNewContext('const MONTHS_EN = '+months[1]+';\n'+fmt[0]+';\nresult=formatDateTimeDisplay();',context);
 assert.equal(context.result,'OCT 23, 2026 · 2:16 PM ET');
});
test('all visible text and dynamic UI messages are American English',()=>{
 const beforeInline=html.split('  <script>')[0]
   .replace(/<!--[\s\S]*?-->/g,'')
   .replace(/src="data:image\/[^"]*"/g,'src=""');
 const tr=/[çğıöşüÇĞİÖŞÜ]/;
 assert.doesNotMatch(beforeInline,tr);
 for(const script of [newsroom,ig,mobile])assert.doesNotMatch(script,tr);
 assert.doesNotMatch(css,/İSTANBUL|ANKARA|İZMİR|TÜRKİYE GENELİ|SON DAKİKA/);
 assert.match(mobile,/>Design<\/button>/);
 assert.match(mobile,/>Publish<\/button>/);
});
