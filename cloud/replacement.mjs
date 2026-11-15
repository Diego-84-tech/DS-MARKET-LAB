import {initialState,repay} from './engine.mjs';
import {identity,upgrade} from './identity.mjs';
export function requestReplacement(state,p,now=Date.now()){
 const a=state.agents.find(a=>a.id===p.agent);if(!a)throw Error('Agent not found');
 if(p.confirmed!==true||p.expectedRunId!==a.runId)throw Error('Confirm the exact current agent before replacement.');
 if(a.lifecycle!=='active')throw Error('This agent already has a lifecycle operation in progress.');
 a.replacement={id:crypto.randomUUID(),requestedAt:new Date(now).toISOString(),startingCash:a.start,reason:String(p.reason||'Owner requested a new agent').slice(0,500),status:'waiting'};a.lifecycle='retiring';a.orders=a.orders.filter(o=>o.action==='SELL');
 for(const x of a.applications)if(x.status==='pending')x.status='withdrawn';
 for(const x of a.imageRequests||[])if(['pending','approved'].includes(x.status))x.status='cancelled';
 a.status='Replacement requested · existing obligations remain monitored';return a.replacement;
}
export function settleRetiring(state,events,now=Date.now()){
 for(const a of state.agents.filter(a=>a.lifecycle==='retiring')){
  if(a.loans.length&&a.cash>0){const amount=repay(state,a,a.cash,now);if(amount)events.push({type:'REPAY',agent:a.id,runId:a.runId,amount,detail:'Repayment from retiring agent cash; no other account funds used.'});}
  a.replacement.status=a.positions.length||a.orders.length?'waiting for investments':a.loans.length?'waiting for debt settlement':'ready to archive';
 }
}
export function freshReplacement(snapshot,archiveId,now=Date.now()){
 const old=snapshot.agent,a=initialState(now).agents.find(a=>a.id===old.id);a.runId=crypto.randomUUID();a.runNumber=(old.runNumber||1)+1;a.runStartedAt=new Date(now).toISOString();a.start=old.replacement.startingCash;a.cash=a.start;a.name=null;a.displayName=null;a.appId=old.appId;a.role=old.role||identity(old.id).name;a.lifecycle='onboarding';a.needsIdentity=true;a.previousArchiveId=archiveId;
 a.handover={archiveId,previousName:old.displayName||old.name,previousResult:old.realized-old.interestPaid,rule:'Historical hypotheses are unverified. Review source evidence before using them; do not copy unsupported conclusions.'};
 upgrade({agents:[a],version:'0.5.0'});return a;
}
