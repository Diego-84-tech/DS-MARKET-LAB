// Paper ledger only. No broker credentials or order submission endpoints exist.
export const APP_VERSION='0.8.0';
export const LEDGER_VERSION='0.5.0';
export const POLICY_VERSION='bank-23apr-v1';
export const MS_DAY=86400000;
export function initialState(now=Date.now()){
 const agent=(id,start,interval)=>({id,name:null,start,cash:start,realized:0,fees:0,interestPaid:0,positions:[],loans:[],applications:[],orders:[],lastDecision:0,interval,decision:null,peak:start,maxDrawdown:0});
 return {version:LEDGER_VERSION,releaseVersion:APP_VERSION,policyVersion:POLICY_VERSION,createdAt:new Date(now).toISOString(),startedAt:null,endsAt:null,mode:'paused',phase:'verification',lastTick:null,error:null,agents:[agent('A',10000,300000),agent('B',50000,1800000)],bank:{capital:60000,available:60000,interestEarned:0},budget:{cap:30,dailyCap:1,spent:0,reserved:0,day:'',daySpent:0},markets:[],spot:[],notes:[],checkpoints:[],verification:{ticks:0,apiDecisions:0,archiveWrites:0},keyExpiresAt:'2026-12-14T23:59:59-05:00'};
}
export function interest(loan,now=Date.now()){return (loan.unpaidInterest||0)+Math.max(0,Math.ceil(loan.principal*loan.apr/100*Math.max(0,now-loan.accruedFrom)/MS_DAY/365-1e-8));}
export function totals(agent,now=Date.now()){
 const invested=agent.positions.reduce((s,p)=>s+p.cost,0),value=agent.positions.reduce((s,p)=>s+(p.mark??p.cost),0),debt=agent.loans.reduce((s,l)=>s+l.principal,0),owed=agent.loans.reduce((s,l)=>s+interest(l,now),0);
 const net=agent.cash+value-debt-owed;
 return {cash:agent.cash,invested,value,debt,interest:owed,realized:agent.realized-agent.interestPaid,unrealized:value-invested,net,pnl:net-agent.start,returnPct:100*(net-agent.start)/agent.start};
}
export function loanTerms(agent){
 const base=agent.id==='A'?10000:50000,first=base/2,outstanding=agent.loans.reduce((s,l)=>s+l.principal,0),repaid=agent.repaidLoans||0,extra=agent.supplementalLoans||0;
 if(!agent.loans.length)return {limit:repaid?base:first,apr:23,ceiling:base};
 return {limit:Math.max(0,Math.min(base-outstanding,extra===0?base*.25:extra===1?base*.1:0)),apr:extra===0?28:33,ceiling:base};
}
export function applyLoan(state,agent,amount,reason,now=Date.now()){
 const terms=loanTerms(agent);
 if(agent.applications.some(x=>x.status==='pending')||!Number.isInteger(amount)||amount<100||amount>terms.limit)throw Error('Loan request exceeds current eligibility or another request is pending.');
 const a={id:crypto.randomUUID(),agent:agent.id,amount,apr:terms.apr,reason:String(reason).slice(0,1200),status:'pending',createdAt:new Date(now).toISOString(),policyVersion:POLICY_VERSION};agent.applications.push(a);return a;
}
export function approveLoan(state,id,amount,approve,now=Date.now()){
 const agent=state.agents.find(a=>a.applications.some(x=>x.id===id));const app=agent?.applications.find(x=>x.id===id);
 if(!app||app.status!=='pending')throw Error('Application is no longer pending.');
 if(!approve){app.status='denied';app.reviewedAt=new Date(now).toISOString();return app;}
 const terms=loanTerms(agent);
 if(!Number.isInteger(amount)||amount<100||amount>app.amount||amount>terms.limit||amount>state.bank.available)throw Error('Approved amount exceeds the request, bank cash, or current debt limit.');
 if(agent.loans.length)agent.supplementalLoans=(agent.supplementalLoans||0)+1;
 agent.loans.push({id:app.id,principal:amount,apr:app.apr,accruedFrom:now,fundedAt:now,dueAt:now+30*MS_DAY});agent.cash+=amount;state.bank.available-=amount;app.status='approved';app.approvedAmount=amount;app.reviewedAt=new Date(now).toISOString();return app;
}
export function repay(state,agent,amount,now=Date.now()){
 if(!Number.isInteger(amount)||amount<1||amount>agent.cash)throw Error('Repayment must fit available cash.');
 let left=amount,paid=0;
 for(const l of agent.loans){if(!left)break;const owed=interest(l,now),i=Math.min(left,owed);left-=i;paid+=i;agent.interestPaid+=i;state.bank.interestEarned+=i;state.bank.available+=i;
  // Accrual balance retains unpaid interest without charging interest on it.
  l.unpaidInterest=owed-i;l.accruedFrom=now;
  const old=l.unpaidInterest,oldPay=Math.min(left,old);left-=oldPay;paid+=oldPay;l.unpaidInterest-=oldPay;agent.interestPaid+=oldPay;state.bank.interestEarned+=oldPay;state.bank.available+=oldPay;
  const principal=Math.min(left,l.principal);left-=principal;paid+=principal;l.principal-=principal;state.bank.available+=principal;
 }
 agent.cash-=paid;const cleared=agent.loans.filter(l=>l.principal===0&&!l.unpaidInterest).length;agent.repaidLoans=(agent.repaidLoans||0)+cleared;agent.loans=agent.loans.filter(l=>l.principal||l.unpaidInterest);return paid;
}
export function fee(quantity,price,multiplier=1){return Math.ceil(.07*multiplier*quantity*(price/10000)*(1-price/10000)*100-1e-8);}
export function quoteFor(m,side,action){return m?.quotes?.[side==='YES'?(action==='BUY'?'yesAsk':'yesBid'):(action==='BUY'?'noAsk':'noBid')];}
export function entryBlock(m,agent,now){
 if(!m)return 'The selected market was not supplied in this research update.';
 if(!Number.isFinite(Date.parse(m.open_time))||!Number.isFinite(Date.parse(m.close_time))||!Number.isFinite(Date.parse(m.latest_expiration_time||m.expiration_time||m.close_time)))return 'Market trading times or settlement horizon are missing.';
 if(m.status!=='active')return 'This market is not open for trading.';
 if(Date.parse(m.open_time)>now)return 'This market has not opened yet.';
 if(Date.parse(m.close_time)<=now)return 'This market has closed.';
 if(agent.id==='A'&&m.series!=='KXBTC15M')return 'AlphaBot only trades BTC 15-minute rounds.';
 if(agent.id==='A'&&Date.parse(m.close_time)-now<=120000)return 'Fewer than two minutes remain in this round. New entries stop two minutes before close.';
 if(Date.parse(m.latest_expiration_time||m.expiration_time||m.close_time)>now+30*MS_DAY)return 'Latest settlement is beyond the 30-day allowed horizon.';
 if(m.feeVerified!==true)return 'The series fee formula has not been verified. Paper fills remain blocked.';
 return null;
}
export const eligible=(m,agent,now)=>!entryBlock(m,agent,now);
export function queueOrder(state,agent,d,m,now=Date.now()){
 if(!['BUY','SELL'].includes(d.action)||!m||!['YES','NO'].includes(d.side)||!Number.isFinite(d.fraction)||d.fraction<=0||d.fraction>1||!Number.isInteger(d.limit)||d.limit<1||d.limit>9999)throw Error('Invalid proposed paper order.');
 if(d.action==='BUY'&&agent.lifecycle&&agent.lifecycle!=='active')throw Error('Agent is retiring or onboarding; new purchases are blocked.');
 if(d.action==='BUY'&&state.reviewRequired)throw Error('New purchases are paused for review.');
 if(agent.orders.length)throw Error('An order is already pending.');
 if(d.action==='BUY'&&entryBlock(m,agent,now))throw Error(entryBlock(m,agent,now));
 if(d.action==='BUY'&&agent.positions.length>=8)throw Error('Manage existing positions before opening more.');
 if(d.action==='SELL'&&!agent.positions.some(p=>p.market===m.ticker&&p.side===d.side))throw Error('No matching position to sell.');
 const o={id:crypto.randomUUID(),agent:agent.id,market:m.ticker,side:d.side,action:d.action,fraction:d.fraction,limit:d.limit,budget:Math.floor(agent.cash*d.fraction),createdAt:now,notBefore:now+10000,expiresAt:now+180000,reason:d.summary,automaticExit:d.automaticExit===true,entryForecast:Number.isFinite(d.probability)?{probability:d.probability,at:d.at||new Date(now).toISOString(),promptVersion:d.promptVersion||null}:null,exitPlan:d.assessment?.plan||null};agent.orders.push(o);return o;
}
export function executeOrders(state,markets,now=Date.now()){
 const events=[],consumed=new Map();
 for(const a of state.agents){const keep=[];
  for(const o of a.orders){if(o.action==='BUY'&&(state.reviewRequired||(a.lifecycle&&a.lifecycle!=='active'))){events.push({agent:a.id,type:'UNFILLED',market:o.market,side:o.side,order:o.id,detail:'New purchases are paused for review.'});continue;}const m=markets.find(m=>m.ticker===o.market);if(now<o.notBefore){keep.push(o);continue;}if(now>o.expiresAt){events.push({agent:a.id,type:'UNFILLED',detail:'Paper limit order expired',order:o.id,market:o.market,side:o.side});continue;}
   const q=quoteFor(m,o.side,o.action),fresh=m&&now-Date.parse(m.receivedAt)<=20000;
   if(!q||!fresh||m.quotes.crossed||m.status!=='active'||Date.parse(m.close_time)<=now||m.feeVerified!==true){keep.push(o);continue;}
   const valid=o.action==='BUY'?q.price<=o.limit:q.price>=o.limit;if(!valid){keep.push(o);continue;}
   // Use only 10% of displayed best-level depth; two agents share that allowance.
   const key=m.ticker+o.side+o.action,depth=Math.max(0,Math.floor(q.quantity/100*.1)-(consumed.get(key)||0));let quantity=0,gross=0,costFee=0,pnl=null,entryForecast=null,openedAt=null,positionClosed=false,planExit=false;
   if(o.action==='BUY'){
    if(o.exitPlan&&(now>=o.exitPlan.exitAt||q.price<=o.exitPlan.stopPrice)){events.push({agent:a.id,type:'UNFILLED',market:o.market,side:o.side,order:o.id,detail:'Entry cancelled: its time exit or loss-price invalidation was reached before fill.'});continue;}
    if(!eligible(m,a,now)){events.push({agent:a.id,type:'UNFILLED',detail:'Entry window or settlement horizon ended',order:o.id,market:o.market,side:o.side});continue;}
    const budget=Math.min(a.cash,o.budget);quantity=Math.min(depth,Math.floor(budget*100/q.price));while(quantity>0&&Math.ceil(quantity*q.price/100)+fee(quantity,q.price,m.multiplier)>budget)quantity--;
    if(!quantity){keep.push(o);continue;}gross=Math.ceil(quantity*q.price/100);costFee=fee(quantity,q.price,m.multiplier);a.cash-=gross+costFee;a.fees+=costFee;
    const p=a.positions.find(p=>p.market===o.market&&p.side===o.side);if(p){p.quantity+=quantity;p.cost+=gross+costFee;if(o.exitPlan)p.exitPlan=p.exitPlan?{stopPrice:Math.max(p.exitPlan.stopPrice,o.exitPlan.stopPrice),takeProfitPrice:Math.min(p.exitPlan.takeProfitPrice,o.exitPlan.takeProfitPrice),exitAt:Math.min(p.exitPlan.exitAt,o.exitPlan.exitAt)}:o.exitPlan;}else a.positions.push({market:o.market,side:o.side,quantity,cost:gross+costFee,mark:Math.floor(quantity*q.price/100),openedAt:now,close_time:m.close_time,expiration_time:m.latest_expiration_time||m.expiration_time||null,deadline:now+30*MS_DAY,entryForecast:o.entryForecast,exitPlan:o.exitPlan});
   }else{
    const p=a.positions.find(p=>p.market===o.market&&p.side===o.side);if(!p)continue;quantity=Math.min(depth,p.quantity,Math.max(1,Math.floor(p.quantity*o.fraction)));if(!quantity){keep.push(o);continue;}
    entryForecast=p.entryForecast||null;openedAt=p.openedAt;planExit=o.automaticExit===true&&!!p.exitPlan;gross=Math.floor(quantity*q.price/100);costFee=fee(quantity,q.price,m.multiplier);if(gross<costFee){keep.push(o);continue;}const basis=quantity===p.quantity?p.cost:Math.ceil(p.cost*quantity/p.quantity);a.cash+=gross-costFee;pnl=gross-costFee-basis;a.realized+=pnl;a.fees+=costFee;p.quantity-=quantity;p.cost-=basis;positionClosed=p.quantity===0;if(!p.quantity)a.positions=a.positions.filter(x=>x!==p);
   }
   consumed.set(key,(consumed.get(key)||0)+quantity);events.push({agent:a.id,type:o.action,market:o.market,side:o.side,quantity,price:q.price,fee:costFee,pnl,gross,entryForecast,openedAt,positionClosed,planExit,cash:a.cash,at:new Date(now).toISOString(),reason:o.reason,order:o.id,assumption:'Delayed, conservative top-depth taker paper fill; not a real fill'});
  }a.orders=keep;
  for(const p of [...a.positions]){const m=markets.find(x=>x.ticker===p.market);if(!m){p.markStale=true;continue;}
   if(['settled','finalized'].includes(m.status)&&['yes','no'].includes(m.result)&&m.is_provisional!==true&&Number.isFinite(Date.parse(m.settlement_ts))){const paid=p.side.toLowerCase()===m.result?p.quantity*100:0;a.cash+=paid;a.realized+=paid-p.cost;a.positions=a.positions.filter(x=>x!==p);events.push({agent:a.id,type:'SETTLE',positionClosed:true,planExit:false,market:p.market,side:p.side,quantity:p.quantity,at:new Date(now).toISOString(),result:m.result,payout:paid,pnl:paid-p.cost,entryForecast:p.entryForecast||null,openedAt:p.openedAt});continue;}
   const q=quoteFor(m,p.side,'SELL');p.markStale=!q||now-Date.parse(m.receivedAt)>20000||m.quotes?.crossed||m.status!=='active';if(!p.markStale)p.mark=Math.max(0,Math.floor(p.quantity*q.price/100)-fee(p.quantity,q.price,m.multiplier));
  }
  const t=totals(a,now);a.peak=Math.max(a.peak,t.net);a.maxDrawdown=Math.max(a.maxDrawdown,a.peak-t.net);
 }return events;
}
export function reserveBudget(state,now=Date.now()){
 const b=state.budget,day=new Date(now).toISOString().slice(0,10);if(b.day!==day){b.day=day;b.daySpent=0;}
 const reservation=.02;if(b.spent+b.reserved+reservation>b.cap||b.daySpent+reservation>b.dailyCap)return false;b.reserved+=reservation;b.daySpent+=reservation;return true;
}
export function finishBudget(state,usage){const b=state.budget;const charge=usage?Math.max(0,(usage.input_tokens||0)*.4/1e6+(usage.output_tokens||0)*1.6/1e6):.02;b.reserved=Math.max(0,b.reserved-.02);b.spent+=charge;b.daySpent=Math.max(0,b.daySpent-.02+charge);}

export function shouldMonitor(state){return ['running','settling'].includes(state.mode)||(state.mode==='paused'&&(state.reviewResearch===true||state.agents.some(a=>a.positions.length)));}
export function pauseEntries(state){state.mode='paused';for(const a of state.agents)a.orders=a.orders.filter(o=>o.action==='SELL');}
