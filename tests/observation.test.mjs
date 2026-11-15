import test from 'node:test';
import assert from 'node:assert/strict';
import {fixed,quotes,selectMarket,verifiedOutcome,PublicAPI,freshness} from '../runner/kalshi.mjs';
test('fixed point preserves sub-cent prices and fractional depth; rejects malformed data',()=>{
 assert.equal(fixed('0.0610',4),610);assert.equal(fixed('1125.11',2),112511);
 for(const v of [null,'','NaN','-1','0.12345',0.12])assert.equal(fixed(v,4),null);
});
test('asks complement opposite bids with identical depth; missing sides never fabricated',()=>{
 const q=quotes({orderbook_fp:{yes_dollars:[['0.0600','2.00'],['0.0610','1125.11']],no_dollars:[['0.9380','6026.06']]}});
 assert.deepEqual(q.yesAsk,{price:620,quantity:602606});assert.deepEqual(q.noAsk,{price:9390,quantity:112511});
 assert.equal(quotes({orderbook_fp:{yes_dollars:[['0.6','2']],no_dollars:[['0.6','2']]}}).crossed,true);
 const empty=quotes({orderbook_fp:{yes_dollars:[],no_dollars:[]}});assert.equal(empty.yesBid,null);assert.equal(empty.yesAsk,null);
 assert.equal(quotes({orderbook_fp:{yes_dollars:[['0.5','0.00']]}}).yesBid,null);
});
test('market selection uses actual trading windows and handles rollover without stitching',()=>{
 const m={ticker:'KXBTC15M-TEST',status:'active',open_time:'2026-11-14T00:30:00Z',close_time:'2026-11-14T00:45:00Z',expiration_time:'2026-11-21T00:45:00Z'};
 assert.equal(selectMarket([m],Date.parse('2026-11-14T00:40:00Z')),m);
 assert.equal(selectMarket([m],Date.parse(m.close_time)),null);
 assert.equal(selectMarket([{...m,status:'finalized'}],Date.parse(m.open_time)),null);
});
test('only finalized non-provisional official outcomes with settlement time are verified',()=>{
 const m={ticker:'KXBTC15M-TEST',status:'finalized',result:'yes',settlement_ts:'2026-11-14T00:30:04Z',expiration_value:'68252.69'};
 assert.equal(verifiedOutcome(m).result,'yes');
 for(const patch of [{status:'closed'},{result:''},{settlement_ts:null},{is_provisional:true}])assert.equal(verifiedOutcome({...m,...patch}),null);
});
test('freshness rejects stopped, expired, old, and incomplete snapshots',()=>{
 const now=Date.parse('2026-11-14T00:40:00Z'),s={status:'collecting',latest:{receivedAt:new Date(now).toISOString(),market:{close_time:new Date(now+60000).toISOString()},quotes:{yesBid:{price:5000},yesAsk:{price:5100}}}};
 assert.equal(freshness(s,now).stale,false);assert.equal(freshness(s,now+21000).stale,true);
 assert.equal(freshness({...s,status:'stopped'},now).stale,true);
 assert.equal(freshness({...s,latest:{...s.latest,quotes:{}}},now).stale,true);
 assert.equal(freshness(s,now+60000).stale,true);
});
test('public client uses only GET, no auth headers; stops on access denial without recording error bodies',async()=>{
 const records=[];let calls=0;
 const api=new PublicAPI(async r=>records.push(r),async(url,options)=>{calls++;assert.equal(options.method,'GET');assert.equal(options.headers.Authorization,undefined);assert.ok(url.startsWith('https://external-api.kalshi.com/trade-api/v2/'));return new Response('private error body',{status:401});});
 await assert.rejects(api.get('/markets?series_ticker=KXBTC15M'),e=>e.auth===true);
 assert.equal(JSON.stringify(records).includes('private error body'),false);
 await assert.rejects(api.get('/portfolio/orders'));assert.equal(calls,1);
});
test('market discovery follows pagination before selecting a contract',async()=>{
 const api=new PublicAPI(async()=>{},async url=>new Response(JSON.stringify(url.includes('cursor=next')?{markets:[{ticker:'second'}],cursor:''}:{markets:[{ticker:'first'}],cursor:'next'}),{headers:{'Content-Type':'application/json'}}));
 assert.deepEqual((await api.openMarkets()).map(m=>m.ticker),['first','second']);
});
