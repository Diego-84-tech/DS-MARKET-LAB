import {quotes} from '../runner/kalshi.mjs';
const HOST='https://external-api.kalshi.com/trade-api/v2';
export async function publicGet(path){
 if(!/^\/(markets(?:[/?])|historical\/markets\/[A-Z0-9-]+|series\/[A-Z0-9-]+(?:[/?]|$))/.test(path))throw Error('Public market path rejected');
 const r=await fetch(HOST+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(8000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Kalshi public data unavailable ('+r.status+')');return {data:await r.json(),receivedAt:new Date().toISOString()};
}
export async function collect(state,now=Date.now()){
 const all=new Map(),fees={};
 for(const series of ['KXBTC15M','KXBTC','KXBTCD']){
  const [{data:s},{data}]=await Promise.all([publicGet('/series/'+series),publicGet('/markets?series_ticker='+series+'&status=open&limit=1000')]);
  const m=Number(s.series?.fee_multiplier);fees[series]={multiplier:m,feeVerified:s.series?.fee_type==='quadratic'&&Number.isFinite(m)&&m>=0&&m<=10};
  const list=(data.markets||[]).filter(x=>x.status==='active'&&Date.parse(x.open_time)<=now&&Date.parse(x.close_time)>now&&Date.parse(x.latest_expiration_time||x.expiration_time||x.close_time)<=now+30*86400000);
  const distance=m=>{const bid=Number(m.yes_bid_dollars),ask=Number(m.yes_ask_dollars);return Number.isFinite(bid)&&Number.isFinite(ask)&&ask>0?Math.abs((bid+ask)/2-.5):1;};
  list.sort((a,b)=>distance(a)-distance(b)||Number(b.volume_fp||b.volume||0)-Number(a.volume_fp||a.volume||0));
  const selected=series==='KXBTC15M'?list.sort((a,b)=>Date.parse(a.close_time)-Date.parse(b.close_time)).slice(0,1):list.slice(0,2);
  selected.forEach(x=>all.set(x.ticker,{...x,series,...fees[series]}));
 }
 // Beta chooses across market categories; discovery is bounded and explicitly not exhaustive.
 let cursor='';const candidates=[];
 for(let page=0;page<3;page++){
  const {data}=await publicGet('/markets?status=open&mve_filter=exclude&limit=200'+(cursor?'&cursor='+encodeURIComponent(cursor):''));
  candidates.push(...(data.markets||[]).filter(m=>m.status==='active'&&Date.parse(m.open_time)<=now&&Date.parse(m.close_time)>now&&Date.parse(m.latest_expiration_time||m.expiration_time||m.close_time)<=now+30*86400000));cursor=data.cursor;if(!cursor)break;
 }
 candidates.sort((a,b)=>Number(b.volume_fp||b.volume||0)-Number(a.volume_fp||a.volume||0));
 const chosen=[],perSeries=new Map();
 for(const m of candidates){const series=m.event_ticker?.split('-')[0]||m.ticker.split('-')[0];if((perSeries.get(series)||0)>=2)continue;perSeries.set(series,(perSeries.get(series)||0)+1);chosen.push({...m,series});if(chosen.length>=8)break;}
 for(const m of chosen){try{const {data}=await publicGet('/series/'+encodeURIComponent(m.series));const n=Number(data.series?.fee_multiplier);fees[m.series]={multiplier:n,feeVerified:data.series?.fee_type==='quadratic'&&Number.isFinite(n)&&n>=0&&n<=10};all.set(m.ticker,{...m,...fees[m.series]});}catch{/* Unverified series are not offered as executable. */}}
 for(const a of state.agents)for(const p of a.positions){if(all.has(p.market))continue;const {data}=await publicGet('/markets/'+encodeURIComponent(p.market));if(data.market){const series=p.market.split('-')[0];if(!fees[series]){try{const {data:d}=await publicGet('/series/'+encodeURIComponent(series));const n=Number(d.series?.fee_multiplier);fees[series]={multiplier:n,feeVerified:d.series?.fee_type==='quadratic'&&Number.isFinite(n)&&n>=0&&n<=10};}catch{fees[series]={feeVerified:false};}}all.set(p.market,{...data.market,series,...fees[series]});}}
 const out=[];
 for(const m of all.values()){
  if(m.status==='active'){const {data,receivedAt}=await publicGet('/markets/'+encodeURIComponent(m.ticker)+'/orderbook?depth=1');out.push({...m,quotes:quotes(data),receivedAt,exchangeQuoteTime:null});}
  else out.push({...m,quotes:null,receivedAt:new Date().toISOString()});
 }
 return out;
}
export async function spot(){const r=await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Spot reference unavailable');const d=await r.json(),price=Number(d.data?.amount);if(!Number.isFinite(price)||price<=0)throw Error('Invalid spot reference');return {price,receivedAt:new Date().toISOString(),source:'Coinbase spot reference; not Kalshi settlement feed'};}
export function compactMarket(m){return {ticker:m.ticker,title:m.title,subtitle:m.subtitle,yes_sub_title:m.yes_sub_title,no_sub_title:m.no_sub_title,series:m.series,status:m.status,open_time:m.open_time,close_time:m.close_time,expiration_time:m.expiration_time,latest_expiration_time:m.latest_expiration_time,floor_strike:m.floor_strike,cap_strike:m.cap_strike,rules_primary:String(m.rules_primary||'').slice(0,5000),rules_secondary:String(m.rules_secondary||'').slice(0,2000),result:m.result,settlement_ts:m.settlement_ts,is_provisional:m.is_provisional,quotes:m.quotes,receivedAt:m.receivedAt,exchangeQuoteTime:null,feeVerified:m.feeVerified,multiplier:m.multiplier};}
