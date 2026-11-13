export const VERSION='0.1.0';
export const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const copy=x=>structuredClone(x);
export function entryFee(qty,price,rate=.07){return qty?Math.ceil(rate*qty*(price/10000)*(1-price/10000)-1e-9):0;}
export function grossCost(qty,price){return Math.ceil(qty*price/10000-1e-9);}
export function saleGross(qty,price){return Math.floor(qty*price/10000+1e-9);}
export function affordableQuantity(budget,price,depth=100000,rate=.07){
 if(!Number.isInteger(budget)||budget<1||!Number.isInteger(price)||price<1||price>9999)return 0;
 let lo=0,hi=Math.max(0,Math.floor(depth));
 while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(grossCost(mid,price)+entryFee(mid,price,rate)<=budget)lo=mid;else hi=mid-1;}
 return lo;
}
export function wallet(id,cap){return {id,name:id==='A'?'Capped':'Flexible',start:5000,cash:5000,cap,position:null,entries:{},realized:0,fees:0,trades:0,wins:0,losses:0,peak:5000,maxDrawdown:0,equity:5000};}
export function newState(){return {version:VERSION,wallets:[wallet('A',1000),wallet('B',null)],events:[],index:-1};}
function record(state,w,frame,type,detail){state.events.push({id:`${state.events.length+1}`,wallet:w.id,time:frame.time,market:frame.market,index:state.index,type,...detail});}
export function buy(state,w,frame,side,desiredCents,reason='Practice rule signal'){
 if(w.position||frame.stale||frame.end||frame.secondsLeft<=60)return false;
 const already=w.entries[frame.market]||0;
 const capRemaining=w.cap===null?w.cash:w.cap;
 const budget=Math.min(w.cash,capRemaining,Math.max(0,Math.floor(desiredCents)));
 const ask=side==='YES'?frame.yesAsk:10000-frame.yesBid;
 const depth=side==='YES'?frame.yesAskDepth:frame.noAskDepth;
 const quantity=affordableQuantity(budget,ask,depth);
 if(!quantity)return false;
 const gross=grossCost(quantity,ask),fee=entryFee(quantity,ask),cost=gross+fee;
 w.cash-=cost;w.fees+=fee;w.entries[frame.market]=already+cost;
 w.position={market:frame.market,side,quantity,price:ask,cost,entryFee:fee,time:frame.time,closedPnl:0};
 record(state,w,frame,'BUY',{side,price:ask,quantity,gross,fee,net:-cost,reason,cash:w.cash});return true;
}
export function sell(state,w,frame,reason='Exit rule'){
 const p=w.position;if(!p||p.market!==frame.market||frame.stale)return false;
 const price=p.side==='YES'?frame.yesBid:10000-frame.yesAsk;
 const depth=p.side==='YES'?frame.yesBidDepth:frame.noBidDepth;
 const qty=Math.min(p.quantity,Math.max(0,Math.floor(depth)));
 if(!qty)return false;
 const gross=saleGross(qty,price),fee=entryFee(qty,price),net=gross-fee;
 if(net<0)return false;
 const basis=qty===p.quantity?p.cost:Math.ceil(p.cost*qty/p.quantity);
 const pnl=net-basis;w.cash+=net;w.fees+=fee;w.realized+=pnl;
 record(state,w,frame,'SELL',{side:p.side,price,quantity:qty,gross,fee,net,pnl,reason,cash:w.cash});
 p.quantity-=qty;p.cost-=basis;p.closedPnl+=pnl;
 if(!p.quantity){w.position=null;w.trades++;if(p.closedPnl>0)w.wins++;else if(p.closedPnl<0)w.losses++;}
 return true;
}
export function settle(state,w,frame){
 const p=w.position;if(!p||p.market!==frame.market||!frame.end||!['YES','NO'].includes(frame.result))return false;
 const won=p.side===frame.result,payout=won?p.quantity:0,pnl=payout-p.cost;
 w.cash+=payout;w.realized+=pnl;w.trades++;if(pnl+p.closedPnl>0)w.wins++;else if(pnl+p.closedPnl<0)w.losses++;
 record(state,w,frame,'SETTLE',{side:p.side,price:won?10000:0,quantity:p.quantity,gross:payout,fee:0,net:payout,pnl,reason:`Practice settlement: ${frame.result}`,cash:w.cash});w.position=null;return true;
}
function mark(w,frame){
 let value=0;if(w.position){const p=w.position,price=p.side==='YES'?frame.yesBid:10000-frame.yesAsk;value=Math.max(0,saleGross(p.quantity,price)-entryFee(p.quantity,price));}
 w.equity=w.cash+value;w.peak=Math.max(w.peak,w.equity);w.maxDrawdown=Math.max(w.maxDrawdown,w.peak-w.equity);
}
export function step(state,frame,index,rules={}){
 state.index=index;
 for(const w of state.wallets){
  if(frame.end)settle(state,w,frame);
  else if(w.position){const p=w.position,bid=p.side==='YES'?frame.yesBid:10000-frame.yesAsk;
   if(p.market!==frame.market)continue;
   if(bid-p.price>=(rules.takeProfit??1200))sell(state,w,frame,`Take profit: bid improved by at least ${(rules.takeProfit??1200)/100}¢`);
   else if(bid-p.price<=-(rules.stopLoss??1000))sell(state,w,frame,`Loss exit requested: bid fell by at least ${(rules.stopLoss??1000)/100}¢`);
   else if(frame.secondsLeft<=(rules.exitSeconds??30))sell(state,w,frame,'Round ending: attempt to close');
  } else if(frame.signal&&frame.secondsLeft>120&&!frame.stale){
   const signal=frame.signal;const allocation=w.id==='A'?Math.min(rules.aAmount??1000,1000,w.cash):Math.floor(w.cash*signal.fraction);
   buy(state,w,frame,signal.side,allocation,signal.reason);
  }
  mark(w,frame);
 }
 return state;
}
export function run(frames,rules={}){const state=newState(),snapshots=[];frames.forEach((frame,index)=>{step(state,frame,index,rules);snapshots.push(copy(state.wallets));});return {version:VERSION,frames,events:state.events,snapshots,wallets:copy(state.wallets)};}
export function practiceFrames(scenario='mixed'){
 const all=[];const moves=scenario==='trend'?[1,1,1,1,-1,1]:scenario==='whipsaw'?[1,-1,1,-1,1,-1]:[1,-1,-1,1,1,-1];
 let opening=68500;const start=Date.UTC(2026,10,1,14,0,0);
 for(let round=0;round<6;round++){
  const target=opening;const direction=moves[round];const roundFrames=[];
  for(let tick=0;tick<=60;tick++){
   const t=tick/60;
   let displacement=direction*130*t+Math.sin(tick*.57+round)*26;
   if(scenario==='whipsaw')displacement=Math.sin(tick*.26+round)*90+direction*12*t;
   const btc=Math.round((target+displacement)*100)/100;
   const probability=clamp(.5+displacement/(180*Math.sqrt(Math.max(.08,1-t))),.03,.97);
   const mid=Math.round(probability*10000/100)*100;
   const yesBid=clamp(mid-150,100,9700),yesAsk=clamp(mid+150,300,9900);
   const secondsLeft=900-tick*15;
   const frame={time:new Date(start+(round*900+tick*15)*1000).toISOString(),market:`PRACTICE-BTC-${round+1}`,round:round+1,tick,secondsLeft,btc,target,yesBid,yesAsk,yesAskDepth:30000,yesBidDepth:30000,noAskDepth:30000,noBidDepth:30000,stale:false,end:tick===60,signal:null};
   if(tick===8){const before=roundFrames[tick-4].btc;const side=btc>=before?'YES':'NO';frame.signal={side,fraction:scenario==='whipsaw'?.9:clamp(.35+Math.abs(btc-before)/100,.35,1),reason:`Fictional practice: last 60 seconds moved ${btc>=before?'up':'down'}; test a ${side} entry. This is a rule signal, not AI research.`};}
   roundFrames.push(frame);
  }
  const mean=roundFrames.slice(-4).reduce((sum,f)=>sum+f.btc,0)/4;
  roundFrames[60].result=mean>target?'YES':'NO';all.push(...roundFrames);opening=roundFrames[60].btc;
 }
 return all;
}
export function validateRecording(data){
 if(!data||data.kind!=='ds-market-lab-recording'||data.version!==VERSION||!Array.isArray(data.frames)||!data.frames.length||data.frames.length>10000)throw new Error('Use a DS Market Lab recording with up to 10,000 frames.');
 let previous=-Infinity,last=null;const completed=new Set();
 for(const f of data.frames){
  if(!f||typeof f!=='object')throw new Error('Invalid market frame.');
  const time=Date.parse(f.time);if(!Number.isFinite(time)||time<previous)throw new Error('Recording timestamps must be valid and ordered.');previous=time;
  if(!f||typeof f!=='object'||typeof f.market!=='string'||!f.market||f.market.length>100||!Number.isFinite(f.btc)||!Number.isFinite(f.target)||!Number.isFinite(f.secondsLeft)||f.secondsLeft<0||f.secondsLeft>900||typeof f.end!=='boolean'||typeof f.stale!=='boolean')throw new Error('Invalid market frame.');
  if(![f.yesBid,f.yesAsk].every(v=>Number.isInteger(v)&&v>=0&&v<=10000)||f.yesAsk<f.yesBid)throw new Error('Invalid bid/ask prices.');
  for(const key of ['yesAskDepth','yesBidDepth','noAskDepth','noBidDepth'])if(!Number.isInteger(f[key])||f[key]<0||f[key]>100000000)throw new Error('Invalid available quantity.');
  if(f.signal&&(!['YES','NO'].includes(f.signal.side)||!Number.isFinite(f.signal.fraction)||f.signal.fraction<0||f.signal.fraction>1||typeof f.signal.reason!=='string'||f.signal.reason.length>2000))throw new Error('Invalid signal.');
  if(f.end&&!['YES','NO'].includes(f.result))throw new Error('A completed round needs an outcome.');
  if(last&&last.market!==f.market){if(!last.end)throw new Error('Finish a round before changing markets.');completed.add(last.market);}
  if(completed.has(f.market))throw new Error('Market rounds must be contiguous.');
  if(last&&last.market===f.market&&(last.end||f.secondsLeft>last.secondsLeft))throw new Error('Round time must count down to a single final outcome.');
  last=f;
 }
 return data.frames;
}
