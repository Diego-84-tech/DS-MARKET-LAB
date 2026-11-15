import {gateway,SUPABASE_URL,PUBLIC_KEY} from '../../cloud/store.mjs';
import {control} from '../../cloud/worker.mjs';
export const config={path:'/api/lab/*'};
export default async function handler(req){
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 try{
  const path=new URL(req.url).pathname.replace('/.netlify/functions/lab','/api/lab');
  if(path==='/api/lab/config'&&req.method==='GET')return Response.json({url:SUPABASE_URL,key:PUBLIC_KEY,version:'0.4.1',workerConfigured:!!(process.env.OPENAI_API_KEY&&process.env.MARKET_LAB_WORKER_SECRET)},{headers});
  const bearer=req.headers.get('authorization')||'';if(!bearer.startsWith('Bearer '))return Response.json({error:'Sign in with your DS HUB owner account.'},{status:401,headers});
  const jwt=bearer.slice(7);if(req.method==='GET'&&path==='/api/lab/history')return Response.json(await gateway('history',{after:Number(new URL(req.url).searchParams.get('after')||0)},jwt),{headers});if(req.method==='GET'&&path==='/api/lab/state')return Response.json(await gateway('read',{},jwt),{headers});
  if(req.method==='POST'&&path==='/api/lab/control'){
   const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return Response.json({error:'Same-origin request required'},{status:403,headers});
   const text=await req.text();if(text.length>4000)throw Error('Request too large');const body=JSON.parse(text);return Response.json(await control(jwt,body.action,body),{headers});
  }
  return Response.json({error:'Not found'},{status:404,headers});
 }catch(e){return Response.json({error:String(e.message).slice(0,220)},{status:400,headers});}
}
