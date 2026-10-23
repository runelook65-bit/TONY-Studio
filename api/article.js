'use strict';

// TONY Studio: NYC article metadata import (not a fact-checker).
// Only publicly reachable pages on a conservative source allowlist are fetched.
const APPROVED = [
  'gothamist.com','thecity.nyc','nytimes.com','nbcnewyork.com','abc7ny.com',
  'fox5ny.com','pix11.com','amny.com','nypost.com','wnyc.org','nyc.gov',
  'mta.info','ny1.com','brooklynpaper.com','qns.com','silive.com',
  'bronxtimes.com','patch.com','reuters.com','apnews.com','timeout.com',
  'crainsnewyork.com','cbsnews.com','newyorker.com','citylimits.org',
  'bkreader.com','statenislandadvance.com','nydailynews.com'
];
const MAX_HTML = 800000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8500;

function allowedHostname(host) {
  return APPROVED.some(domain => host === domain || host.endsWith('.' + domain));
}
function validateUrl(raw) {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password ||
      (u.port && u.port !== '443') || !allowedHostname(u.hostname.toLowerCase())) {
    throw new Error('Only HTTPS articles from approved NYC news and official sources are supported.');
  }
  return u;
}
async function fetchArticle(raw) {
  let u = validateUrl(raw);
  for (let n = 0; n <= MAX_REDIRECTS; n++) {
    const response = await fetch(u.toString(), {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'text/html,application/xhtml+xml;q=0.9', 'user-agent': 'Mozilla/5.0 (compatible; TONYStudio/1.0)' }
    });
    if (response.status >= 300 && response.status < 400) {
      const target = response.headers.get('location');
      if (!target) throw new Error('The news source returned an invalid redirect.');
      u = validateUrl(new URL(target, u).toString());
      continue;
    }
    if (!response.ok) throw new Error('The source returned HTTP ' + response.status + '. Try another source or enter the article manually.');
    const mime = response.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(mime)) throw new Error('The URL does not point to an HTML article.');
    const len = Number(response.headers.get('content-length') || 0);
    if (len > MAX_HTML) throw new Error('The source page is too large for automatic import.');
    if (!response.body) throw new Error('The source returned an empty document.');
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_HTML) throw new Error('The source page is too large for automatic import.');
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const data = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
    return { html: new TextDecoder('utf-8').decode(data), url: u.toString() };
  }
  throw new Error('Too many redirects.');
}
function decodeEntities(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp|ndash|mdash|hellip|rsquo|lsquo|ldquo|rdquo);/gi, (m, code) => {
    const map = {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”'};
    const lower = code.toLowerCase();
    if (lower[0] === '#') {
      const n = lower[1] === 'x' ? parseInt(lower.slice(2),16) : parseInt(lower.slice(1),10);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
    }
    return map[lower] || m;
  });
}
function clean(t, max=360) {
  return decodeEntities(String(t || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0,max);
}
function attrs(tag) {
  const ret = {};
  const re = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(tag))) ret[m[1].toLowerCase()] = decodeEntities(m[2] === undefined ? m[3] : m[2]);
  return ret;
}
function getMeta(html) {
  const meta = {};
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const a = attrs(tag);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content && !meta[key]) meta[key] = a.content;
  }
  return meta;
}
function getJsonLd(html) {
  const blocks = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const items = [];
  function gather(v) {
    if (!v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach(gather); return; }
    if (v['@graph']) gather(v['@graph']);
    if (/Article|NewsArticle|ReportageNewsArticle/i.test(String(v['@type'] || ''))) items.push(v);
  }
  for (const block of blocks.slice(0,12)) {
    try { gather(JSON.parse(block.replace(/^<script[^>]*>/i,'').replace(/<\/script>$/i,''))); } catch {}
  }
  return items[0] || {};
}
function matchBorough(text) {
  const found = [];
  const checks = [
    ['MANHATTAN',/\bmanhattan\b|\bharlem\b|\bupper east side\b|\blower east side\b|\btimes square\b/i],
    ['BROOKLYN',/\bbrooklyn\b|\bbed-stuy\b|\bbushwick\b|\bwilliamsburg\b|\bconey island\b/i],
    ['QUEENS',/\bqueens\b|\bflushing\b|\bastoria\b|\blong island city\b|\bjackson heights\b/i],
    ['BRONX',/\bbronx\b|\bmott haven\b|\briverdale\b/i],
    ['STATEN ISLAND',/\bstaten island\b|\bst\. george\b/i]
  ];
  for (const [name,re] of checks) if (re.test(text)) found.push(name);
  return found.length === 1 ? found[0] : 'NEW YORK CITY';
}
function classify(text) {
  const rules = [
    ['TRANSIT','#2563EB',/\bsubway\b|\bmta\b|\btrain\b|\bbus lane\b|\bcommut|\bcongestion pric/i],
    ['WEATHER','#0EA5E9',/\bweather\b|\bstorm\b|\bsnow\b|\brainfall\b|\bflood\b|\bheat wave\b/i],
    ['HOUSING','#8B5CF6',/\brent\b|\bhousing\b|\blandlord\b|\btenant\b|\bapartment\b|\baffordab/i],
    ['POLITICS','#16A34A',/\bmayor\b|\bcity council\b|\belection\b|\bgovernor\b|\blegislat|\bbudget\b/i],
    ['CITY LIFE','#FFC300',/\brestaurant\b|\bfood\b|\bpizza\b|\bpark\b|\bfestival\b|\bconcert\b|\bweekend\b|\bmuseum\b/i],
    ['PUBLIC SAFETY','#E11D2E',/\bpolice\b|\bnypd\b|\bfire\b|\bshooting\b|\baccident\b|\bemergency\b/i]
  ];
  for (const [tag,color,re] of rules) if (re.test(text)) return { tag, color };
  return { tag: 'NYC NEWS', color: '#FFC300' };
}
function getArticle(html, url) {
  const meta = getMeta(html);
  const ld = getJsonLd(html);
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = clean(meta['og:title'] || meta['twitter:title'] || ld.headline || (titleTag && titleTag[1]), 150)
    .replace(/\s+[|–-]\s+(?:The New York Times|Gothamist|NY Daily News|New York Post|NBC New York|THE CITY).*$/i,'');
  const paragraphs = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .map(m => clean(m[1],500)).filter(t => t.length > 75 && !/cookie policy|subscribe to|sign up for/i.test(t));
  const description = clean(meta['og:description'] || meta.description || ld.description || paragraphs[0], 360);
  const dateRaw = meta['article:published_time'] || meta.datepublished || meta.pubdate || ld.datePublished || '';
  const date = dateRaw && Number.isFinite(new Date(dateRaw).getTime()) ? new Date(dateRaw).toISOString() : null;
  const image = meta['og:image:secure_url'] || meta['og:image'] || meta['twitter:image'] || (typeof ld.image === 'string' ? ld.image : '');
  let imageUrl = null;
  try {
    const i = new URL(image, url);
    if (i.protocol === 'https:') imageUrl = i.toString();
  } catch {}
  const sourceName = clean(meta['og:site_name'] || (ld.publisher && ld.publisher.name) || new URL(url).hostname.replace(/^www\./,''), 80);
  const category = classify(title + ' ' + description);
  return {
    title: title || null, description: description || null, region: matchBorough(title + ' ' + description),
    category: category.tag, categoryColor: category.color, publishedAt: date, sourceName, sourceUrl: url,
    imageUrl, verificationStatus: 'needs-review', imageRights: 'unknown',
    extraction: 'metadata', note: 'Metadata is a draft, not an independently verified news report. Photo permissions must be reviewed.'
  };
}
module.exports = async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow','GET, POST'); return res.status(405).json({error:'Method not allowed.'});
  }
  const raw = req.method === 'POST' ? req.body && req.body.url : req.query && req.query.url;
  if (typeof raw !== 'string' || raw.length > 2000) return res.status(400).json({error:'A valid article URL is required.'});
  try {
    const fetched = await fetchArticle(raw);
    const article = getArticle(fetched.html,fetched.url);
    if (!article.title) return res.status(422).json({error:'Could not extract a headline. Please enter article details manually.'});
    return res.status(200).json(article);
  } catch(err) {
    const msg = err && err.message || 'Could not retrieve the article.';
    const code = /Only HTTPS|invalid URL|Too many redirects|valid article URL/i.test(msg) ? 400 : 422;
    return res.status(code).json({error:msg});
  }
};
