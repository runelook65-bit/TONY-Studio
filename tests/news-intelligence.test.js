const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const EDGE=fs.readFileSync(path.join(__dirname,'../supabase/functions/tony-news-radar/index.ts'),'utf8');
const RADAR=fs.readFileSync(path.join(__dirname,'../assets/breaking-radar.js'),'utf8');
const MIGRATION=fs.readFileSync(path.join(__dirname,'../supabase/migrations/202611250001_phase1_news_intelligence.sql'),'utf8');

test('NYC source set includes established local and regional publishers',()=>{
 for(const source of ['Gothamist','THE CITY','City Limits','Hell Gate','PIX11','amNewYork','The New York Times','NY1'])assert.ok(EDGE.includes(source),source);
 assert.ok(EDGE.includes('https://www.ny1.com/services/contentfeed.nyc%7Call-boroughs%7Cnews.landing.rss'));
 assert.ok(EDGE.includes('https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/section/nyregion/rss.xml'));
});
test('editorial score uses the six agreed weighted dimensions',()=>{
 for(const field of ['impact','recency','public_interest','source_support','visual_potential','discussion_potential'])assert.ok(EDGE.includes(field),field);
 assert.match(EDGE,/sourceCount>=3\?15:sourceCount===2\?10:5/);
 assert.match(EDGE,/src\.weight<7/);
 assert.match(EDGE,/source_confidence/);
});
test('corroboration is counted by distinct publisher, not raw feed items',()=>{
 assert.match(EDGE,/!match\.supporting_sources\.some\(x=>x\.source_name===c\.source_name\)/);
 assert.match(EDGE,/scoreParts\(match\.headline/);
});
test('queue API returns score details and the UI displays source confidence',()=>{
 assert.match(EDGE,/score_breakdown,source_confidence/);
 assert.match(RADAR,/Publisher trust /);
 assert.match(RADAR,/Scheduled ingestion every 3 hours/);
});
test('schedule migration alters the existing job instead of creating a duplicate',()=>{
 assert.match(MIGRATION,/cron\.alter_job/);
 assert.match(MIGRATION,/0 \*\/3 \* \* \*/);
 assert.doesNotMatch(MIGRATION,/cron\.schedule\(/);
});
