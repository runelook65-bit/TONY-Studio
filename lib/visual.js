'use strict';
const crypto = require('node:crypto');
const auth = require('./instagram');
const VISUAL_COOKIE='__Host-tony_visual';
const ORIGIN='https://tony-studio-lmeo.vercel.app';
function send(res,code,data){return auth.send(res,code,data);}
function validOrigin(req){
  const source=req.headers?.origin||'';
  const configured=process.env.INSTAGRAM_REDIRECT_URI;
  let origin=ORIGIN;
  try{if(configured)origin=new URL(configured).origin;}catch{}
  return source===origin;
}
function visualAdmin(req){
 const item=auth.getSession(req,VISUAL_COOKIE);
 return Boolean(item&&item.kind==='visual-admin'&&item.until>Date.now());
}
function needVisualAdmin(req,res){
 if(!visualAdmin(req)){send(res,401,{error:'Unlock Visual Intelligence to generate AI illustrations.'});return false;}
 return true;
}
function signingKey(){return process.env.TONY_SESSION_SECRET || '';}
function signPhoto(payload){
 if(signingKey().length<32)throw new Error('Configure TONY_SESSION_SECRET for photo imports.');
 const json=Buffer.from(JSON.stringify({...payload,until:Date.now()+25*60*1000})).toString('base64url');
 const mac=crypto.createHmac('sha256',signingKey()).update(json).digest('base64url');
 return json+'.'+mac;
}
function unsignPhoto(token){
 if(typeof token!=='string'||token.length>5000||!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(token))return null;
 const [payload,mac]=token.split('.');
 const expected=crypto.createHmac('sha256',signingKey()).update(payload).digest('base64url');
 if(!auth.constantTimeEqual(mac,expected))return null;
 try{
 const data=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
 return data.until>Date.now()?data:null;
 }catch{return null;}
}
function strip(value,max=160){
 return String(value||'').replace(/<[^>]+>/g,' ').replace(/&(?:amp|#38);/gi,'&')
 .replace(/&(?:quot|#34);/gi,'"').replace(/&(?:nbsp|#160);/gi,' ')
 .replace(/\s+/g,' ').trim().slice(0,max);
}
function assertHost(raw,kind){
 const u=new URL(raw);
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')throw new Error('Only HTTPS image URLs are allowed.');
 const allowed=kind==='commons'?['upload.wikimedia.org']:kind==='pexels'?['images.pexels.com']:[];
 if(!allowed.includes(u.hostname.toLowerCase()))throw new Error('Image host is not approved.');
 return u.toString();
}
function fetchWithTimeout(url,options={},ms=10000){return fetch(url,{...options,signal:AbortSignal.timeout(ms)});}
function clearHtml(value){return strip(value,180);}
module.exports={auth,VISUAL_COOKIE,ORIGIN,send,validOrigin,visualAdmin,needVisualAdmin,signPhoto,unsignPhoto,strip,assertHost,fetchWithTimeout,clearHtml};
