import {run} from './engine.mjs';

export const STRATEGY_VERSION='1';
export const BASE_RULES=Object.freeze({name:'Momentum test',entry:'momentum',lookback:60,minMove:10,maxPrice:6500,takeProfit:1200,stopLoss:1000,aAmount:1000,bFraction:.5,waitSeconds:120,exitSeconds:30});

export function validateRules(input){
 if(!input||typeof input!=='object')throw new Error('Enter strategy rules.');
 const r={...BASE_RULES,...input};
 r.name=String(r.name).trim();
 if(!r.name||r.name.length>60)throw new Error('Use a strategy name of 1–60 characters.');
 if(!['momentum','reversal'].includes(r.entry))throw new Error('Choose momentum or reversal.');
 const ranges={lookback:[15,300],minMove:[.01,10000],maxPrice:[100,9900],takeProfit:[100,9900],stopLoss:[100,9900],aAmount:[100,1000],bFraction:[.01,1],waitSeconds:[60,600],exitSeconds:[15,120]};
 for(const [key,[lo,hi]] of Object.entries(ranges)){if(!Number.isFinite(r[key])||r[key]<lo||r[key]>hi)throw new Error(`Invalid ${key} setting.`);}
 for(const key of ['lookback','maxPrice','takeProfit','stopLoss','aAmount','waitSeconds','exitSeconds'])if(!Number.isInteger(r[key]))throw new Error('Use whole seconds and integer price units.');
 return Object.fromEntries(['name','entry',...Object.keys(ranges)].map(k=>[k,r[k]]));
}

export function strategyFrames(frames,input){
 const rules=validateRules(input),history=[],signaled=new Set();let market=null;
 return frames.map(f=>{
  if(f.market!==market){history.length=0;market=f.market;}
  const current={...f,signal:null};
  const threshold=Date.parse(f.time)-rules.lookback*1000;
  const before=history.findLast(p=>Date.parse(p.time)<=threshold);
  if(before&&!f.stale&&!f.end&&f.secondsLeft>120&&900-f.secondsLeft>=rules.waitSeconds&&!signaled.has(f.market)){
   const delta=f.btc-before.btc;
   if(Math.abs(delta)>=rules.minMove){
    let side=delta>0?'YES':'NO';if(rules.entry==='reversal')side=side==='YES'?'NO':'YES';
    const ask=side==='YES'?f.yesAsk:10000-f.yesBid;
    if(ask>0&&ask<=rules.maxPrice){current.signal={side,fraction:rules.bFraction,reason:`${rules.name}: ${rules.entry} rule. Spot moved ${delta>=0?'+':''}${delta.toFixed(2)} dollars over the preceding ${rules.lookback}s; ${side} ask ${(ask/100).toFixed(1)}¢ was within the ${(rules.maxPrice/100).toFixed(1)}¢ entry limit. A uses up to $${(rules.aAmount/100).toFixed(2)}; B uses ${(rules.bFraction*100).toFixed(0)}% of available cash. Fictional or unverified data; not an AI forecast.`};signaled.add(f.market);}
   }
  }
  history.push(f);return current;
 });
}

export function evaluateStrategy(frames,rules){
 const config=validateRules(rules),prepared=strategyFrames(frames,config),report=run(prepared,config);
 return {...report,rules:config,kind:'ds-market-lab-strategy-test',strategyVersion:STRATEGY_VERSION};
}

export function selectHistory(frames,range='100rounds'){
 if(!frames.length)return [];
 const markets=[...new Set(frames.map(f=>f.market))];let selected;
 if(range.endsWith('rounds'))selected=new Set(markets.slice(-Math.max(1,parseInt(range))));
 else {const cutoff=Date.parse(frames.at(-1).time)-Math.max(1,parseInt(range))*86400000;selected=new Set(frames.filter(f=>Date.parse(f.time)>=cutoff).map(f=>f.market));}
 return frames.filter(f=>selected.has(f.market));
}
