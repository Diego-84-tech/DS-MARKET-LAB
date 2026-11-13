import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceFrames} from '../dist/engine.mjs';
import {BASE_RULES,validateRules,strategyFrames,evaluateStrategy,selectHistory} from '../dist/strategy.mjs';

test('rule validation preserves the $10 cap and rejects invalid prices or sizing',()=>{
 for(const patch of [{aAmount:1001},{bFraction:1.01},{maxPrice:0},{stopLoss:NaN},{entry:'magic'},{lookback:-1}])assert.throws(()=>validateRules({...BASE_RULES,...patch}));
 assert.equal(validateRules({...BASE_RULES,unexpected:'ignored'}).unexpected,undefined);
});
test('strategy signals depend only on reached frames, never later prices',()=>{
 const frames=practiceFrames(),rules={...BASE_RULES,maxPrice:9900,minMove:1};
 const full=strategyFrames(frames,rules),prefix=strategyFrames(frames.slice(0,40),rules);
 assert.deepEqual(prefix,full.slice(0,40));
 const altered=frames.map((f,i)=>i>40?{...f,btc:f.btc+100000}:f);
 assert.deepEqual(strategyFrames(altered,rules).slice(0,40),prefix);
});
test('entry waits for sufficient history and its price limit, at most one signal per round',()=>{
 const rules={...BASE_RULES,minMove:1,maxPrice:6000},frames=strategyFrames(practiceFrames(),rules),counts={};
 for(const f of frames.filter(f=>f.signal)){assert.ok(900-f.secondsLeft>=120);assert.ok(f.secondsLeft>120);assert.ok(!f.stale&&!f.end);assert.ok((f.signal.side==='YES'?f.yesAsk:10000-f.yesBid)<=6000);counts[f.market]=(counts[f.market]||0)+1;}
 assert.ok(Object.keys(counts).length>0);assert.ok(Object.values(counts).every(n=>n===1));
});
test('reversal uses the opposite side of the same observed movement',()=>{
 const frames=practiceFrames().slice(0,12),common={...BASE_RULES,maxPrice:9900,minMove:1};
 const m=strategyFrames(frames,common).find(f=>f.signal),r=strategyFrames(frames,{...common,entry:'reversal'}).find(f=>f.signal);
 assert.ok(m&&r);assert.equal(m.time,r.time);assert.notEqual(m.signal.side,r.signal.side);
});
test('custom sizing stays within cash and the A entry budget, including fees',()=>{
 const r=evaluateStrategy(practiceFrames(),{...BASE_RULES,maxPrice:9900,minMove:1,aAmount:200,bFraction:1});
 assert.ok(r.events.some(e=>e.type==='BUY'));
 for(const e of r.events.filter(e=>e.type==='BUY'&&e.wallet==='A'))assert.ok(-e.net<=200);
 for(const ws of r.snapshots)for(const w of ws){assert.ok(w.cash>=0);assert.equal(w.cash+(w.position?.cost||0),5000+w.realized);}
});
test('exit thresholds change execution and are frozen into the evaluated result',()=>{
 const common={...BASE_RULES,maxPrice:9900,minMove:1};
 const short=evaluateStrategy(practiceFrames(),{...common,takeProfit:100,stopLoss:100}),wide=evaluateStrategy(practiceFrames(),{...common,takeProfit:5000,stopLoss:5000});
 assert.notDeepEqual(short.events,wide.events);assert.equal(short.rules.takeProfit,100);assert.equal(wide.rules.takeProfit,5000);
});
test('history ranges return only existing contiguous rounds, without fabricating days',()=>{
 const frames=practiceFrames();assert.equal(selectHistory(frames,'100days').length,366);assert.equal(selectHistory(frames,'100rounds').length,366);
 const last=selectHistory(frames,'2rounds');assert.equal(new Set(last.map(f=>f.market)).size,2);assert.equal(last[0].market,'PRACTICE-BTC-5');
 assert.deepEqual(selectHistory([],'100days'),[]);
});
