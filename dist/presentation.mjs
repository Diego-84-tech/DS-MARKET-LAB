export const identity=id=>id==='A'?{appId:'AlphaBot',name:'15-minute Trader',color:'#5498ff'}:{appId:'Beta',name:'Flexible Horizon',color:'#b18aff'};
export function marketOf(e){return e.market||e.order?.market||e.decision?.market||'';}
export function statusLabel(e){return ({DECISION:'Decision',ORDER:'Order proposed',WITHHELD:'Trade blocked',BUY:'Bought · simulated fill',SELL:'Sold · simulated fill',SETTLE:'Official settlement',UNFILLED:'Not filled',APPLICATION:'Loan requested',IMAGE_APPLICATION:'Picture requested',PAUSE:'Paused',START:'Started'})[e.type]||e.type.replaceAll('_',' ').toLowerCase();}
export function chartData(frames,events){
 const points=frames.map(f=>({at:Date.parse(f.at),open:f.open,high:f.high,low:f.low,close:f.close??f.bid,source:f.source})).filter(p=>Number.isFinite(p.at)&&Number.isFinite(p.close)).sort((a,b)=>a.at-b.at);
 const markers=events.filter(e=>['BUY','SELL','SETTLE'].includes(e.type)&&(Number.isFinite(e.price)||(['yes','no'].includes(e.result)&&e.type==='SETTLE'))).map(e=>({...e,t:Date.parse(e.at),yesPrice:e.type==='SETTLE'?(e.result==='yes'?10000:0):(e.side==='NO'?10000-e.price:e.price)})).filter(e=>Number.isFinite(e.t)).sort((a,b)=>a.t-b.t);
 const entries=new Map(),connections=[];
 for(const m of markers){if(m.type==='BUY')entries.set(m.agent,m);else {const entry=entries.get(m.agent);if(entry&&Number.isFinite(m.pnl))connections.push({entry,exit:m,pnl:m.pnl});if(m.type==='SETTLE')entries.delete(m.agent);}}
 return {points,markers,connections};
}
