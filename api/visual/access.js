'use strict';
const v=require('../../lib/visual');
module.exports=async(req,res)=>{
 if(req.method==='GET')return v.send(res,200,{
  commons:true,pexels:Boolean(process.env.PEXELS_API_KEY),
  gemini:Boolean(process.env.GEMINI_API_KEY),
  canGenerate:Boolean(process.env.GEMINI_API_KEY&&v.visualAdmin(req)),
  adminConfigured:Boolean((process.env.TONY_VISUAL_PASSWORD||process.env.TONY_ADMIN_PASSWORD)&&process.env.TONY_SESSION_SECRET?.length>=32)
 });
 if(req.method==='POST'){
  if(!v.validOrigin(req))return v.send(res,403,{error:'Origin mismatch.'});
  const password=process.env.TONY_VISUAL_PASSWORD||process.env.TONY_ADMIN_PASSWORD;
  if(!password||password.length<16||!process.env.TONY_SESSION_SECRET||process.env.TONY_SESSION_SECRET.length<32)
   return v.send(res,503,{error:'Set TONY_VISUAL_PASSWORD (16+ characters) and TONY_SESSION_SECRET in Vercel first.'});
  const candidate=req.body?.password;
  if(typeof candidate!=='string'||candidate.length>500||!v.auth.constantTimeEqual(password,candidate))
   return v.send(res,401,{error:'Incorrect Visual Intelligence password.'});
  const seconds=12*3600;
  v.auth.setCookie(res,v.VISUAL_COOKIE,v.auth.encode({kind:'visual-admin',until:Date.now()+seconds*1000}),seconds);
  return v.send(res,200,{unlocked:true});
 }
 if(req.method==='DELETE'){
  if(!v.validOrigin(req))return v.send(res,403,{error:'Origin mismatch.'});
  v.auth.clearCookie(res,v.VISUAL_COOKIE);
  return v.send(res,200,{unlocked:false});
 }
 res.setHeader('Allow','GET,POST,DELETE');
 return v.send(res,405,{error:'Method not allowed.'});
};