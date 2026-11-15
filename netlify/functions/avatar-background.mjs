import {timingSafeEqual} from 'node:crypto';
import {generateAvatar} from '../../cloud/avatars.mjs';
export default async req=>{
 const incoming=Buffer.from(req.headers.get('x-worker-secret')||''),expected=Buffer.from(process.env.MARKET_LAB_WORKER_SECRET||'');
 if(req.method!=='POST'||!expected.length||incoming.length!==expected.length||!timingSafeEqual(incoming,expected))return new Response(null,{status:403});
 console.log(JSON.stringify(await generateAvatar()));return new Response(null,{status:204});
};
