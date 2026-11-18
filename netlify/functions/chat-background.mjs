import {timingSafeEqual} from 'node:crypto';
import {runChat} from '../../cloud/chat.mjs';
export default async req=>{
 const got=Buffer.from(req.headers.get('x-worker-secret')||''),expected=Buffer.from(process.env.MARKET_LAB_WORKER_SECRET||'');if(req.method!=='POST'||!expected.length||got.length!==expected.length||!timingSafeEqual(got,expected))return new Response(null,{status:403});
 for(let n=0;n<2;n++){const result=await runChat();console.log(JSON.stringify(result));if(result.idle||result.busy||result.status!=='complete')break;}return new Response(null,{status:204});
};
