const test=require('node:test');
const assert=require('node:assert/strict');
const lib=require('../lib/instagram');
const access=require('../api/instagram/access');
const connect=require('../api/instagram/connect');
const publish=require('../api/instagram/publish');

function env(){
 process.env.INSTAGRAM_APP_ID='123456789';
 process.env.INSTAGRAM_APP_SECRET='test-only-not-a-real-app-secret';
 process.env.INSTAGRAM_REDIRECT_URI='https://tony-studio-lmeo.vercel.app/api/instagram/callback';
 process.env.TONY_SESSION_SECRET='long-test-only-session-secret-do-not-deploy-123456789';
 process.env.TONY_ADMIN_PASSWORD='long-test-only-admin-password-not-for-real';
 process.env.BLOB_READ_WRITE_TOKEN='test-only-blob';
}
function response(){
 const headers={};let code=200;
 const res={
  setHeader(k,v){headers[k.toLowerCase()]=v;},
  getHeader(k){return headers[k.toLowerCase()];},
  status(n){code=n;return res;},
  json(data){return {code,data,headers};},
  redirect(n,url){return {code:n,redirect:url,headers};}
 };
 return res;
}
function request(method,body={},cookie='',origin='https://tony-studio-lmeo.vercel.app'){
 return {method,body,query:{},headers:{origin,cookie}};
}
function adminCookie(){
 return lib.ADMIN_COOKIE+'='+lib.encode({kind:'admin',until:Date.now()+60000});
}
function userCookie(){
 return lib.SESSION_COOKIE+'='+lib.encode({kind:'instagram',until:Date.now()+60000,id:'123123123',username:'theonlynewyork',accountType:'BUSINESS',token:'token-placeholder'});
}
test('encrypted cookies expire and reject tampering',()=>{
 env();const token=lib.encode({kind:'admin',until:Date.now()+60000});
 assert.equal(lib.decode(token).kind,'admin');
 assert.equal(lib.decode(token.slice(0,-5)+'xxxxx'),null);
 assert.equal(lib.decode(lib.encode({kind:'admin',until:Date.now()-1})),null);
});
test('unlock requires same origin, configured secrets and correct password',async()=>{
 env();
 let result=await access(request('POST',{password:process.env.TONY_ADMIN_PASSWORD},'','https://evil.example'),response());
 assert.equal(result.code,403);
 result=await access(request('POST',{password:'wrong-password'}),response());
 assert.equal(result.code,401);
 result=await access(request('POST',{password:process.env.TONY_ADMIN_PASSWORD}),response());
 assert.equal(result.code,200);
 assert.ok(result.headers['set-cookie'].some(c=>c.includes('__Host-tony_admin=')));
 assert.ok(result.headers['set-cookie'].every(c=>c.includes('HttpOnly')&&c.includes('Secure')));
});
test('OAuth link requests only business profile + content publishing scopes',async()=>{
 env();
 const result=await connect(request('GET',{},adminCookie()),response());
 assert.equal(result.code,302);
 const url=new URL(result.redirect);
 assert.equal(url.host,'www.instagram.com');
 assert.equal(url.searchParams.get('scope'),'instagram_business_basic,instagram_business_content_publish');
 assert.equal(url.searchParams.get('redirect_uri'),process.env.INSTAGRAM_REDIRECT_URI);
 assert.ok(result.headers['set-cookie'].some(c=>c.includes('__Host-tony_ig_state=')));
});
test('publishing rejects unauthenticated requests before touching Meta or Blob',async()=>{
 env();
 const result=await publish(request('POST',{caption:'Headline'}),response());
 assert.equal(result.code,401);
});
test('publishing validates rights, sources and JPEG before upload',async()=>{
 env();
 const cookie=adminCookie()+'; '+userCookie();
 let result=await publish(request('POST',{caption:'sample',sourceUrl:'https://gothamist.com/news/abc',verificationStatus:'needs-review',imagePermission:'original',imageData:'data:image/jpeg;base64,AA=='},cookie),response());
 assert.equal(result.code,422);
 assert.match(result.data.error,/Verify/);
 result=await publish(request('POST',{caption:'sample',sourceUrl:'https://gothamist.com/news/abc',verificationStatus:'cross-checked',imagePermission:'unknown',imageData:'data:image/jpeg;base64,AA=='},cookie),response());
 assert.equal(result.code,422);
 assert.match(result.data.error,/rights/);
});
