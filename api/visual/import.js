'use strict';
const v=require('../../lib/visual');
const MAX_IMAGE=2400000;
module.exports=async(req,res)=>{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return v.send(res,405,{error:'Method not allowed.'});}
 if(!v.validOrigin(req))return v.send(res,403,{error:'Origin mismatch.'});
 const photo=v.unsignPhoto(req.body?.importToken);
 if(!photo||!['commons','pexels'].includes(photo.kind))return v.send(res,400,{error:'Image selection expired. Search again.'});
 try{
  let url=v.assertHost(photo.imageUrl,photo.kind);
  const approved=v.assertHost;
  let response;
  for(let count=0;count<3;count++){
   response=await v.fetchWithTimeout(url,{redirect:'manual',headers:{Accept:'image/jpeg,image/png,image/webp'}},12000);
   if(response.status>=300&&response.status<400){
    const redirect=response.headers.get('location');
    if(!redirect)throw new Error('Invalid media redirect.');
    url=approved(new URL(redirect,url).toString(),photo.kind);
   }else break;
  }
  if(response.status>=300&&response.status<400)throw new Error('Too many image redirects.');
  if(!response.ok)throw new Error('The selected photo could not be downloaded.');
  const mime=(response.headers.get('content-type')||'').split(';')[0].toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new Error('Unsupported photo format.');
  if(Number(response.headers.get('content-length')||0)>MAX_IMAGE)throw new Error('Photo exceeds 2.4 MB. Select another.');
  const chunks=[],reader=response.body?.getReader();if(!reader)throw new Error('Empty image.');
  let bytes=0;
  try{
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;
    if(bytes>MAX_IMAGE)throw new Error('Photo exceeds 2.4 MB. Select another.');
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const buffer=Buffer.concat(chunks.map(x=>Buffer.from(x)));
  if(buffer.length<500)throw new Error('Image file is empty or invalid.');
  const jpeg=mime==='image/jpeg'&&buffer[0]===0xff&&buffer[1]===0xd8;
  const png=mime==='image/png'&&buffer.subarray(0,4).toString('hex')==='89504e47';
  const webp=mime==='image/webp'&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
  if(!(jpeg||png||webp))throw new Error('Media signature does not match file type.');
  return v.send(res,200,{
   dataUrl:'data:'+mime+';base64,'+buffer.toString('base64'),
   credit:photo.credit,license:photo.license,sourceUrl:photo.sourceUrl,photoKind:photo.photoKind,
   note:'Review this archival/stock image for relevance, permissions and accurate context before posting.'
  });
 }catch(e){return v.send(res,422,{error:String(e.message||'Photo import failed.').slice(0,250)});}
};