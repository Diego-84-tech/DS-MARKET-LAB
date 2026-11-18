import {applyLoan,approveLoan} from './engine.mjs';
export function ownerFunding(state,p,now=Date.now()){
 const a=state.agents.find(a=>a.id===p.agent);if(!a||a.runId!==p.expectedRunId||a.lifecycle!=='active')throw Error('Choose the current active agent run');
 if(p.confirmed!==true||typeof p.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(p.requestId))throw Error('Review and confirm this funding first');
 a.ownerFunding ||= [];if(a.ownerFunding.some(x=>x.id===p.requestId))return {type:'OWNER_FUNDING_DUPLICATE',agent:a.id,runId:a.runId,detail:'Funding request already applied; no second payment.'};
 const amount=Number(p.amount);if(!Number.isSafeInteger(amount)||amount<1||!Number.isSafeInteger(a.cash+amount))throw Error('Enter a valid positive amount in cents');
 const reason=String(p.reason||'Owner supplied paper capital').slice(0,800),kind=p.kind==='loan'?'loan':'grant';let application=null;
 if(kind==='loan'){application=applyLoan(state,a,amount,reason,now);application.initiatedBy='Owner';approveLoan(state,application.id,amount,true,now);}else{a.cash+=amount;a.ownerCredits=(a.ownerCredits||0)+amount;}
 const entry={id:p.requestId,kind,amount,reason,at:new Date(now).toISOString()};a.ownerFunding.push(entry);
 return {type:kind==='loan'?'OWNER_LOAN':'OWNER_CAPITAL',agent:a.id,runId:a.runId,...entry,application,detail:kind==='loan'?'Owner initiated and approved a paper loan under existing bank terms.':'Owner added paper capital. This is excluded from trading earnings and does not fund API requests.'};
}
