import {timingSafeEqual} from 'node:crypto';
import {runArchiveJob} from '../../cloud/archive-job.mjs';
export default async req=>{
 const got=Buffer.from(req.headers.get('x-worker-secret')||''),expected=Buffer.from(process.env.MARKET_LAB_WORKER_SECRET||'');
 if(req.method!=='POST'||!expected.length||got.length!==expected.length||!timingSafeEqual(got,expected))return new Response(null,{status:403});
 try{console.log(JSON.stringify(await runArchiveJob()));}catch(e){console.error('Archive remains incomplete; replacement blocked:',String(e.message).slice(0,200));}return new Response(null,{status:204});
};
