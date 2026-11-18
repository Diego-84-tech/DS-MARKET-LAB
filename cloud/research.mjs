import {policyFor} from './policy.mjs';
import {fee,quoteFor,entryBlock} from './engine.mjs';
import {candleHistory} from './recordings.mjs';
export const RESEARCH_VERSION='recorded-evidence-v1';
export function summarizeHistory(frames,now=Date.now()){
 const usable=frames.filter(f=>Number.isFinite(Date.parse(f.at))&&Date.parse(f.at)<=now&&(!f.observedAt||Date.parse(f.observedAt)<=now)).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
 const prices=usable.map(f=>f.close??f.bid).filter(Number.isFinite);
 return {source:'Kalshi historical candles / recorded quotes',samples:usable.length,firstAt:usable[0]?.at||null,lastAt:usable.at(-1)?.at||null,priceChange:prices.length>1?prices.at(-1)-prices[0]:null,minimum:prices.length?Math.min(...prices):null,maximum:prices.length?Math.max(...prices):null,recent:usable.slice(-12).map(f=>({at:f.at,source:f.source,open:f.open??null,high:f.high??null,low:f.low??null,close:f.close??null,bid:f.bid??null,ask:f.ask??null})),limitation:'Historical prices are context, not evidence of a predictive advantage; unavailable intervals remain absent.'};
}
export async function researchMarkets(markets,now=Date.now(),getHistory=candleHistory){
 return Promise.all(markets.map(async m=>{let history,error=null;try{history=summarizeHistory(await getHistory(m,Math.max(Date.parse(m.open_time)||0,now-3600000),Math.min(now,Date.parse(m.close_time))),Date.now());}catch{history=summarizeHistory([],now);error='History unavailable';}
 return {...m,history:{...history,error},serverFacts:{yesAsk:m.quotes?.yesAsk?.price??null,noAsk:m.quotes?.noAsk?.price??null,priceUnit:'RAW price units: 10000 = $1.00. 900 = $0.09 = 9 cents, never 90 cents.',readablePrices:{yesAsk:readablePrice(m.quotes?.yesAsk?.price),yesBid:readablePrice(m.quotes?.yesBid?.price),noAsk:readablePrice(m.quotes?.noAsk?.price),noBid:readablePrice(m.quotes?.noBid?.price)},oneContractCosts:{YES:oneContractCost(m.quotes?.yesAsk?.price,m.multiplier),NO:oneContractCost(m.quotes?.noAsk?.price,m.multiplier)},historyIsNotForecast:true}};}));
}
export function buyAssessment(agent,d,m,now=Date.now()){
 const block=entryBlock(m,agent,now);if(block)throw Error(block);
 if(!['YES','NO'].includes(d.side)||!Number.isFinite(d.probability)||d.probability<0||d.probability>1)throw Error('Invalid forecast or contract side.');
 const q=quoteFor(m,d.side,'BUY');if(!q||!Number.isInteger(q.price)||q.price<1||q.price>9999||!Number.isInteger(q.quantity)||q.quantity<100||!Number.isFinite(m.multiplier)||m.multiplier<0||m.multiplier>10||m.quotes?.crossed)throw Error('An executable, non-crossed ask is required.');
 if(d.observedAsk!==q.price)throw Error('The reported ask disagrees with the supplied market quote.');
 if(!Number.isFinite(d.fraction)||d.fraction<=0||d.fraction>1)throw Error('Invalid cash fraction.');
 if(!Number.isInteger(d.limit)||d.limit<q.price||d.limit>9999)throw Error('Purchase limit must cover the quoted ask and stay below $1.');
 if((m.history?.samples||0)<policyFor(agent).minimumHistory)throw Error('At least three real historical observations are required before a new purchase.');
 const budget=Math.floor(agent.cash*d.fraction);let quantity=Math.min(Math.floor(q.quantity/100*.1),Math.floor(budget*100/d.limit));
 while(quantity>0&&Math.ceil(quantity*d.limit/100)+fee(quantity,d.limit,m.multiplier)>budget)quantity--;
 if(quantity<1)throw Error('Insufficient available cash or conservative displayed liquidity.');
 const fees=fee(quantity,d.limit,m.multiplier),cost=Math.ceil(quantity*d.limit/100)+fees,breakEven=cost/(quantity*100),p=d.side==='YES'?d.probability:1-d.probability;
 const assessment={version:RESEARCH_VERSION,side:d.side,quantity,limit:d.limit,entryFees:fees,maximumEntryCost:cost,breakEvenProbability:breakEven,agentProbability:p,estimatedEdge:p-breakEven,expectedNetCents:p*quantity*100-cost,forecastVerified:false,historySamples:m.history.samples,at:new Date(now).toISOString()};
 if(p-breakEven<policyFor(agent).minimumEdge)throw Error('Forecast does not exceed fee-inclusive break-even by the required five percentage points.');
 if(d.economicClaim!=='positive')throw Error('Purchase rationale contradicts its structured economic claim.');
 const plan=d.plan;if(!policyFor(agent).requireExitPlan&&(!plan||Object.values(plan).every(x=>x===0)))return {...assessment,plan:null};
 if(!plan||!Number.isInteger(plan.stopPrice)||!Number.isInteger(plan.takeProfitPrice)||!Number.isInteger(plan.exitAfterMinutes))throw Error('A numeric loss trigger, profit trigger and time exit are required.');
 if(plan.stopPrice<1||plan.stopPrice>=q.price||plan.takeProfitPrice<=d.limit||plan.takeProfitPrice>9999)throw Error('Exit triggers must bracket the entry: loss below ask, profit above limit.');
 if(plan.exitAfterMinutes<1||plan.exitAfterMinutes>30*24*60||now+plan.exitAfterMinutes*60000>Date.parse(m.close_time)-60000)throw Error('Time exit must be at least one minute before trading closes.');
 return {...assessment,plan:{...plan,exitAt:now+plan.exitAfterMinutes*60000}};
}
export function decisionCheck(agent,d,m,now=Date.now()){
 if(d.action==='BUY')return buyAssessment(agent,d,m,now);
 if(!m)return {forecastVerified:false,note:'No selected market; no purchase authorized.'};
 const q=quoteFor(m,d.side,'BUY');const p=d.side==='YES'?d.probability:1-d.probability;
 if(q&&Number.isFinite(p)&&p>=0&&p<=1){const breakEven=(Math.ceil(q.price/100)+fee(1,q.price,m.multiplier))/100;
 if(d.economicClaim==='positive'&&p<=breakEven)throw Error('Claimed positive advantage contradicts the fee-inclusive numbers.');
 if(d.economicClaim==='none'&&p>breakEven+.05)throw Error('Claimed lack of numerical advantage contradicts the forecast. Use uncertain_forecast if the forecast is not supported.');
 return {agentProbability:p,breakEvenProbability:breakEven,estimatedEdge:p-breakEven,forecastVerified:false,note:'HOLD can be appropriate because the estimate is uncertain, even when its raw arithmetic is positive.'};}
 return {forecastVerified:false,note:'Insufficient quote data for comparison.'};
}
export function exitTrigger(position,market,now=Date.now()){
 if(!market||market.status!=='active')return null;const p=position.exitPlan,q=quoteFor(market,position.side,'SELL');
 if(!q||market.quotes?.crossed||now-Date.parse(market.receivedAt)>20000)return null;
 if(p&&q.price<=p.stopPrice)return 'Recorded loss-price trigger reached';
 if(p&&q.price>=p.takeProfitPrice)return 'Recorded profit-price trigger reached';
 if(p&&now>=p.exitAt)return 'Recorded time-exit trigger reached';
 if(Date.parse(market.close_time)-now<120000||now>position.deadline)return 'Near-close / maximum holding-time exit';
 return null;
}
export function reviewForecasts(events,outcomes){
 const unique=new Map();for(const e of [...events].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))){const d=e.decision,m=outcomes.find(m=>m.ticker===d?.market);if(!d||!m||!['settled','finalized'].includes(m.status)||!['yes','no'].includes(m.result)||m.is_provisional===true||!Number.isFinite(Date.parse(m.settlement_ts))||Date.parse(d.at||e.at)>=Date.parse(m.close_time)||!Number.isFinite(d.probability)||d.probability<0||d.probability>1)continue;const key=e.agent+':'+m.ticker;if(!unique.has(key))unique.set(key,{agent:e.agent,market:m.ticker,probability:d.probability,strategyVersion:d.promptVersion||e.promptVersion||'legacy',outcome:m.result==='yes'?1:0,at:d.at||e.at});}
 const samples=[...unique.values()].map(x=>({...x,squaredError:(x.probability-x.outcome)**2}));return {version:RESEARCH_VERSION,samples: samples.length,brier:samples.length?samples.reduce((n,x)=>n+x.squaredError,0)/samples.length:null,neutralBaseline:.25,observations:samples,conclusion:samples.length<30?'Insufficient settled forecasts to establish quality; distinct rounds may still be correlated.':'Historical calibration only; profitability still requires separate out-of-sample evaluation.',passed:false};
}

export function readablePrice(raw){return Number.isInteger(raw)?{rawUnits:raw,dollars:(raw/10000).toFixed(4),cents:(raw/100).toFixed(2)}:null;}
export function oneContractCost(raw,multiplier){if(!Number.isInteger(raw)||!Number.isFinite(multiplier))return null;const gross=Math.ceil(raw/100),fees=fee(1,raw,multiplier);return {quantity:1,entryCents:gross,feeCents:fees,totalCents:gross+fees,breakEvenProbability:(gross+fees)/100,note:'One-contract example; actual order assessment calculates its own whole-quantity fees.'};}
