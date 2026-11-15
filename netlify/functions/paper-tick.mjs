import {runTick} from '../../cloud/worker.mjs';
export const config={schedule:'* * * * *'};
export default async()=>{if(!process.env.OPENAI_API_KEY||!process.env.MARKET_LAB_WORKER_SECRET){console.log('Paper worker awaiting runtime credential setup; no requests or trades.');return new Response(null,{status:204});}const result=await runTick();console.log(JSON.stringify(result));return new Response(null,{status:204});};
