// TONY Breaking News Radar, scheduled in Supabase pg_cron (not Vercel Cron).
// Public GET returns only source-attributed article suggestions. POST requires a private cron token.
import { XMLParser } from "npm:fast-xml-parser@4.5.1";

const SOURCES = [
  {name:"Gothamist",url:"https://gothamist.com/feed",host:"gothamist.com",weight:8},
  {name:"THE CITY",url:"https://www.thecity.nyc/rss/index.xml",host:"thecity.nyc",weight:9},
  {name:"City Limits",url:"https://citylimits.org/feed/",host:"citylimits.org",weight:7},
  {name:"Hell Gate",url:"https://hellgatenyc.com/all-posts/rss",host:"hellgatenyc.com",weight:7}
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
const ORIGIN="https://tony-studio-lmeo.vercel.app";
const SUPABASE_URL=Deno.env.get("SUPABASE_URL")||"";
const SERVICE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 "content-type":"application/json; charset=utf-8","cache-control":"no-store",
 "access-control-allow-origin":ORIGIN,"access-control-allow-methods":"GET, POST, OPTIONS","access-control-allow-headers":"content-type, x-tony-cron"
}});
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
function similar(a:string,b:string){
 const aw=words(a),bw=words(b);if(aw.length<3||bw.length<3)return 0;
 return aw.filter(x=>bw.includes(x)).length/Math.min(aw.length,bw.length);
}
type Candidate={headline:string;summary:string;source_name:string;source_url:string;source_published_at:string;borough:string;category:string;score:number;priority:string;editorial_status:string;requires_verification:boolean;photo_rights:string;is_sensitive:boolean;category_reason:string;source_count:number;supporting_sources:Array<{source_name:string;source_url:string}>;event_key:string};
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
  const freshness=hours<=1?22:hours<=3?18:hours<=8?13:hours<=24?8:3;
  const score=Math.max(0,Math.min(100,22+src.weight+freshness+(urgent?18:0)+(locations.length?8:3)+(/mta|nypd|nycha|mayor|city council|department of/i.test(text)?7:0)-(sensitive?6:0)));
  arr.push({headline,summary,source_name:src.name,source_url,source_published_at:new Date(date).toISOString(),borough,category,
   score,priority:score>=75&&urgent&&!sensitive?"breaking":score>=62?"high":"normal",
   editorial_status:"new",requires_verification:true,photo_rights:"unknown",is_sensitive:sensitive,
   category_reason:urgent?"Urgent keyword — NOT independently verified":"Local relevance + recency",
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
 return extract(xml,src,now).slice(0,10);
}
async function poll(){
 const now=Date.now();
 const attempts=await Promise.allSettled(SOURCES.map(src=>pollOne(src,now)));
 const errors:string[]=[];const candidates:Candidate[]=[];
 attempts.forEach((a,i)=>{if(a.status==="fulfilled")candidates.push(...a.value);else errors.push(SOURCES[i].name+": "+String(a.reason).slice(0,100));});
 if(!candidates.length) return {inserted:0,discovered:0,feedErrors:errors,warning:"No eligible fresh articles; try next scheduled run"};
 const grouped:Candidate[]=[];
 candidates.sort((a,b)=>b.score-a.score||Date.parse(b.source_published_at)-Date.parse(a.source_published_at));
 for(const c of candidates){
  const match=grouped.find(x=>Math.abs(Date.parse(x.source_published_at)-Date.parse(c.source_published_at))<30*3600000&&
    (x.borough===c.borough||x.borough==="NEW YORK CITY"||c.borough==="NEW YORK CITY")&&similar(x.headline,c.headline)>=0.72);
  if(match){
   if(!match.supporting_sources.some(x=>x.source_name===c.source_name)){
    match.supporting_sources.push({source_name:c.source_name,source_url:c.source_url});
    match.source_count=match.supporting_sources.length;
    match.score=Math.min(100,match.score+8);
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
 return {submitted:grouped.length,discovered:candidates.length,feedErrors:errors,warning:"Editor confirmation required; no posts were published"};
}
async function radar(){
 const since=new Date(Date.now()-48*3600000).toISOString();
 const records=await read("tony_newsroom_items?select=id,headline,summary,source_name,source_url,source_published_at,borough,category,score,priority,source_count,supporting_sources,is_sensitive&source_published_at=gte."+encodeURIComponent(since)+"&editorial_status=in.(new,review,ready)&order=score.desc,source_published_at.desc&limit=35");
 return {stories:records||[],updatedAt:new Date().toISOString(),publication:"review-required",timezone:"America/New_York"};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return json({},204);
 if(req.method==="GET") {
  try{return json(await radar());}catch(e){return json({error:"Newsroom Radar unavailable",reason:String(e).slice(0,150)},503);}
 }
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  if(!await authorized(req))return json({error:"Unauthorized"},401);
  return json(await poll());
 }catch(e){return json({error:"Ingestion failed",reason:String(e).slice(0,230)},500);}
});
