// Offline practice only. The unattended market-data runner is a later phase.
import {writeFile} from 'node:fs/promises';
import {practiceFrames,run,VERSION} from '../dist/engine.mjs';
const scenario=process.argv[2]||'mixed';
if(!['mixed','trend','whipsaw'].includes(scenario))throw new Error('Choose mixed, trend, or whipsaw.');
const frames=practiceFrames(scenario),result=run(frames);
const recording={kind:'ds-market-lab-recording',version:VERSION,id:'cli-'+Date.now(),title:scenario+' offline practice',scenario,source:'fictional-practice',created:new Date().toISOString(),cursor:frames.length-1,frames};
if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(recording,null,2),{flag:'wx'});
console.log(JSON.stringify({source:'fictional-practice',scenario,realOrders:false,apiCalls:0,wallets:result.wallets.map(w=>({agent:w.id,cashDollars:w.cash/100,realizedDollars:w.realized/100,modeledFeesDollars:w.fees/100,closedTrades:w.trades}))},null,2));
