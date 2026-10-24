'use strict';
const v=require('../../lib/visual');
function commonsLicense(meta) {
  const name=v.strip(meta?.LicenseShortName?.value||meta?.UsageTerms?.value,90);
  // Exclude NC, ND, unknown, private and restricted files from the suggestions.
  if(!/^(CC\s*(?:BY(?:-SA)?|0)|CC0|Public domain|PD(?:\b|-))/i.test(name))return null;
  if(/\bNC\b|\bND\b|noncommercial|no derivatives/i.test(name))return null;
  return name;
}
async function commons(q){
 const url=new URL('https://commons.wikimedia.org/w/api.php');
 const args={action:'query',generator:'search',gsrsearch:q,gsrnamespace:'6',gsrlimit:'14',prop:'imageinfo',
   iiprop:'url|mime|extmetadata',iiurlwidth:'1100',format:'json',formatversion:'2'};
 for(const [key,val] of Object.entries(args))url.searchParams.set(key,val);
 const r=await v.fetchWithTimeout(url.toString(),{headers:{'User-Agent':'TONYStudio/1.0 (https://tony-studio-lmeo.vercel.app)'}});
 if(!r.ok)throw new Error('Wikimedia photo search is temporarily unavailable.');
 const json=await r.json(),files=json?.query?.pages||[],out=[];
 for(const file of files){
  const image=file?.imageinfo?.[0],meta=image?.extmetadata||{};
  const license=commonsLicense(meta),imageUrl=image?.thumburl||'';
  if(!license||!/^image\/(?:jpeg|png|webp)$/.test(image?.mime||'')||!imageUrl)continue;
  try{v.assertHost(imageUrl,'commons');}catch{continue;}
  const photographer=v.clearHtml(meta.Artist?.value||meta.Credit?.value||'Contributor');
  const licenseUrl=String(meta.LicenseUrl?.value||'');
  const sourceUrl=image?.descriptionurl||'';
  if(!sourceUrl.startsWith('https://commons.wikimedia.org/wiki/File:'))continue;
  const item={id:'commons-'+String(file.pageid),kind:'commons',title:v.strip(file.title.replace(/^File:/i,'').replace(/\.[^.]+$/,'').replace(/_/g,' '),150),
   imageUrl,sourceUrl,photographer,license,licenseUrl:licenseUrl.startsWith('https:')?licenseUrl:null,
   credit:'Photo: '+photographer+' / Wikimedia Commons ('+license+')',photoKind:'archive'};
  item.importToken=v.signPhoto({imageUrl,sourceUrl,credit:item.credit,license,kind:'commons',photoKind:'archive'});
  out.push(item);
 }
 return out.slice(0,9);
}
async function pexels(q){
 if(!process.env.PEXELS_API_KEY)return [];
 const url=new URL('https://api.pexels.com/v1/search');
 url.searchParams.set('query',q);url.searchParams.set('per_page','9');url.searchParams.set('orientation','portrait');
 const r=await v.fetchWithTimeout(url.toString(),{headers:{Authorization:process.env.PEXELS_API_KEY}});
 if(!r.ok)throw new Error('Pexels photo search is temporarily unavailable.');
 const json=await r.json(),out=[];
 for(const photo of json.photos||[]){
  const imageUrl=photo?.src?.large||photo?.src?.large2x||'';
  try{v.assertHost(imageUrl,'pexels');}catch{continue;}
  const sourceUrl=String(photo.url||'');
  if(!sourceUrl.startsWith('https://www.pexels.com/photo/'))continue;
  const photographer=v.strip(photo.photographer,100);
  const credit='Photo: '+photographer+' / Pexels';
  const item={id:'pexels-'+String(photo.id),kind:'pexels',title:v.strip(photo.alt||'New York stock photo',150),
   imageUrl,sourceUrl,photographer,license:'Pexels License',
   licenseUrl:'https://www.pexels.com/license/',credit,photoKind:'stock'};
  item.importToken=v.signPhoto({imageUrl,sourceUrl,credit,license:item.license,kind:'pexels',photoKind:'stock'});
  out.push(item);
 }
 return out;
}
module.exports=async(req,res)=>{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return v.send(res,405,{error:'Method not allowed.'});}
 const q=typeof req.query?.q==='string'?req.query.q.trim():'';
 const source=typeof req.query?.source==='string'?req.query.source:'commons';
 if(q.length<3||q.length>110)return v.send(res,400,{error:'Use a 3–110 character search phrase.'});
 if(!['commons','pexels'].includes(source))return v.send(res,400,{error:'Invalid photo provider.'});
 if(!process.env.TONY_SESSION_SECRET||process.env.TONY_SESSION_SECRET.length<32)return v.send(res,503,{error:'Photo imports require TONY_SESSION_SECRET in Vercel.'});
 try{return v.send(res,200,{items:source==='commons'?await commons(q):await pexels(q),provider:source,query:q,advisory:'Search results are archive or stock imagery, not evidence from the reported incident. Review image license, accuracy, and attribution.'});}
 catch(e){return v.send(res,502,{error:String(e.message||'Photo search failed.').slice(0,240)});}
};
module.exports._commonsLicense=commonsLicense;