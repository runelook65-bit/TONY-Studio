'use strict';
const crypto = require('node:crypto');

const ADMIN_COOKIE = '__Host-tony_admin';
const STATE_COOKIE = '__Host-tony_ig_state';
const SESSION_COOKIE = '__Host-tony_instagram';
const COOKIE_SECURE = 'Secure; HttpOnly; Path=/; SameSite=Lax';
const API_VERSION = 'v24.0';

function ready() {
  return Boolean(
    process.env.INSTAGRAM_APP_ID &&
    process.env.INSTAGRAM_APP_SECRET &&
    process.env.INSTAGRAM_REDIRECT_URI &&
    process.env.TONY_SESSION_SECRET &&
    process.env.TONY_ADMIN_PASSWORD &&
    process.env.BLOB_READ_WRITE_TOKEN &&
    process.env.TONY_SESSION_SECRET.length >= 32 &&
    process.env.TONY_ADMIN_PASSWORD.length >= 16
  );
}
function secret() {
  const val = process.env.TONY_SESSION_SECRET || '';
  if (val.length < 32) throw new Error('Missing secure TONY_SESSION_SECRET (32+ characters).');
  return crypto.createHash('sha256').update(val).digest();
}
function encode(value) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm',secret(),nonce);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return Buffer.concat([nonce,cipher.getAuthTag(),encrypted]).toString('base64url');
}
function decode(value) {
  try {
    const data = Buffer.from(value || '', 'base64url');
    if (data.length < 30 || data.length > 3500) return null;
    const d = crypto.createDecipheriv('aes-256-gcm',secret(),data.subarray(0,12));
    d.setAuthTag(data.subarray(12,28));
    const item = JSON.parse(Buffer.concat([d.update(data.subarray(28)),d.final()]).toString('utf8'));
    if (!item || !Number.isFinite(item.until) || item.until < Date.now()) return null;
    return item;
  } catch { return null; }
}
function getCookies(req) {
  const entries=(req.headers.cookie || '').split(';').map(p=>p.trim()).filter(Boolean).map(entry=>{
    const n=entry.indexOf('=');
    return n < 0 ? [] : [entry.slice(0,n),entry.slice(n+1)];
  }).filter(pair=>pair.length===2);
  return Object.fromEntries(entries);
}
function getSession(req,name) { return decode(getCookies(req)[name]); }
function setCookie(res,name,value,seconds) {
  const row=name+'='+value+'; Max-Age='+Math.floor(seconds)+'; '+COOKIE_SECURE;
  const previous=res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie',[...(Array.isArray(previous)?previous:previous?[previous]:[]),row]);
}
function clearCookie(res,name) {setCookie(res,name,'',0);}
function admin(req) {
  const item=getSession(req,ADMIN_COOKIE);
  return Boolean(item && item.kind==='admin');
}
function instagram(req) {
  const item=getSession(req,SESSION_COOKIE);
  return admin(req) && item && item.kind==='instagram' && item.token && item.id ? item:null;
}
function origin(req) {
  // Origin must be exactly the OAuth callback host, not any Vercel preview domain.
  try {
    const configured=new URL(process.env.INSTAGRAM_REDIRECT_URI);
    if(configured.protocol!=='https:' || configured.pathname!=='/api/instagram/callback') return false;
    return req.headers.origin === configured.origin;
  }catch {return false;}
}
function constantTimeEqual(a,b){
  if(typeof a!=='string'||typeof b!=='string') return false;
  const ha=crypto.createHash('sha256').update(a).digest();
  const hb=crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha,hb);
}
function send(res,code,data){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  return res.status(code).json(data);
}
function requireAdmin(req,res){
  if(!admin(req)) {send(res,401,{error:'Unlock the newsroom first.'});return false;}
  return true;
}
async function parseMeta(response) {
  let data;
  try { data=await response.json(); }
  catch { throw new Error('Instagram returned an unreadable response.');}
  if (!response.ok || data.error) {
    const msg = data?.error?.error_user_msg || data?.error?.message || 'Instagram API request failed.';
    const err = new Error(String(msg).slice(0,400));
    err.code = data?.error?.code || response.status;
    throw err;
  }
  return data;
}
async function graph(path,token,method='GET',values=null) {
  const base='https://graph.instagram.com/'+API_VERSION+'/'+path.replace(/^\/+/,'');
  const opts={method,headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(15000)};
  let url=base;
  if(method==='GET' && values){url+='?'+new URLSearchParams(values).toString();}
  if(method==='POST'){
    opts.headers['Content-Type']='application/x-www-form-urlencoded';
    opts.body=new URLSearchParams(values || {}).toString();
  }
  return parseMeta(await fetch(url,opts));
}
function errorMessage(err){return String(err?.message || 'Instagram request could not be completed.').slice(0,350);}

module.exports={
  ADMIN_COOKIE, STATE_COOKIE, SESSION_COOKIE, API_VERSION,
  ready, encode, decode, getSession, setCookie, clearCookie,
  admin,instagram,origin,constantTimeEqual,send,requireAdmin,parseMeta,graph,errorMessage
};
