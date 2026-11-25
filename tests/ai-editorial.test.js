const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const radar=fs.readFileSync(path.join(__dirname,'../assets/breaking-radar.js'),'utf8');
const edge=fs.readFileSync(path.join(__dirname,'../supabase/functions/tony-news-radar/index.ts'),'utf8');
const migration=fs.readFileSync(path.join(__dirname,'../supabase/migrations/20261125005814_add_claude_editorial_drafts.sql'),'utf8');
const index=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('Claude research drafts are generated only server-side with a secret key',()=>{
  assert.match(edge,/Deno\.env\.get\("ANTHROPIC_API_KEY"\)/);
  assert.match(edge,/https:\/\/api\.anthropic\.com\/v1\/messages/);
  assert.match(edge,/web_search_20260318/);
  assert.match(edge,/max_uses:2/);
  assert.doesNotMatch(radar,/ANTHROPIC_API_KEY/);
});

test('draft generation is limited to one highest-ranked pending story per scheduled poll',()=>{
  assert.match(edge,/order=score\.desc,source_published_at\.desc&limit=1/);
  assert.match(edge,/const aiDraft=await generateTopDraft\(\)/);
  assert.match(edge,/ai_generation_status:"generated"/);
});

test('Claude drafts remain review-only and do not trigger publication',()=>{
  assert.match(edge,/Editor confirmation required; no posts were published/);
  assert.match(radar,/AI research and script are editorial drafts/);
  assert.match(radar,/CLAUDE DRAFT FAILED · CHECK LOGS/);
  assert.match(radar,/fact_check_checklist/);
  assert.match(radar,/navigator\.clipboard\.writeText/);
});

test('research citations and draft fields are stored in the newsroom record',()=>{
  assert.match(edge,/getResearchSources\(content\)/);
  assert.match(edge,/ai_draft:result/);
  assert.match(edge,/ai_generated_at/);
  assert.match(edge,/ai_model/);
  assert.match(migration,/ADD COLUMN IF NOT EXISTS ai_draft jsonb/);
  assert.match(migration,/ai_generation_status/);
});

test('Radar script cache is invalidated for the new editor UI',()=>{
  assert.match(index,/breaking-radar\.js\?v=3/);
});
