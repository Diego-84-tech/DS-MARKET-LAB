import {gzipSync} from 'node:zlib';
import {getStore} from '@netlify/blobs';
import {gateway} from './store.mjs';
import {collect,spot,compactMarket,publicGet} from './market.mjs';
import {decide} from './agents.mjs';
import {executeOrders,queueOrder,applyLoan,repay,reserveBudget,finishBudget,totals,MS_DAY} from './engine.mjs';
export async function runTick({archive=true}={}){
 if(!process.env.MARKET_LAB_WORKER_SECRET||!process.env.OPENAI_API_KEY)throw Error('Cloud credentials are not configured');
 const lock=await gateway('lease');if(lock.busy)return {status:'busy'};let revision=lock.revision;const state=lock.state,events=[];
 const commit=async(release=true,snapshot=null)=>{const r=await gateway('commit',{state,lease:lock.lease,revision,events:events.splice(0),release,...(snapshot?{snapshot}:{})});revision=r.revision;};
 try{
  if(state.mode!=='running'){await commit();return {status:state.mode};}
  const now=Date.now();
  if(now>=Date.parse(state.endsAt)||now>=Date.parse(state.keyExpiresAt)){state.mode='paused';state.error='Test window or key-expiry safety deadline reached. Owner review required.';await commit();return {status:'paused'};}
  if(lock.databaseBytes>460*1024*1024){state.mode='paused';state.error='DS HUB storage guard: database is above 460 MiB. No new market records or API calls.';await commit();return {status:'storage-paused'};}
  const raw=await collect(state,now);state.markets=raw.map(compactMarket);const markets=state.markets;
  try{state.spot.push(await spot());state.spot=state.spot.slice(-60);}catch{state.spot=state.spot.filter(x=>now-Date.parse(x.receivedAt)<3600000);}
  if(archive){const store=getStore({name:'market-lab-recordings',consistency:'strong'});const key=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.json.gz';await store.set(key,new Blob([gzipSync(JSON.stringify({source:'kalshi-public-rest',at:new Date().toISOString(),markets:raw,spot:state.spot.at(-1)}))]),{metadata:{expiresAt:new Date(now+30*MS_DAY).toISOString()}});state.verification.archiveWrites++;
   if(!state.lastArchiveCleanup||now-state.lastArchiveCleanup>MS_DAY){const listing=await store.list();for(const blob of listing.blobs||[]){const d=Date.parse(blob.key.slice(0,10));if(Number.isFinite(d)&&d<now-30*MS_DAY)await store.delete(blob.key);}state.lastArchiveCleanup=now;}
  }
  events.push(...executeOrders(state,markets,Date.now()));
  // Attempt near-close liquidation each tick; an unfilled attempt remains open until official settlement.
  for(const a of state.agents){for(const p of a.positions){const m=markets.find(x=>x.ticker===p.market);if(!a.orders.length&&m?.status==='active'&&(Date.parse(m.close_time)-now<120000||now>p.deadline)){const q=m.quotes?.[p.side==='YES'?'yesBid':'noBid'];if(q?.price>0)queueOrder(state,a,{action:'SELL',side:p.side,fraction:1,limit:1,summary:'Attempt near-close / planned-horizon exit; fill not guaranteed'},m,now);}}
   if(a.loans.some(l=>l.dueAt<=now)&&a.cash>0){const paid=repay(state,a,a.cash,now);if(paid)events.push({agent:a.id,type:'REPAY',amount:paid,detail:'Due-date repayment from available cash'});}
  }
  // Persist execution and reserve each API call BEFORE sending it. Unknown costs remain charged.
  await commit(false);
  for(const a of state.agents){
   if(Date.now()-a.lastDecision<a.interval||!markets.length||a.orders.length)continue;
   if(!reserveBudget(state,Date.now())){a.status='API budget reached; no model call';continue;}
   a.lastDecision=Date.now();await commit(false);
   try{const output=await decide(state,a,markets);finishBudget(state,output.usage);a.name ||= output.decision.name;const d=output.decision;a.decision=d;a.status=d.action;state.verification.apiDecisions++;events.push({agent:a.id,type:'DECISION',decision:d,usage:output.usage,responseId:output.responseId});
    const m=markets.find(x=>x.ticker===d.market);
    if(d.action==='BUY'||d.action==='SELL'){
     if(d.action==='BUY'){const q=m?.quotes?.[d.side==='YES'?'yesAsk':'noAsk'];const probability=d.side==='YES'?d.probability:1-d.probability;if(!q||probability-q.price/10000<.05)throw Error('Insufficient estimated edge (5 percentage-point cost/uncertainty margin required)');if(d.limit>Math.floor((probability-.05)*10000))throw Error('Proposed limit exceeds estimated probability less uncertainty allowance');}
     const order=queueOrder(state,a,d,m,Date.now());events.push({agent:a.id,type:'ORDER',order});
    }else if(d.action==='REQUEST_LOAN'){const application=applyLoan(state,a,d.amountCents,d.summary+' Repayment: '+d.exitPlan);events.push({agent:a.id,type:'APPLICATION',application});}
    else if(d.action==='REPAY'&&d.amountCents>0){const paid=repay(state,a,d.amountCents);events.push({agent:a.id,type:'REPAY',amount:paid});}
    state.notes.push({agent:a.id,at:d.at,lesson:d.lesson,evidence:d.evidence});state.notes=state.notes.slice(-20);
   }catch(e){if(state.budget.reserved>0)finishBudget(state,null);events.push({agent:a.id,type:'WITHHELD',detail:String(e.message).slice(0,220)});a.status='Decision / execution withheld';}
   await commit(false);
  }
  state.lastTick=new Date().toISOString();state.error=null;state.verification.ticks++;
  const elapsed=now-Date.parse(state.startedAt);for(const day of [10,20,30])if(elapsed>=day*MS_DAY&&!state.checkpoints.some(x=>x.day===day)){const report={day,at:state.lastTick,accounts:state.agents.map(a=>({id:a.id,...totals(a)}))};state.checkpoints.push(report);events.push({type:'REVIEW',report});}
  await commit(true,{at:state.lastTick,accounts:state.agents.map(a=>({id:a.id,...totals(a)}))});return {status:'ok',ticks:state.verification.ticks,decisions:state.verification.apiDecisions};
 }catch(e){state.lastTick=new Date().toISOString();state.error=String(e.message).slice(0,220);events.push({type:'ERROR',detail:state.error});await commit().catch(()=>{});return {status:'error',error:state.error};}
}
export async function control(jwt,action,payload={}){
 // A valid DS HUB owner session is mandatory; the gateway enforces the pinned owner ID.
 await gateway('read',{},jwt);const lock=await gateway('lease');if(lock.busy)throw Error('Worker is busy. Try again shortly.');const s=lock.state;let event;
 try{
  if(action==='start'){const now=Date.now();if(!s.startedAt){s.startedAt=new Date(now).toISOString();s.endsAt=new Date(now+30*MS_DAY).toISOString();}if(now>=Date.parse(s.endsAt))throw Error('Experiment ended. Preserve records and review before a new experiment.');s.mode='running';s.error=null;event={type:'START',detail:'Owner enabled paper test'};}
  else if(action==='pause'){s.mode='paused';event={type:'PAUSE',detail:'Owner paused paper test'};}
  else if(action==='loan'){const a=approve(s,payload);event={type:'LOAN_REVIEW',application:a};}
  else throw Error('Unknown control');
  await gateway('commit',{state:s,revision:lock.revision,lease:lock.lease,events:[event]});return {ok:true};
 }catch(e){await gateway('commit',{state:lock.state,revision:lock.revision,lease:lock.lease,events:[]}).catch(()=>{});throw e;}
}
import {approveLoan as approveBank} from './engine.mjs';
function approve(s,p){return approveBank(s,String(p.id),Number(p.amount),p.approve===true);}
