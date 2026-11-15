import {getStore} from '@netlify/blobs';
import {gateway} from './store.mjs';
import {upgrade,identity,imageAllowance} from './identity.mjs';
export async function generateAvatar(){
 const lock=await gateway('lease');if(lock.busy)return {status:'busy'};const state=upgrade(lock.state);let event=null,request=null;
 const commit=()=>gateway('commit',{state,lease:lock.lease,revision:lock.revision,events:event?[event]:[]});
 try{
  for(const a of state.agents){if(['retiring','archiving'].includes(a.lifecycle))continue;const r=a.imageRequests.find(x=>x.status==='approved');if(!r)continue;request=r;
   if(!r.free&&imageAllowance(a)<r.price){r.status='pending';r.error='Eligible profit changed; review again.';break;}
   if(state.imageBudget.spent+state.imageBudget.reserved+.10>state.imageBudget.cap)throw Error('Image budget reached. No generation sent.');
   if(Date.now()>=Date.parse(state.keyExpiresAt))throw Error('Key safety deadline reached. No image request sent.');
   r.status='generating';r.attemptedAt=new Date().toISOString();state.imageBudget.reserved+=.10;
   let saved=await gateway('commit',{state,lease:lock.lease,revision:lock.revision,events:[],release:false});lock.revision=saved.revision;
   // Persist a reservation before either API call. Unknown costs remain conservatively charged.
   if(!r.prompt){const result=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1-mini-2025-04-14',store:false,max_output_tokens:180,instructions:'Choose your own original avatar appearance. If input needsIdentity is true, return ONLY JSON with name (an original name under 24 characters) and appearance (a concise image prompt under 450 characters). Otherwise return only a concise visual image prompt under 450 characters. No text, logos, real people, or financial claims. You may choose a creature, robot, abstract symbol, or character. This is a profile image, not a trading decision.',input:JSON.stringify({...identity(a.id),needsIdentity:!!a.needsIdentity,role:a.id==='A'?'Patient BTC 15-minute researcher':'Flexible-horizon BTC researcher'})}),signal:AbortSignal.timeout(25000)});if(!result.ok)throw Error('Avatar description unavailable ('+result.status+')');const d=await result.json();r.prompt=d.output?.flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('').slice(0,2000);if(a.needsIdentity){const chosen=JSON.parse(r.prompt);r.chosenName=String(chosen.name||'').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,24).trim();r.prompt=String(chosen.appearance||'').slice(0,450);if(!r.chosenName)throw Error('Chosen name unavailable');}if(!r.prompt)throw Error('Avatar description was empty');r.prompt=r.prompt.slice(0,450);}
   const response=await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-image-1-mini',prompt:'One original profile avatar on a black background. Clear silhouette readable as a small circular crop. No letters or logos. '+r.prompt,n:1,quality:'low',size:'1024x1024',output_format:'webp',output_compression:80}),signal:AbortSignal.timeout(120000)});
   if(!response.ok)throw Error('Image generation unavailable ('+response.status+')');const d=await response.json(),bytes=Buffer.from(d.data?.[0]?.b64_json||'','base64');if(bytes.length<100||bytes.length>3000000)throw Error('Invalid image response');
   const key=a.id+'/'+r.id+'.webp';await getStore({name:'market-lab-avatars',consistency:'strong'}).set(key,bytes);
   a.images.push({id:r.id,key,prompt:r.prompt,createdAt:new Date().toISOString()});a.avatarId=r.id;if(a.needsIdentity){a.displayName=r.chosenName;a.name=r.chosenName;a.needsIdentity=false;a.lifecycle='active';a.status='Ready for paper research';}
   if(!r.free){a.cash-=r.price;a.cosmeticSpent+=r.price;}
   r.status='completed';r.completedAt=new Date().toISOString();state.imageBudget.reserved-=.10;state.imageBudget.spent+=.10;
   event={type:'PROFILE_IMAGE',agent:a.id,request:r.id,free:r.free,amount:r.price,detail:'Agent-selected profile picture saved. API budget conservatively charged $0.10.'};await commit();return {status:'completed',agent:a.id};
  }
  await commit();return {status:'idle'};
 }catch(e){if(request){request.status='failed';request.error=String(e.message).slice(0,200);if(state.imageBudget.reserved>=.10){state.imageBudget.reserved-=.10;state.imageBudget.spent+=.10;}}event={type:'IMAGE_ERROR',detail:String(e.message).slice(0,200)};await commit();return {status:'failed',error:event.detail};}
}
