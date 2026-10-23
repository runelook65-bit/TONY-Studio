const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/article.js');

function invoke(method, url, body) {
  let code = 200;
  const headers = {};
  const res = {
    setHeader(name,value) { headers[name.toLowerCase()] = value; },
    status(value) { code = value; return res; },
    json(value) { return { code, data:value, headers }; }
  };
  return handler({ method, query: url ? {url} : {}, body },res);
}
test('imports metadata, NYC borough and topic, leaving story unverified',async () => {
  const old = global.fetch;
  global.fetch = async () => new Response(
    '<html><head><meta property="og:title" content="MTA announces L train repairs in Brooklyn">' +
    '<meta property="og:description" content="Service changes are scheduled for the Brooklyn section of the L train.">' +
    '<meta property="article:published_time" content="2026-10-23T12:00:00Z">' +
    '<meta property="og:site_name" content="Local News"><meta property="og:image" content="https://img.example.com/photo.jpg"></head></html>',
    {headers:{'content-type':'text/html; charset=utf-8'}}
  );
  try {
    const r = await invoke('GET','https://gothamist.com/news/l-train');
    assert.equal(r.code,200);
    assert.equal(r.data.region,'BROOKLYN');
    assert.equal(r.data.category,'TRANSIT');
    assert.equal(r.data.verificationStatus,'needs-review');
    assert.equal(r.data.imageRights,'unknown');
    assert.equal(r.data.sourceUrl,'https://gothamist.com/news/l-train');
    assert.equal(r.data.publishedAt,'2026-10-23T12:00:00.000Z');
  } finally {global.fetch = old;}
});
test('rejects non-allowlisted or local hosts before any request',async () => {
  assert.equal((await invoke('GET','https://127.0.0.1/private')).code,400);
  assert.equal((await invoke('GET','http://gothamist.com/news/abc')).code,400);
  assert.equal((await invoke('GET','https://gothamist.com.evil.test/news')).code,400);
});
test('rejects redirects outside approved sources',async () => {
  const old = global.fetch;
  global.fetch = async () => new Response('',{status:302,headers:{location:'http://127.0.0.1/' }});
  try { assert.equal((await invoke('GET','https://gothamist.com/news/abc')).code,400); }
  finally {global.fetch=old;}
});
test('requires method and url',async () => {
  assert.equal((await invoke('PUT','https://gothamist.com/')).code,405);
  assert.equal((await invoke('GET','')).code,400);
});
