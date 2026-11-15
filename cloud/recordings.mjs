import {publicGet,compactMarket} from './market.mjs';
export function candleFrames(data,observedAt=new Date().toISOString()){
 return (data.candlesticks||[]).map(c=>{const p=c.price||{},bid=c.yes_bid||{},ask=c.yes_ask||{},value=x=>typeof x==='string'&&/^\d+(\.\d+)?$/.test(x)?Math.round(Number(x)*10000):null;return {at:new Date(c.end_period_ts*1000).toISOString(),source:'kalshi-candle',observedAt,open:value(p.open_dollars),high:value(p.high_dollars),low:value(p.low_dollars),close:value(p.close_dollars),bid:value(bid.close_dollars),ask:value(ask.close_dollars),volume:c.volume_fp??null};}).filter(c=>c.close!==null||c.bid!==null||c.ask!==null);
}
export async function candleHistory(m,start,end,interval=1){
 const query=`?start_ts=${Math.floor(start/1000)}&end_ts=${Math.floor(end/1000)}&period_interval=${interval}`;
 try{return candleFrames((await publicGet(`/series/${encodeURIComponent(m.series)}/markets/${encodeURIComponent(m.ticker)}/candlesticks${query}`)).data);}
 catch{return candleFrames((await publicGet(`/historical/markets/${encodeURIComponent(m.ticker)}/candlesticks${query}`)).data);}
}
export async function recordMarkets(state,markets,now=Date.now()){
 const records=[];state.recordedTickers ||= [];state.recordingBackfills ||= {};
 const watch=new Set(state.agents.flatMap(a=>[...a.positions.map(p=>p.market),...a.orders.map(o=>o.market),...(a.decision?.market?[a.decision.market]:[])]));
 for(const m of markets.filter(m=>m.series==='KXBTC15M'||watch.has(m.ticker))){
  let frames=[];const first=!state.recordedTickers.includes(m.ticker);let historyStatus='';
  if(first||m.series==='KXBTC15M'||(!state.recordingBackfills[m.ticker]&&now-Date.parse(m.close_time)<3600000)){
   try{frames=await candleHistory(m,Math.max(Date.parse(m.open_time)||0,m.series==='KXBTC15M'?(first?Date.parse(m.open_time):now-120000):now-3600000),Math.min(now,Date.parse(m.close_time)));historyStatus=frames.length?'Historical candles available':'No earlier candles returned';state.recordingBackfills[m.ticker]=true;}
   catch{historyStatus='Earlier history unavailable; observed quotes begin at tracking time';}
  }
  if(first)state.recordedTickers.push(m.ticker);
  if(m.quotes)frames.push({at:m.receivedAt,source:'recorded-quote',bid:m.quotes.yesBid?.price??null,ask:m.quotes.yesAsk?.price??null,close:null,exchangeQuoteTime:null,crossed:m.quotes.crossed});
  records.push({ticker:m.ticker,metadata:{...compactMarket(m),trackingStarted:first?new Date(now).toISOString():undefined,...(historyStatus?{historyStatus}:{})},frames});
 }
 state.recordedTickers=state.recordedTickers.slice(-500);state.recordingBackfills=Object.fromEntries(Object.entries(state.recordingBackfills).slice(-500));return records;
}
