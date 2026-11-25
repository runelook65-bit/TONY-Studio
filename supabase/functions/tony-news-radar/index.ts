// TONY Breaking News Radar, scheduled in Supabase pg_cron (not Vercel Cron).
// Public GET returns only source-attributed article suggestions. POST requires a private cron token.
import { XMLParser } from "npm:fast-xml-parser@4.5.1";

const SOURCES = [
  {name:"Gothamist",url:"https://gothamist.com/feed",host:"gothamist.com",weight:8},
  {name:"THE CITY",url:"https://www.thecity.nyc/rss/index.xml",host:"thecity.nyc",weight:9},
  {name:"City Limits",url:"https://citylimits.org/feed/",host:"citylimits.org",weight:7},
  {name:"Hell Gate",url:"https://hellgatenyc.com/all-posts/rss",host:"hellgatenyc.com",weight:7},
  {name:"PIX11",url:"https://pix11.com/feed/",host:"pix11.com",weight:8},
  {name:"amNewYork",url:"https://www.amny.com/feed/",host:"amny.com",weight:7},
  {name:"The New York Times — New York",url:"https://www.nytimes.com/svc/collections/v1/publish/https://www.nytimes.com/section/nyregion/rss.xml",host:"nytimes.com",weight:9},
  {name:"NY1",url:"https://www.ny1.com/services/contentfeed.nyc%7Call-boroughs%7Cnews.landing.rss",host:"ny1.com",weight:9}
];
const BOROUGHS=[
 ["STATEN ISLAND",/\bstaten island\b|\bst\. george\b/i],
 ["BRONX",/\bbronx\b|\bhunts point\b|\bmott haven\b|\briverdale\b/i],
 ["QUEENS",/\bqueens\b|\bastoria\b|\bflushing\b|\blong island city\b|\bjackson heights\b/i],
 ["BROOKLYN",/\bbrooklyn\b|\bbushwick\b|\bwilliamsburg\b|\bbed[- ]stuy\b|\bcrown heights\b|\bconey island\b/i],
 ["MANHATTAN",/\bmanhattan\b|\bharlem\b|\bupper east side\b|\blower east side\b|\btimes square\b|\bmidtown\b/i]
] as const;
const TOPICS=[
 ["TRANSIT",/\bsubway\b|\btrain\b|\bmta\b|\bservice disruption\b|\bcommut(?:er|ing)\b|\bcongestion pricing\b/i],
 ["WEATHER",/\bweather\b|\bstorm\b|\bflood\b|\bsnow\b|\bheat wave\b|\bforecast\b/i],
 ["HOUSING",/\bhousing\b|\brent\b|\btenant\b|\blandlord\b|\bapartment\b|\beviction\b|\bnycha\b/i],
 ["POLITICS",/\bmayor\b|\bgovernor\b|\bcouncil\b|\belection\b|\blegislation\b|\bbudget\b/i],
 ["PUBLIC SAFETY",/\bnypd\b|\bfirefighter\b|\bshooting\b|\bpolice\b|\bcrash\b|\bemergency\b/i],
 ["BUSINESS",/\beconomy\b|\bjobs\b|\bworkforce\b|\bwages\b|\bbusiness\b|\bmarket\b/i],
 ["CITY LIFE",/\brestaurant\b|\bfestival\b|\bconcert\b|\bmuseum\b|\bpark\b|\bfood\b/i]
] as const;
const URGENT=/\b(breaking|just announced|emergency|evacuat(?:ed|ion)|shutdown|suspended|major delays|flood warning|fire|explosion|collapse|storm warning|massive outage|hazard)\b/i;
const SENSITIVE=/\b(shooting|killed|murder|homicide|suicide|assault|death|fatal|arrested|sexual|abuse|victim|child)\b/i;
const LOCAL=/\b(new york city|new yorkers|nyc|mta|nypd|nycha|bronx|queens|brooklyn|manhattan|staten island|harlem|city council|mayor)\b/i;
const DROP=new Set(["the","for","with","from","this","that","have","your","about","over","will","city","new","york","nyc","after","their","they","what","where","when","into","says","said"]);
const ALLOWED_ORIGINS=new Set([
 "https://tony-studio-lmeo.vercel.app",
 "https://tony-studio.vercel.app",
 "https://tony-studiov1.vercel.app"
]);
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
function corsHeaders(req:Request):Record<string,string>{
 const origin=req.headers.get("origin")||"";
 const headers:Record<string,string>={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store",
  "access-control-allow-methods":"GET, POST, OPTIONS",
  "access-control-allow-headers":"content-type, x-tony-cron",
  "vary":"Origin"
 };
 if(ALLOWED_ORIGINS.has(origin))headers["access-control-allow-origin"]=origin;
 return headers;
}
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:corsHeaders(req)});
function plain(input:unknown):string{
 const x=typeof input==="string"?input:typeof input==="object"&&input!==null?String((input as Record<string,unknown>)["#text"]||(input as Record<string,unknown>)["__cdata"]||""):String(input||"");
 return x.replace(/<[^>]*>/g," ").replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/gi,m=>({
 "&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'","&nbsp;":" ","&#39;":"'"
 } as Record<string,string>)[m.toLowerCase()]||m).replace(/\s+/g," ").trim();
}
function normalizeUrl(raw:unknown,host:string):string|null{
 try{
  const u=new URL(plain(raw));
  if(u.protocol!=="https:"||u.username||u.password||!(u.hostname===host||u.hostname==="www."+host))return null;
  u.hash="";for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid|gclid)/i.test(key))u.searchParams.delete(key);
  return u.href;
 }catch{return null;}
}
const words=(str:string)=>[...new Set(plain(str).toLowerCase().replace(/[^a-z0-9 ]+/g," ").split(/\s+/).filter(x=>x.length>3&&!DROP.has(x)))];
function scoreParts(text:string,hours:number,sourceCount:number,sourceWeight:number){
 const impact= /\b(evacuat|shutdown|major outage|fatal|killed|citywide|budget|mayor|housing crisis|strike|flood|storm warning|subway shutdown|mass transit)\b/i.test(text)?25:
  /\b(mta|subway|rent|tenant|school|hospital|election|city council|public safety|fire|police|business closure)\b/i.test(text)?18:12;
 const recency=hours<=1?20:hours<=3?17:hours<=8?13:hours<=24?8:3;
 const publicInterest=/\b(mayor|city council|citywide|rent|housing|subway|mta|school|hospital|election|budget|tax|public safety|nycha)\b/i.test(text)?20:
  /\b(queens|brooklyn|bronx|manhattan|staten island|commute|restaurant|park|small business)\b/i.test(text)?15:9;
 const sourceSupport=sourceCount>=3?15:sourceCount===2?10:5;
 const visual=/\b(fire|flood|snow|storm|subway|bridge|building|street|protest|parade|construction|airport|port|park|landmark)\b/i.test(text)?10:
  /\b(weather|transit|housing|restaurant|school|hospital)\b/i.test(text)?7:4;
 const discussion=/\b(election|mayor|rent|housing|tax|budget|protest|strike|police|school|immigration|congestion pricing)\b/i.test(text)?10:
  /\b(mta|business|education|health|development|climate)\b/i.test(text)?7:4;
 const sourceConfidence=Math.max(0,Math.min(100,sourceWeight*10));
 const score_breakdown={impact,recency,public_interest:publicInterest,source_support:sourceSupport,visual_potential:visual,discussion_potential:discussion};
 const score=Object.values(score_breakdown).reduce((sum,value)=>sum+value,0);
 return {score,score_breakdown,source_confidence:sourceConfidence};
}
function similar(a:string,b:string){
 const aw=words(a),bw=words(b);if(aw.length<3||bw.length<3)return 0;
 return aw.filter(x=>bw.includes(x)).length/Math.min(aw.length,bw.length);
}
type Candidate={headline:string;summary:string;source_name:string;source_url:string;source_published_at:string;borough:string;category:string;score:number;score_breakdown:Record<string,number>;source_confidence:number;priority:string;editorial_status:string;requires_verification:boolean;photo_rights:string;is_sensitive:boolean;category_reason:string;source_count:number;supporting_sources:Array<{source_name:string;source_url:string}>;event_key:string};
function extract(xml:string,src:(typeof SOURCES)[number],now:number):Candidate[]{
 const parsed=new XMLParser({ignoreAttributes:false,removeNSPrefix:true,attributeNamePrefix:"@_",parseTagValue:false,trimValues:true,processEntities:true}).parse(xml);
 const raw=parsed?.rss?.channel?.item||parsed?.feed?.entry||[];
 const rows=Array.isArray(raw)?raw:[raw];
 const arr:Candidate[]=[];
 for(const e of rows.slice(0,45)){
  let link=e.link;
  if(Array.isArray(link))link=link.find((a:Record<string,string>)=>a["@_rel"]==="alternate")||link[0];
  if(typeof link==="object"&&link)link=link["@_href"]||link["#text"];
  const source_url=normalizeUrl(link,src.host);if(!source_url)continue;
  const headline=plain(e.title).slice(0,190);
  const summary=plain(e.description||e.summary||e.content||"").slice(0,360);
  const date=Date.parse(plain(e.pubDate||e.published||e.updated||e.date));
  if(!Number.isFinite(date)||date>now+600000||date<now-48*3600000||headline.length<18)continue;
  const text=headline+" "+summary;
  const locations=BOROUGHS.filter(([,re])=>re.test(text)).map(([name])=>name);
  if(!LOCAL.test(text)&&locations.length===0)continue;
  const borough=locations.length===1?locations[0]:"NEW YORK CITY";
  const category=TOPICS.find(([,re])=>re.test(text))?.[0]||"NYC NEWS";
  const urgent=URGENT.test(headline);
  const sensitive=SENSITIVE.test(text);
  const hours=(now-date)/3600000;
  if(src.weight<7)continue;
  const scored=scoreParts(text,hours,1,src.weight);
  const score=scored.score;
  arr.push({headline,summary,source_name:src.name,source_url,source_published_at:new Date(date).toISOString(),borough,category,
   score,score_breakdown:scored.score_breakdown,source_confidence:scored.source_confidence,
   priority:score>=85&&urgent&&!sensitive?"breaking":score>=70?"high":"normal",
   editorial_status:"new",requires_verification:true,photo_rights:"unknown",is_sensitive:sensitive,
   category_reason:urgent?"Urgent keyword — NOT independently verified":"NYC relevance + weighted editorial score",
   source_count:1,supporting_sources:[{source_name:src.name,source_url}],
   event_key:""});
 }
 return arr;
}
async function sha(s:string){
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function read(path:string,options:RequestInit={}){
 if(!SUPABASE_URL||!SERVICE_KEY)throw Error("Supabase service credentials unavailable");
 const res=await fetch(SUPABASE_URL+"/rest/v1/"+path,{...options,headers:{
  apikey:SERVICE_KEY,Authorization:"Bearer "+SERVICE_KEY,
  ...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})
 },signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error("Supabase REST "+res.status+": "+(await res.text()).slice(0,240));
 const body=await res.text();return body?JSON.parse(body):null;
}
async function authorized(req:Request){
 const token=req.headers.get("x-tony-cron")||"";
 if(token.length<40||token.length>128)return false;
 const config=await read("tony_automation_config?select=token_sha256&name=eq.cron&limit=1");
 if(!config?.[0]?.token_sha256)return false;
 const hashed=await sha(token);
 // Fixed-length constant-time compare.
 const expected=String(config[0].token_sha256);
 let diff=hashed.length^expected.length;
 for(let i=0;i<Math.max(hashed.length,expected.length);i++)diff|=(hashed.charCodeAt(i)||0)^(expected.charCodeAt(i)||0);
 return diff===0;
}
async function pollOne(src:(typeof SOURCES)[number],now:number){
 const res=await fetch(src.url,{headers:{"Accept":"application/rss+xml,application/atom+xml,application/xml,text/xml","User-Agent":"TONY-Newsroom-Radar/1.0"},signal:AbortSignal.timeout(10500)});
 if(!res.ok)throw Error("Feed "+res.status);
 const xml=await res.text();
 if(xml.length>1250000||!/<(?:rss|feed|rdf:RDF)\b/i.test(xml))throw Error("Invalid RSS/Atom payload");
 return extract(xml,src,now).slice(0,5);
}

const ANTHROPIC_MODEL=Deno.env.get("ANTHROPIC_MODEL")||"claude-sonnet-5-5";
function extractModelJson(value:string):Record<string,unknown>{
 const cleaned=value.replace(/^`{3}(?:json)?\s*/i,"").replace(/\s*`{3}$/,"").trim();
 const start=cleaned.indexOf("{"),end=cleaned.lastIndexOf("}");
 if(start<0||end<=start)throw Error("Claude returned no JSON draft");
 const parsed=JSON.parse(cleaned.slice(start,end+1));
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("Claude returned an invalid draft");
 return parsed as Record<string,unknown>;
}
function getResearchSources(content:unknown[]):Array<{title:string;url:string;publisher:string;excerpt:string}>{
 const found=new Map<string,{title:string;url:string;publisher:string;excerpt:string}>();
 for(const block of content as Array<Record<string,unknown>>){
  const citations=Array.isArray(block.citations)?block.citations:[];
  const results=block.type==="web_search_result"&&Array.isArray(block.content)?block.content:[];
  for(const item of [...citations,...results] as Array<Record<string,unknown>>){
   const url=typeof item.url==="string"&&item.url.startsWith("https://")?item.url:"";
   if(!url)continue;
   const title=String(item.title||"Source").slice(0,180);
   let host="";try{host=new URL(url).hostname.replace(/^www\./,"");}catch{}
   found.set(url,{title,url,publisher:host,excerpt:String(item.cited_text||"").slice(0,260)});
  }
 }
 return [...found.values()].slice(0,10);
}
async function generateClaudeDraft(row:Record<string,unknown>){
 const apiKey=Deno.env.get("ANTHROPIC_API_KEY")||"";
 if(!apiKey)return {status:"awaiting_api_key"};
 const model=ANTHROPIC_MODEL;
 const system=[
  "You are the senior assigning editor and short-form video scriptwriter for TONY, an independent New York City local-news newsroom.",
  "Research the supplied NYC story using the web_search tool. Prefer official agencies and reputable independent NYC reporting. Search for corroboration, updates, dates, locations and exact figures.",
  "Never invent facts, numbers, quotes, identities, causes, locations or outcomes. Do not treat allegations as proven. Distinguish reported facts, official statements, allegations and unknowns.",
  "If evidence is thin, sources conflict, or the story is not sufficiently newsworthy, set editorial_verdict to needs_more_reporting or hold and explain why. Do not manufacture a confident script.",
  "Write for a US audience in natural American English. Make the opening specific and compelling, not clickbait. Voiceover should be 80–110 words for approximately 35–50 seconds.",
  "Also write card_deck: 35–50 words for the graphic directly below the headline. It must explain what happened, include the strongest verified concrete detail (number, decision, location, consequence or example), and end with a meaningful implication or question only when the reporting supports it. Never use vague teaser copy, generic filler, or a rhetorical question that withholds the actual news. This deck must stand alone and be readable in four short visual lines.",
  "Return only valid JSON with keys: editorial_verdict (ready_for_editor|needs_more_reporting|hold), angle, card_deck, hook, script, on_screen_text (array of 4–6 short lines), caption, cta, hashtags (array of 3–5), fact_check_checklist (array), uncertainties (array), estimated_seconds (number).",
  "The script must not include facts unsupported by the sources. Do not put citations or URLs inside the voiceover. Do not say the story is verified merely because multiple websites repeat the same wire copy.",
  "Do not recommend publishing sensitive crime, death, minors, or allegations without explicit caution and additional verification. No graphic or exploitative framing."
 ].join(" ");
 const user={
  task:"Research this story and prepare one editor-review-only TONY Instagram Reel package.",
  newsroom_timezone:"America/New_York",
  current_time:new Date().toISOString(),
  source_story:{
   headline:String(row.headline||""),
   summary:String(row.summary||""),
   publisher:String(row.source_name||""),
   source_url:String(row.source_url||""),
   published_at:String(row.source_published_at||""),
   borough:String(row.borough||"NEW YORK CITY"),
   category:String(row.category||"NYC NEWS"),
   editorial_score:Number(row.score||0),
   source_count:Number(row.source_count||1),
   supporting_sources:Array.isArray(row.supporting_sources)?row.supporting_sources:[]
  },
  research_instructions:"Search for the exact story and recent official or independent corroboration. Check whether the story has changed since initial publication. If no reliable corroboration exists, say so."
 };
 const body={
  model,max_tokens:2200,system,
  tools:[{type:"web_search_20260318",name:"web_search",max_uses:2,response_inclusion:"excluded"}],
  messages:[{role:"user",content:JSON.stringify(user)}]
 };
 const response=await fetch("https://api.anthropic.com/v1/messages",{
  method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
  body:JSON.stringify(body),signal:AbortSignal.timeout(48000)
 });
 const responseData=await response.json() as Record<string,unknown>;
 if(!response.ok)throw Error("Anthropic API "+response.status+": "+String((responseData as Record<string,unknown>).error||"request failed").slice(0,180));
 if(responseData.stop_reason==="pause_turn")throw Error("Claude research did not finish within the scheduled worker window");
 const content=Array.isArray(responseData.content)?responseData.content as Array<Record<string,unknown>>:[];
 const text=content.filter(x=>x.type==="text").map(x=>String(x.text||"")).join("\n").trim();
 const draft=extractModelJson(text);
 const required=["card_deck","hook","script","caption","cta"];
 for(const key of required)if(typeof draft[key]!=="string"||!String(draft[key]).trim())throw Error("Claude draft is missing "+key);
 if(String(draft.card_deck).trim().split(/\\s+/).length<25||String(draft.card_deck).trim().split(/\\s+/).length>60)throw Error("Claude card deck must contain 25–60 words");
 if(!["ready_for_editor","needs_more_reporting","hold"].includes(String(draft.editorial_verdict)))throw Error("Claude draft has an invalid editorial verdict");
 if(!Array.isArray(draft.fact_check_checklist)||!Array.isArray(draft.uncertainties)||!Array.isArray(draft.on_screen_text)||!Array.isArray(draft.hashtags))throw Error("Claude draft is missing review fields");
 const sources=getResearchSources(content);
 return {status:"generated",model,draft,sources,research_completed:sources.length>0,generated_at:new Date().toISOString()};
}
async function generateTopDraft(){
 if(!Deno.env.get("ANTHROPIC_API_KEY"))return {status:"awaiting_api_key",generated:0};
 const since=new Date(Date.now()-48*3600000).toISOString();
 const pending=await read("tony_newsroom_items?select=id,headline,summary,source_name,source_url,source_published_at,borough,category,score,source_count,supporting_sources&ai_draft=is.null&ai_generation_status=eq.pending&editorial_status=eq.new&source_published_at=gte."+encodeURIComponent(since)+"&order=score.desc,source_published_at.desc&limit=1");
 const row=pending?.[0];
 if(!row)return {status:"no_pending_story",generated:0};
 try{
  const result=await generateClaudeDraft(row);
  const patch={ai_draft:result,ai_generated_at:new Date().toISOString(),ai_model:ANTHROPIC_MODEL,ai_generation_status:"generated"};
  await read("tony_newsroom_items?id=eq."+encodeURIComponent(String(row.id)),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify(patch)});
  return {status:"generated",generated:1,storyId:row.id,model:ANTHROPIC_MODEL};
 }catch(error){
  await read("tony_newsroom_items?id=eq."+encodeURIComponent(String(row.id)),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({ai_generation_status:"failed"})});
  return {status:"failed",generated:0,storyId:row.id,error:String(error).slice(0,180)};
 }
}

async function poll(){
 const now=Date.now();
 const attempts=await Promise.allSettled(SOURCES.map(src=>pollOne(src,now)));
 const errors:string[]=[];const candidates:Candidate[]=[];
 attempts.forEach((a,i)=>{if(a.status==="fulfilled")candidates.push(...a.value);else errors.push(SOURCES[i].name+": "+String(a.reason).slice(0,100));});
 if(!candidates.length) {
  const aiDraft=await generateTopDraft();
  return {inserted:0,discovered:0,feedErrors:errors,aiDraft,warning:"No new eligible articles; editor confirmation remains required"};
 }
 const grouped:Candidate[]=[];
 candidates.sort((a,b)=>b.score-a.score||Date.parse(b.source_published_at)-Date.parse(a.source_published_at));
 for(const c of candidates){
  const match=grouped.find(x=>Math.abs(Date.parse(x.source_published_at)-Date.parse(c.source_published_at))<30*3600000&&
    (x.borough===c.borough||x.borough==="NEW YORK CITY"||c.borough==="NEW YORK CITY")&&similar(x.headline,c.headline)>=0.72);
  if(match){
   if(!match.supporting_sources.some(x=>x.source_name===c.source_name)){
    if(match.source_count<12)match.supporting_sources.push({source_name:c.source_name,source_url:c.source_url});
    match.source_count=Math.min(12,match.supporting_sources.length);
    const hours=(now-Date.parse(match.source_published_at))/3600000;
    const merged=scoreParts(match.headline+" "+match.summary,hours,match.source_count,Math.max(match.source_confidence,c.source_confidence)/10);
    match.score=merged.score;
    match.score_breakdown=merged.score_breakdown;
    match.source_confidence=Math.max(match.source_confidence,c.source_confidence);
   }
  }else grouped.push(c);
 }
 for(const c of grouped){
  c.priority=c.is_sensitive?"high":c.priority==="breaking"?"breaking":c.score>=62?"high":"normal";
  c.event_key=await sha(c.source_url);
 }
 // New items only; never reset human editorial decisions on subsequent polls.
 await read("tony_newsroom_items?on_conflict=source_url",{method:"POST",
  headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify(grouped.slice(0,55))});
 const aiDraft=await generateTopDraft();
 return {submitted:grouped.length,discovered:candidates.length,feedErrors:errors,aiDraft,warning:"Editor confirmation required; no posts were published"};
}
async function radar(){
 const since=new Date(Date.now()-48*3600000).toISOString();
 const records=await read("tony_newsroom_items?select=id,headline,summary,source_name,source_url,source_published_at,borough,category,score,score_breakdown,source_confidence,priority,source_count,supporting_sources,is_sensitive,ai_draft,ai_generated_at,ai_model,ai_generation_status&source_published_at=gte."+encodeURIComponent(since)+"&editorial_status=in.(new,review,ready)&order=score.desc,source_published_at.desc&limit=120");
 const perSource=new Map<string,number>();const balanced=[];
 for(const row of records||[]){
  const count=perSource.get(row.source_name)||0;
  if(count>=5)continue;
  perSource.set(row.source_name,count+1);
  balanced.push(row);
  if(balanced.length>=36)break;
 }
 return {stories:balanced,updatedAt:new Date().toISOString(),publication:"review-required",timezone:"America/New_York"};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:corsHeaders(req)});
 if(req.method==="GET") {
  try{return json(req,await radar());}catch(e){return json(req,{error:"Newsroom Radar unavailable",reason:String(e).slice(0,150)},503);}
 }
 if(req.method!=="POST")return json(req,{error:"Method not allowed"},405);
 try{
  if(!await authorized(req))return json(req,{error:"Unauthorized"},401);
  return json(req,await poll());
 }catch(e){return json(req,{error:"Ingestion failed",reason:String(e).slice(0,230)},500);}
});
