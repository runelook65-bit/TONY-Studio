'use strict';
const crypto=require('node:crypto');
const lib=require('../../lib/instagram');
module.exports=async(req,res)=>{
 if(req.method!=='GET'){res.setHeader('Allow','GET');return lib.send(res,405,{error:'Method not allowed.'});}
 if(!lib.ready())return lib.send(res,503,{error:'Configure Meta app, newsroom access and Blob storage first.'});
 if(!lib.requireAdmin(req,res))return;
 const nonce=crypto.randomBytes(24).toString('base64url');
 lib.setCookie(res,lib.STATE_COOKIE,lib.encode({kind:'oauth',nonce,until:Date.now()+10*60*1000}),600);
 const url=new URL('https://www.instagram.com/oauth/authorize');
 url.searchParams.set('client_id',process.env.INSTAGRAM_APP_ID);
 url.searchParams.set('redirect_uri',process.env.INSTAGRAM_REDIRECT_URI);
 url.searchParams.set('response_type','code');
 url.searchParams.set('scope','instagram_business_basic,instagram_business_content_publish');
 url.searchParams.set('state',nonce);
 url.searchParams.set('force_reauth','true');
 res.setHeader('Cache-Control','no-store');
 return res.redirect(302,url.toString());
};
