const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const logo=read('assets/tony-logo.svg');
const index=read('index.html');

test('uploaded TONY Gotham identity is embedded in the card logo asset',()=>{
 assert.match(logo,/aria-label="TONY\. The Only New York logo"/);
 assert.match(logo,/data:image\/webp;base64,/);
 assert.match(logo,/viewBox="0 0 200 200"/);
});

test('news graphic uses the shared TONY logo with a visible default size',()=>{
 assert.match(index,/id="tonyBrandLogoImg" src="\/assets\/tony-logo\.svg"/);
 assert.match(index,/brandLogoSize: 160/);
 assert.match(index,/ctx\.drawImage\(tonyLogo, padX, 54, logoSize, logoSize\)/);
});
