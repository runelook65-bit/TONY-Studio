'use strict';
const lib=require('./_lib');
const MAX_AGE=60*24*3600;
async function main(req,res){
 const page=new URL(process.env.INSTAGRAM_REDIRECT_URI || 'https://invalid.example/api/instagram/callback').origin+'/';
 function finish(code){
  lib.clearCookie(res,lib.STATE_COOKIE);
  const target=new URL(page);
  target.searchParams.set('instagram',code);
  return res.redirect(302,target.toString());
 }
 if(req.method!=='GET')return lib.send(res,405,{error:'Method not allowed.'});
 if(!lib.ready()||!lib.admin(req))return finish('setup');
 const pending=lib.getSession(req,lib.STATE_COOKIE);
 if(!pending||pending.kind!=='oauth'||pending.nonce!==req.query?.state||typeof req.query?.code!=='string')return finish('state_error');
 // The OAuth code never leaves the server.
 try{
  const code=req.query.code.replace(/#_$/,'');
  const fields=new URLSearchParams({
   client_id:process.env.INSTAGRAM_APP_ID,client_secret:process.env.INSTAGRAM_APP_SECRET,
   grant_type:'authorization_code',redirect_uri:process.env.INSTAGRAM_REDIRECT_URI,code
  });
  const short=await lib.parseMeta(await fetch('https://api.instagram.com/oauth/access_token',{
   method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
   body:fields.toString(),signal:AbortSignal.timeout(15000)
  }));
  if(!short.access_token||!short.user_id)throw new Error('Instagram did not return an account access token.');
  const url=new URL('https://graph.instagram.com/access_token');
  url.search=new URLSearchParams({
   grant_type:'ig_exchange_token',client_secret:process.env.INSTAGRAM_APP_SECRET,access_token:short.access_token
  }).toString();
  const long=await lib.parseMeta(await fetch(url,{signal:AbortSignal.timeout(15000)}));
  if(!long.access_token)throw new Error('Missing long-lived Instagram token.');
  const user=await lib.graph('me',long.access_token,'GET',{fields:'id,username,account_type'});
  if(!user.id||!user.username||!['BUSINESS','MEDIA_CREATOR','CREATOR'].includes(user.account_type)){
   throw new Error('A Business or Creator Instagram account is required.');
  }
  const life=Math.max(3600,Math.min(MAX_AGE,Number(long.expires_in)||MAX_AGE));
  const expiry=Date.now()+life*1000;
  lib.setCookie(res,lib.SESSION_COOKIE,lib.encode({
   kind:'instagram',until:expiry,token:long.access_token,
   id:String(user.id),username:String(user.username),accountType:String(user.account_type)
  }),life);
  return finish('connected');
 }catch(e){
  // Never return secrets, auth codes or tokens to the browser or logs.
  return finish('connect_error');
 }
}
module.exports=main;
