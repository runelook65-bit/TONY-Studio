'use strict';
const v=require('../../lib/visual');
const ALLOWED=['gemini-nano-banana-2.1','gemini-3.1-flash-lite-image'];
const MAX_BYTES=2400000;
function clean(value,n=450){return String(value||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);}
function buildPrompt({headline,summary,borough,category}){
 return [
 'Create one visually striking 4:5 conceptual EDITORIAL ILLUSTRATION for TONY, The Only New York, an independent New York City news publication.',
 'This is NOT an actual news photograph. It must look like an artistic illustrated poster, not a documentary photograph.',
 'Visual aesthetic: architectural collage, sophisticated metropolitan illustration, elevated graphic editorial design, deep midnight blue and charcoal black with restrained New York taxi yellow accents, dramatic editorial lighting.',
 'Leave the bottom 35 percent low detail and dark enough for a news headline overlay. No text, logos, words, numbers, labels, signatures or watermarks added by the model.',
 'Use generic NYC city motifs and abstract civic symbolism only. Do not invent or depict specific incidents, identifiable politicians, victims, named people, or any factual event. No fake news coverage, crowds, police interventions, crime scenes or emergency imagery.',
 'Headline for broad inspiration (not a factual instruction): '+clean(headline,180),
 'Editorial summary/context: '+clean(summary,280),
 'Category: '+clean(category,60)+'. Borough: '+clean(borough,50)+'.',
 'The final output should be a single standalone background image; no mockup, post layout, typography or border.'
 ].join('\n');
}
module.exports=async(req,res)=>{
 if(req.method!=='POST'){res.setHeader('Allow','POST');return v.send(res,405,{error:'Method not allowed.'});}
 if(!v.validOrigin(req))return v.send(res,403,{error:'Origin mismatch.'});
 if(!v.needVisualAdmin(req,res))return;
 const key=process.env.GEMINI_API_KEY;
 if(!key)return v.send(res,503,{error:'Add GEMINI_API_KEY in Vercel before generating images.'});
 const data=req.body||{};
 const headline=clean(data.headline,180),summary=clean(data.summary,280);
 if(headline.length<8||!summary)return v.send(res,400,{error:'Add a meaningful headline and summary first.'});
 const model=ALLOWED.includes(process.env.GEMINI_IMAGE_MODEL)?process.env.GEMINI_IMAGE_MODEL:ALLOWED[0];
 try{
  const request={
   contents:[{role:'user',parts:[{text:buildPrompt({...data,headline,summary})}]}],
   generationConfig:{responseModalities:['IMAGE'],imageConfig:{aspectRatio:'4:5'}}
  };
  const response=await v.fetchWithTimeout(
   'https://generativelanguage.googleapis.com/v1beta/models/'+model+':generateContent',
   {method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify(request)},
   53000
  );
  const result=await response.json();
  if(!response.ok){
   const status=response.status===429?'Google AI rate limit reached.':response.status===403?'Gemini API key is not authorized.':'Gemini image request failed.';
   return v.send(res,response.status===429?429:502,{error:status});
  }
  let image=null;
  for(const candidate of result?.candidates||[]){
   for(const part of candidate?.content?.parts||[]){
    if(part?.inlineData?.data&&/^image\/(?:jpeg|png|webp)$/.test(part.inlineData.mimeType||'')){image=part.inlineData;break;}
   }
   if(image)break;
  }
  if(!image)return v.send(res,422,{error:'Gemini did not return a usable image. Try a broader conceptual brief.'});
  const buffer=Buffer.from(image.data,'base64');
  if(buffer.length<500||buffer.length>MAX_BYTES)return v.send(res,422,{error:'Generated image is too large for this editor. Retry with a simpler concept.'});
  return v.send(res,200,{
   dataUrl:'data:'+image.mimeType+';base64,'+buffer.toString('base64'),
   photoKind:'ai',credit:'AI-generated illustration using Google Gemini',license:'AI-generated illustration',
   label:'AI ILLUSTRATION',model,
   note:'This is synthetic editorial artwork, not a photograph of the reported event. Keep the AI label visible.'
  });
 }catch(e){
  return v.send(res,502,{error:e.name==='TimeoutError'?'Gemini image generation timed out. Try again.':'Image generation failed. Please retry.'});
 }
};
module.exports.config={maxDuration:60};
module.exports._buildPrompt=buildPrompt;