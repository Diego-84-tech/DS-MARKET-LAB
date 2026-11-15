export const config={schedule:'*/5 * * * *'};
export default async()=>{
 if(!process.env.URL||!process.env.MARKET_LAB_WORKER_SECRET)return new Response(null,{status:204});
 const r=await fetch(process.env.URL+'/.netlify/functions/archive-background',{method:'POST',headers:{'x-worker-secret':process.env.MARKET_LAB_WORKER_SECRET},signal:AbortSignal.timeout(5000)});console.log('Archive dispatch',r.status);return new Response(null,{status:204});
};
