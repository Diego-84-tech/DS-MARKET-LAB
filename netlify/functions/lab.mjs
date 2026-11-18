import {readArchiveFile} from '../../cloud/archive-read.mjs';
import {workspaceGateway,archiveGateway} from '../../cloud/store.mjs';
import {validTicker} from '../../dist/market-id.mjs';
import {getStore} from '@netlify/blobs';
import {gateway,SUPABASE_URL,PUBLIC_KEY} from '../../cloud/store.mjs';
import {control} from '../../cloud/worker.mjs';
export const config={path:'/api/lab/*'};
export default async function handler(req){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 try{
  const path=new URL(req.url).pathname.replace('/.netlify/functions/lab','/api/lab');
  if(path==='/api/lab/config'&&req.method==='GET')return Response.json({url:SUPABASE_URL,key:PUBLIC_KEY,version:'0.9.0',workerConfigured:!!(process.env.OPENAI_API_KEY&&process.env.MARKET_LAB_WORKER_SECRET)},{headers});
  const bearer=req.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))return Response.json({error:'Sign in with your DS HUB owner account.'},{status:401,headers});
  const jwt=bearer.slice(7);if(req.method==='GET'&&path==='/api/lab/history')return Response.json(await gateway('history',{after:Number(new URL(req.url).searchParams.get('after')||0)},jwt),{headers});if(req.method==='GET'&&path==='/api/lab/state')return Response.json(await gateway('read',{},jwt),{headers});
  if(path==='/api/lab/workspace'){
   const url=new URL(req.url);if(req.method==='GET'){const action=url.searchParams.get('action');if(!['instructions','messages'].includes(action))throw Error('Unknown workspace read');return Response.json(await workspaceGateway(action,Object.fromEntries(url.searchParams),jwt),{headers});}
   if(req.method==='POST'){const origin=req.headers.get('origin');if(origin!==url.origin)return Response.json({error:'Same-origin request required'},{status:403,headers});const raw=await req.text();if(raw.length>24000)throw Error('Request too large');const body=JSON.parse(raw);if(!['instruction-apply','instruction-retire','settings','like','message-send','message-cancel'].includes(body.action))throw Error('Unknown workspace action');const result=await workspaceGateway(body.action,body,jwt);if(body.action==='message-send'&&process.env.URL)try{await fetch(process.env.URL+'/.netlify/functions/chat-background',{method:'POST',headers:{'x-worker-secret':process.env.MARKET_LAB_WORKER_SECRET},signal:AbortSignal.timeout(2000)});}catch{}return Response.json(result,{headers});}
  }
  if(req.method==='GET'&&path==='/api/lab/archives')return Response.json(await archiveGateway('list',{},jwt),{headers});
  if(req.method==='GET'&&['/api/lab/archive','/api/lab/archive-file'].includes(path)){const params=new URL(req.url).searchParams,detail=await archiveGateway('detail',{id:params.get('id')},jwt);if(path==='/api/lab/archive')return Response.json(detail,{headers});return readArchiveFile(detail,Number(params.get('page')),params.get('path'));}
  if(req.method==='GET'&&path==='/api/lab/recordings')return Response.json(await gateway('recordings',{},jwt),{headers});
  if(req.method==='GET'&&path==='/api/lab/recording'){const ticker=new URL(req.url).searchParams.get('ticker');if(!validTicker(ticker))throw Error('Invalid ticker');return Response.json(await gateway('recording',{ticker},jwt),{headers});}
  if(req.method==='GET'&&path==='/api/lab/avatar'){const d=await gateway('read',{},jwt),id=new URL(req.url).searchParams.get('id');const image=d.state.agents.flatMap(a=>a.images||[]).find(i=>i.id===id);if(!image)return new Response(null,{status:404,headers});const bytes=await getStore({name:'market-lab-avatars',consistency:'strong'}).get(image.key,{type:'arrayBuffer'});return new Response(bytes,{headers:{...headers,'Content-Type':'image/webp'}});}
  if(req.method==='POST'&&path==='/api/lab/control'){
   const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return Response.json({error:'Same-origin request required'},{status:403,headers});
   const text=await req.text();if(text.length>4000)throw Error('Request too large');const body=JSON.parse(text);return Response.json(await control(jwt,body.action,body),{headers});
  }
  return Response.json({error:'Not found'},{status:404,headers});
 }catch(e){return Response.json({error:String(e.message).slice(0,220)},{status:400,headers});}
}
