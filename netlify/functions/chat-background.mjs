import {timingSafeEqual} from 'node:crypto';
import {runChat} from '../../cloud/chat.mjs';
export default async req=>{
 const got=Buffer.from(req.headers.get('x-worker-secret')||''),expected=Buffer.from(process.env.MARKET_LAB_WORKER_SECRET||'');if(req.method!=='POST'||!expected.length||got.length!==expected.length||!timingSafeEqual(got,expected))return new Response(null,{status:403});
 let completed=0;for(let n=0;n<20&&completed<2;n++){const result=await runChat();console.log(JSON.stringify(result));if(result.busy){await new Promise(resolve=>setTimeout(resolve,1500));continue;}if(result.idle||result.status!=='complete')break;completed++;}return new Response(null,{status:204});
};
