import {runTick} from '../../cloud/worker.mjs';
export const config={schedule:'* * * * *'};
export default async()=>{const result=await runTick();console.log(JSON.stringify(result));return new Response(null,{status:204});};
