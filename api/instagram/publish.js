'use strict';
const crypto=require('node:crypto');
const lib=require('./_lib');
const BYTES_MAX=3000000;
const PENDING_MS=20*60*1000;

function validatePayload(body){
 const p=body||{};
 if(typeof p.caption!=='string'||!p.caption.trim()||p.caption.length>2200)throw new Error('Caption must be 1–2,200 characters.');
 if(typeof p.sourceUrl!=='string'||p.sourceUrl.length>2000)throw new Error('A verified source URL is required.');
 let url;
 try{url=new URL(p.sourceUrl);}catch{throw new Error('A valid source URL is required.');}
 if(url.protocol!=='https:')throw new Error('Use an HTTPS source URL.');
 if(!['cross-checked','official-source'].includes(p.verificationStatus))throw new Error('Verify the report before publishing.');
 if(!['original','licensed'].includes(p.imagePermission))throw new Error('Confirm original or licensed rights to the posted image.');
 if(typeof p.imageData!=='string'||!/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(p.imageData))throw new Error('A JPEG image exported by TONY Studio is required.');
 const binary=Buffer.from(p.imageData.substring('data:image/jpeg;base64,'.length),'base64');
 if(binary.length<1500||binary.length>BYTES_MAX||binary[0]!==0xff||binary[1]!==0xd8||binary[binary.length-2]!==0xff||binary[binary.length-1]!==0xd9){
  throw new Error('JPEG image is invalid or above the 3 MB upload limit.');
 }
 return {caption:p.caption.trim(),image:binary};
}
async function containerStatus(id,token){
 const result=await lib.graph(String(id),token,'GET',{fields:'status_code,status'});
 return result.status_code || 'UNKNOWN';
}
async function publishReady(id,ig){
 const done=await lib.graph(ig.id+'/media_publish',ig.token,'POST',{creation_id:String(id)});
 if(!done.id)throw new Error('Instagram did not return a published media ID.');
 let permalink=null;
 try{
  const item=await lib.graph(String(done.id),ig.token,'GET',{fields:'permalink'});
  if(typeof item.permalink==='string'&&item.permalink.startsWith('https://www.instagram.com/'))permalink=item.permalink;
 }catch{ /* media exists: do not mark publication failed if permalink is delayed. */ }
 return {status:'published',id:String(done.id),permalink};
}
module.exports=async(req,res)=>{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return lib.send(res,405,{error:'Method not allowed.'});}
 if(!lib.origin(req))return lib.send(res,403,{error:'Origin mismatch.'});
 if(!lib.ready())return lib.send(res,503,{error:'Instagram and Vercel Blob environment settings are incomplete.'});
 const ig=lib.instagram(req);
 if(!ig)return lib.send(res,401,{error:'Unlock Studio and connect Instagram before posting.'});
 try{
  let containerId;
  const pending=req.body?.pendingToken;
  if(typeof pending==='string'){
   const record=lib.decode(pending);
   if(!record||record.kind!=='pending'||record.instagramId!==ig.id||!/^\d{5,30}$/.test(record.containerId)){
    return lib.send(res,400,{error:'Pending Instagram upload expired or does not match this account.'});
   }
   containerId=record.containerId;
  } else{
   const draft=validatePayload(req.body);
   // A public media URL is mandatory because Meta fetches it server-to-server.
   const {put}=require('@vercel/blob');
   const path='tony-instagram/'+new Date().toISOString().slice(0,10)+'/'+crypto.randomUUID()+'.jpg';
   const blob=await put(path,draft.image,{
     access:'public',contentType:'image/jpeg',addRandomSuffix:true,
     token:process.env.BLOB_READ_WRITE_TOKEN
   });
   const created=await lib.graph(ig.id+'/media',ig.token,'POST',{
     image_url:blob.url,caption:draft.caption
   });
   if(!created.id)throw new Error('Instagram did not create a publishing container.');
   containerId=String(created.id);
  }
  const status=await containerStatus(containerId,ig.token);
  if(status==='FINISHED')return lib.send(res,200,await publishReady(containerId,ig));
  if(status==='ERROR'||status==='EXPIRED')return lib.send(res,422,{error:'Instagram rejected the image container ('+status+').'});
  const token=lib.encode({
   kind:'pending',instagramId:ig.id,containerId,until:Date.now()+PENDING_MS
  });
  return lib.send(res,202,{status:'processing',pendingToken:token,message:'Instagram is processing the image. Retry status after a few seconds.'});
 }catch(e){
  return lib.send(res,422,{error:lib.errorMessage(e)});
 }
};
