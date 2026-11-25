const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const index=read('index.html');
const theme=read('assets/brand-theme.js');
const radar=read('assets/breaking-radar.js');
const edge=read('supabase/functions/tony-news-radar/index.ts');
const css=read('assets/mobile.css');

test('TONY Gotham is a selectable secondary brand theme',()=>{
 assert.match(index,/brandTheme: 'gold'/);
 assert.match(index,/TONYBrandTheme\?\.paint\(ctx, state, W, H\)/);
 assert.match(index,/brand-theme\.js\?v=1/);
 assert.match(theme,/gotham:\{label:'TONY Gotham',accent:'#EF1B2D'/);
 assert.match(theme,/strokeRect\(18,18,width-36,height-36\)/);
 assert.match(theme,/data-tony-brand-theme="gotham"/);
 assert.match(theme,/data-tony-brand-theme="gold"/);
 assert.match(css,/\.tony-theme-option\.tony-theme-selected/);
});

test('Claude creates a fact-led 35–50 word graphic deck',()=>{
 assert.match(edge,/card_deck: 35–50 words for the graphic/);
 assert.match(edge,/Return only valid JSON with keys:[\s\S]{0,250}card_deck/);
 assert.match(edge,/required=\["card_deck","hook","script","caption","cta"\]/);
 assert.match(edge,/Claude card deck must contain 25–60 words/);
});

test('Radar imports the researched deck into the design canvas',()=>{
 assert.match(radar,/Graphic deck · 35–50 words/);
 assert.match(radar,/story\.ai_draft\?\.status==='generated'&&story\.ai_draft\?\.draft\?\.card_deck/);
});
