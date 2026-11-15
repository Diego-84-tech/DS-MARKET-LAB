import {updateAchievements} from '../dist/achievements.mjs';
import {resumeBlock} from '../dist/review.mjs';
import {researchMarkets,decisionCheck,exitTrigger,reviewForecasts} from './research.mjs';
import {upgrade,requestImage,reviewImage} from './identity.mjs';
import {recordMarkets} from './recordings.mjs';
import {gzipSync} from 'node:zlib';
import {getStore} from '@netlify/blobs';
import {gateway} from './store.mjs';
import {collect,spot,compactMarket,publicGet} from './market.mjs';
import {decide} from './agents.mjs';
import {executeOrders,queueOrder,applyLoan,repay,reserveBudget,finishBudget,totals,MS_DAY,shouldMonitor,pauseEntries} from './engine.mjs';
export async function runTick({archive=true,services={}}={}){
 const io={gateway,collect,spot,decide,researchMarkets,recordMarkets,publicGet,...services};
 if(!services.gateway&&(!process.env.MARKET_LAB_WORKER_SECRET||!process.env.OPENAI_API_KEY))throw Error('Cloud credentials are not configured');
 const lock=await io.gateway('lease');if(lock.busy)return {status:'busy'};let revision=lock.revision;const state=upgrade(lock.state),events=[];let recordings=[];
 const commit=async(release=true,snapshot=null)=>{events.push(...updateAchievements(state,events));const batch=events.slice(),savedRecordings=recordings.slice();const r=await io.gateway('commit',{state,lease:lock.lease,revision,events:batch,recordings:savedRecordings,release,...(snapshot?{snapshot}:{})});revision=r.revision;events.splice(0,batch.length);recordings.splice(0,savedRecordings.length);};
 try{
  if(!shouldMonitor(state)){await commit();return {status:state.mode};}
  const now=Date.now();if(state.mode==='paused')for(const a of state.agents)a.orders=a.orders.filter(o=>o.action==='SELL');
  if(state.phase==='verification'&&(!Number.isFinite(Date.parse(state.verificationEndsAt))||now>=Date.parse(state.verificationEndsAt))){state.mode='paused';state.error='Ten-minute cloud verification ended. Owner review required before the 30-day experiment.';await commit();return {status:'verification-ended'};}
  if(now>=Date.parse(state.endsAt)||now>=Date.parse(state.keyExpiresAt)){state.mode='settling';state.error='Test window or key safety deadline reached. No new entries or model calls; following existing positions to official outcomes.';for(const a of state.agents)a.orders=a.orders.filter(o=>o.action==='SELL');}
  if(lock.databaseBytes>460*1024*1024){state.mode='paused';state.error='DS HUB storage guard: database is above 460 MiB. No new market records or API calls.';await commit();return {status:'storage-paused'};}
  const raw=await io.collect(state,now);state.markets=raw.map(compactMarket);const markets=state.markets;recordings=await io.recordMarkets(state,markets,now);
  try{state.spot.push(await io.spot());state.spot=state.spot.slice(-60);}catch{state.spot=state.spot.filter(x=>now-Date.parse(x.receivedAt)<3600000);}
  if(archive){const store=getStore({name:'market-lab-recordings',consistency:'strong'});const key=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.json.gz';await store.set(key,new Blob([gzipSync(JSON.stringify({source:'kalshi-public-rest',at:new Date().toISOString(),markets:raw,spot:state.spot.at(-1)}))]),{metadata:{expiresAt:new Date(now+30*MS_DAY).toISOString()}});state.verification.archiveWrites++;
   if(!state.lastArchiveCleanup||now-state.lastArchiveCleanup>MS_DAY){const listing=await store.list();for(const blob of listing.blobs||[]){const d=Date.parse(blob.key.slice(0,10));if(Number.isFinite(d)&&d<now-30*MS_DAY)await store.delete(blob.key);}state.lastArchiveCleanup=now;}
  }
  const fills=executeOrders(state,markets,Date.now());events.push(...fills);
  for(const e of fills.filter(e=>['SELL','SETTLE'].includes(e.type))){const a=state.agents.find(a=>a.id===e.agent);a.closedTrades||=[];a.closedTrades.push({market:e.market,at:e.at||new Date().toISOString(),type:e.type,pnl:e.pnl,reason:e.reason||'Official settlement',entryForecast:e.entryForecast||null});a.closedTrades=a.closedTrades.slice(-12);}
  state.reviewForecasts||=[];
  const unresolved=[...new Set(state.reviewForecasts.map(e=>e.decision.market))].filter(t=>!state.reviewOutcomes?.some(m=>m.ticker===t));state.reviewOutcomes||=[];
  for(const t of unresolved.slice(0,4)){try{const {data}=await io.publicGet('/markets/'+encodeURIComponent(t));if(['settled','finalized'].includes(data.market?.status)&&data.market.is_provisional!==true)state.reviewOutcomes.push({ticker:t,status:data.market.status,result:data.market.result,is_provisional:data.market.is_provisional,settlement_ts:data.market.settlement_ts,close_time:data.market.close_time});}catch{}}
  state.reviewOutcomes=state.reviewOutcomes.slice(-60);state.forecastReview=reviewForecasts(state.reviewForecasts,state.reviewOutcomes);state.forecastReview.observations=state.forecastReview.observations.slice(-60);
  // Attempt near-close liquidation each tick; an unfilled attempt remains open until official settlement.
  for(const a of state.agents){for(const p of a.positions){const m=markets.find(x=>x.ticker===p.market);const trigger=exitTrigger(p,m,Date.now());if(!a.orders.length&&trigger){const q=m.quotes?.[p.side==='YES'?'yesBid':'noBid'];if(q?.price>0)queueOrder(state,a,{action:'SELL',side:p.side,fraction:1,limit:1,automaticExit:true,summary:trigger+'; conservative paper exit attempted, fill not guaranteed'},m,now);}}
   if(a.loans.some(l=>l.dueAt<=now)&&a.cash>0){const paid=repay(state,a,a.cash,now);if(paid)events.push({agent:a.id,type:'REPAY',amount:paid,detail:'Due-date repayment from available cash'});}
  }
  // Persist execution and reserve each API call BEFORE sending it. Unknown costs remain charged.
  await commit(false);
  for(const a of state.agents){
   if((state.mode!=='running'&&!state.reviewResearch)||Date.now()-a.lastDecision<a.interval||!markets.length||a.orders.length)continue;
   if(!reserveBudget(state,Date.now())){a.status='API budget reached; no model call';continue;}
   a.lastDecision=Date.now();await commit(false);
   try{const research=await io.researchMarkets(markets.filter(m=>a.id==='B'||m.series==='KXBTC15M'));const output=await io.decide(state,a,research);finishBudget(state,output.usage);a.name ||= output.decision.name;const d=output.decision;a.decision=d;a.status=d.action;state.verification.apiDecisions++;events.push({agent:a.id,type:'DECISION',market:d.market,marketSnapshot:(()=>{const m=markets.find(m=>m.ticker===d.market);return m?{ticker:m.ticker,title:m.title,receivedAt:m.receivedAt,close_time:m.close_time,quotes:m.quotes,feeVerified:m.feeVerified,multiplier:m.multiplier,floor_strike:m.floor_strike}:null;})(),decision:d,usage:output.usage,responseId:output.responseId});
    const m=research.find(x=>x.ticker===d.market);if(d.market&&m&&Number.isFinite(d.probability)&&!state.reviewForecasts.some(x=>x.agent===a.id&&x.decision.market===d.market)){state.reviewForecasts.push({agent:a.id,at:d.at,decision:{market:d.market,probability:d.probability,at:d.at,action:d.action,promptVersion:d.promptVersion}});state.reviewForecasts=state.reviewForecasts.slice(-60);}
    const assessment=decisionCheck(a,d,m,Date.now());a.decision.assessment=assessment;
    events.push({agent:a.id,type:'ASSESSMENT',checked:true,market:d.market,assessment,history:m?.history||null});
    if(d.action==='BUY'||d.action==='SELL'){
     if(d.action==='BUY'&&state.reviewRequired){a.status='Review only · purchase not placed';events.push({agent:a.id,type:'SHADOW_PROPOSAL',market:d.market,detail:'New purchases remain paused. This checked proposal is recorded for review, not execution.',assessment});}
     else {
     const order=queueOrder(state,a,{...d,assessment},m,Date.now());events.push({agent:a.id,type:'ORDER',order});}
    }else if(state.mode!=='running'){a.status='Review only · '+d.action;}
    else if(d.action==='REQUEST_LOAN'){const application=applyLoan(state,a,d.amountCents,d.summary+' Repayment: '+d.exitPlan);events.push({agent:a.id,type:'APPLICATION',application});}
    else if(d.action==='REQUEST_IMAGE'){const application=requestImage(a,d.imagePrompt||d.evidence,d.summary);events.push({agent:a.id,type:'IMAGE_APPLICATION',application});}
    else if(d.action==='REPAY'&&d.amountCents>0){const paid=repay(state,a,d.amountCents);events.push({agent:a.id,type:'REPAY',amount:paid});}
    state.notes.push({agent:a.id,at:d.at,lesson:d.lesson,evidence:d.evidence});state.notes=state.notes.slice(-20);
   }catch(e){if(state.budget.reserved>0)finishBudget(state,null);events.push({agent:a.id,type:'WITHHELD',market:a.decision?.market,decisionAt:a.decision?.at,detail:String(e.message).slice(0,220)});a.status='Decision / execution withheld';}
   await commit(false);
  }
  state.lastTick=new Date().toISOString();if(state.mode==='running')state.error=null;state.verification.ticks++;
  const elapsed=now-Date.parse(state.startedAt);for(const day of [10,20,30])if(elapsed>=day*MS_DAY&&!state.checkpoints.some(x=>x.day===day)){const report={day,at:state.lastTick,accounts:state.agents.map(a=>({id:a.id,...totals(a)}))};state.checkpoints.push(report);events.push({type:'REVIEW',report});}
  if(state.mode==='settling'&&state.agents.every(a=>!a.positions.length&&!a.orders.length))state.mode='completed';
  await commit(true,{at:state.lastTick,accounts:state.agents.map(a=>({id:a.id,...totals(a)}))});return {status:'ok',ticks:state.verification.ticks,decisions:state.verification.apiDecisions};
 }catch(e){state.lastTick=new Date().toISOString();state.error=String(e.message).slice(0,220);events.push({type:'ERROR',detail:state.error});await commit().catch(()=>{});return {status:'error',error:state.error};}
}
export async function control(jwt,action,payload={}){
 // A valid DS HUB owner session is mandatory; the gateway enforces the pinned owner ID.
 await gateway('read',{},jwt);const lock=await gateway('lease');if(lock.busy)throw Error('Worker is busy. Try again shortly.');const s=upgrade(structuredClone(lock.state));let event;
 try{
  if(action==='start'){const blocked=resumeBlock(s,payload.reviewAcknowledged);if(blocked)throw Error(blocked);const now=Date.now();if(s.phase==='verification'){if(s.verification.ticks<2)throw Error('Cloud verification must complete first.');s.phase='experiment';s.budget.cap=30;s.budget.dailyCap=1;s.verificationEndsAt=null;}if(!s.startedAt){s.startedAt=new Date(now).toISOString();s.endsAt=new Date(now+30*MS_DAY).toISOString();}if(now>=Date.parse(s.endsAt))throw Error('Experiment ended. Preserve records and review before a new experiment.');s.reviewRequired=false;s.reviewResearch=false;s.mode='running';s.error=null;event={type:'START',detail:'Owner enabled paper test'};}
  else if(action==='pause'){pauseEntries(s);s.reviewResearch=false;event={type:'PAUSE',detail:'Owner paused paper test'};}
  else if(action==='review'){pauseEntries(s);s.reviewRequired=true;s.reviewResearch=true;event={type:'REVIEW_RESEARCH',detail:'Owner enabled research-only proposals; new purchases remain blocked.'};}
  else if(action==='loan'){const a=approve(s,payload);event={type:'LOAN_REVIEW',application:a};}
  else if(action==='image-review'){const a=s.agents.find(a=>a.id===payload.agent);if(!a)throw Error('Unknown agent');const application=reviewImage(a,payload.id,payload.approve===true);event={type:'IMAGE_REVIEW',agent:a.id,application};}
  else throw Error('Unknown control');
  await gateway('commit',{state:s,revision:lock.revision,lease:lock.lease,events:[event]});return {ok:true};
 }catch(e){await gateway('commit',{state:lock.state,revision:lock.revision,lease:lock.lease,events:[]}).catch(()=>{});throw e;}
}
import {approveLoan as approveBank} from './engine.mjs';
function approve(s,p){return approveBank(s,String(p.id),Number(p.amount),p.approve===true);}
