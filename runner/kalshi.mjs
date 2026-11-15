// Public observation only: fixed host, GET only, no credentials or order endpoints.
export const API='https://external-api.kalshi.com/trade-api/v2';
export const SERIES='KXBTC15M';
export function fixed(value,places){
 if(typeof value!=='string'||!new RegExp(`^\\d+(?:\\.\\d{1,${places}})?$`).test(value))return null;
 const [whole,fraction='']=value.split('.'),n=Number(whole)*10**places+Number(fraction.padEnd(places,'0'));
 return Number.isSafeInteger(n)?n:null;
}
export function best(levels){
 if(!Array.isArray(levels))return null;
 const valid=levels.map(v=>Array.isArray(v)?{price:fixed(v[0],4),quantity:fixed(v[1],2)}:{}).filter(v=>v.price!==null&&v.price!==undefined&&v.price<=10000&&v.quantity>0);
 return valid.sort((a,b)=>b.price-a.price)[0]||null;
}
export function quotes(book){
 const yesBid=best(book?.orderbook_fp?.yes_dollars),noBid=best(book?.orderbook_fp?.no_dollars);
 return {yesBid,noBid,yesAsk:noBid?{price:10000-noBid.price,quantity:noBid.quantity}:null,noAsk:yesBid?{price:10000-yesBid.price,quantity:yesBid.quantity}:null,crossed:!!(yesBid&&noBid&&yesBid.price+noBid.price>10000),askSource:'complement of opposite bid; same quantity'};
}
export function selectMarket(markets,now=Date.now()){
 return markets.filter(m=>m.ticker?.startsWith(SERIES+'-')&&m.status==='active'&&Date.parse(m.open_time)<=now&&Date.parse(m.close_time)>now).sort((a,b)=>Date.parse(a.close_time)-Date.parse(b.close_time))[0]||null;
}
export function verifiedOutcome(m){
 return ['settled','finalized'].includes(m.status)&&['yes','no'].includes(m.result)&&m.is_provisional!==true&&Number.isFinite(Date.parse(m.settlement_ts))?{market:m.ticker,result:m.result,settlementTime:m.settlement_ts,settlementValueDollars:m.settlement_value_dollars??null,expirationValue:m.expiration_value||null,verification:'Kalshi finalized/settled response, non-provisional; not independently audited'}:null;
}
export class PublicAPI {
 constructor(record,fetcher=fetch){this.record=record;this.fetcher=fetcher;}
 async get(path){
  if(!/^\/(series\/KXBTC15M|markets(?:\?|\/KXBTC15M-))/.test(path))throw Error('Endpoint not allowed');
  const requestedAt=new Date().toISOString();
  const response=await this.fetcher(API+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json','Cache-Control':'no-cache'}});
  const receivedAt=new Date().toISOString();
  // Do not record arbitrary error bodies or request headers.
  if(!response.ok){await this.record({kind:'http-error',path,requestedAt,receivedAt,status:response.status});const e=Error(response.status===401||response.status===403?'Public access requires authorization or is denied. Collection stopped; no credentials used.':`Kalshi HTTP ${response.status}`);e.auth=response.status===401||response.status===403;throw e;}
  const data=await response.json();
  await this.record({kind:'api-response',path,requestedAt,receivedAt,httpDate:response.headers.get('date'),data});
  return {data,receivedAt};
 }
 async openMarkets(){
  let cursor='',markets=[];
  for(let i=0;i<10;i++){
   const {data}=await this.get(`/markets?series_ticker=${SERIES}&status=open&limit=100${cursor?'&cursor='+encodeURIComponent(cursor):''}`);
   if(!Array.isArray(data.markets))throw Error('Invalid market list');markets.push(...data.markets);cursor=data.cursor;if(!cursor)return markets;
  }
  throw Error('Market pagination limit reached; selection withheld');
 }
}
export function freshness(state,now=Date.now()){
 const age=state?.latest?.receivedAt?now-Date.parse(state.latest.receivedAt):Infinity;
 const expired=state?.latest?.market?.close_time?now>=Date.parse(state.latest.market.close_time):false;
 return {ageMs:Number.isFinite(age)?Math.max(0,age):null,stale:state?.status!=='collecting'||!Number.isFinite(age)||age>20000||expired||state?.latest?.quotes?.crossed||!state?.latest?.quotes?.yesBid||!state?.latest?.quotes?.yesAsk};
}
