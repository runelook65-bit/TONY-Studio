'use strict';
const crypto=require('node:crypto');
const lib=require('../../lib/instagram');
const SEC=7*24*3600;
module.exports=async(req,res)=>{
  if(req.method==='GET'){
    const session=lib.instagram(req);
    const unlocked=lib.admin(req);
    // Do not expose any token, even to an authenticated client.
    return lib.send(res,200,{
      configured:lib.ready(),unlocked,
      connected:Boolean(session),
      account:session?{id:session.id,username:session.username,accountType:session.accountType,expiresAt:session.until}:null,
      needsSetup:!lib.ready()
    });
  }
  if(req.method==='POST'){
    if(!lib.origin(req))return lib.send(res,403,{error:'Origin mismatch.'});
    if(!lib.ready())return lib.send(res,503,{error:'Instagram publishing is not configured by the site administrator.'});
    const password=req.body?.password;
    if(typeof password!=='string'||password.length>500||!lib.constantTimeEqual(password,process.env.TONY_ADMIN_PASSWORD)){
      return lib.send(res,401,{error:'Invalid newsroom access password.'});
    }
    lib.setCookie(res,lib.ADMIN_COOKIE,lib.encode({kind:'admin',until:Date.now()+SEC*1000}),SEC);
    return lib.send(res,200,{unlocked:true});
  }
  if(req.method==='DELETE'){
    if(!lib.origin(req))return lib.send(res,403,{error:'Origin mismatch.'});
    if(!lib.requireAdmin(req,res))return;
    lib.clearCookie(res,lib.SESSION_COOKIE);
    lib.clearCookie(res,lib.STATE_COOKIE);
    // A reconnect will be required, without revoking Instagram grants.
    return lib.send(res,200,{connected:false});
  }
  res.setHeader('Allow','GET,POST,DELETE');
  return lib.send(res,405,{error:'Method not allowed.'});
};
