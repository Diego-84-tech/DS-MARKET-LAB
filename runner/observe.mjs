import {createServer} from 'node:http';
import {appendFile,mkdir,readFile,open} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PublicAPI,SERIES,selectMarket,quotes,verifiedOutcome,freshness} from './kalshi.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const options=Object.fromEntries(process.argv.slice(2).map(a=>a.replace(/^--/,'').split('=')));
if(Object.keys(options).some(k=>!['samples','interval','port','data-dir'].includes(k)))throw Error('Options: --samples=N --interval=5000 --port=8081 --data-dir=/absolute/path');
const interval=Number(options.interval||5000),limit=Number(options.samples||Infinity),port=Number(options.port||8081);
if(!Number.isInteger(interval)||interval<5000||!((Number.isInteger(limit)&&limit>0)||limit===Infinity)||!Number.isInteger(port)||port<1024||port>65535)throw Error('Invalid options');
const directory=resolve(options['data-dir']||join(homedir(),'Library/Application Support/DS Market Lab/recordings'));
if(directory===resolve(root)||directory.startsWith(resolve(root)+'/'))throw Error('Recordings must be outside the repository');
await mkdir(directory,{recursive:true,mode:0o700});
const file=join(directory,`kalshi-observation-${new Date().toISOString().replace(/[:.]/g,'-')}.ndjson`);
await (await open(file,'wx',0o600)).close();
const record=async data=>appendFile(file,JSON.stringify({schema:'ds-market-lab-observation-v1',source:'kalshi-public-rest',...data})+'\n');
const state={appVersion:'0.8.0',source:'kalshi-public-rest',status:'starting',series:SERIES,latest:null,outcomes:[],error:null,attempts:0,samples:0,recording:file,intervalMs:interval};
const api=new PublicAPI(record),seenOutcomes=new Set(),pending=new Set();
let busy=false,stopping=false,timer;
async function outcome(m){const o=verifiedOutcome(m);if(!o)return false;const key=JSON.stringify(o);if(!seenOutcomes.has(key)){await record({kind:'verified-outcome',receivedAt:new Date().toISOString(),outcome:o});seenOutcomes.add(key);state.outcomes=[o,...state.outcomes.filter(x=>x.market!==o.market)].slice(0,10);}pending.delete(m.ticker);return true;}
async function poll(){
 if(busy||stopping)return;busy=true;state.attempts++;
 try{
  const markets=await api.openMarkets(),selected=selectMarket(markets);
  state.activeMarkets=markets.map(m=>({ticker:m.ticker,status:m.status,open_time:m.open_time,close_time:m.close_time}));
  state.latest=null;
  if(selected){
   pending.add(selected.ticker);
   const {data,receivedAt}=await api.get(`/markets/${encodeURIComponent(selected.ticker)}/orderbook?depth=1`);
   const q=quotes(data);
   state.latest={market:selected,receivedAt,exchangeQuoteTime:null,marketMetadataUpdatedAt:selected.updated_time??null,quotes:q,missing:['exchangeQuoteTime',...(!verifiedOutcome(selected)?['verifiedOutcome']:[]),...Object.entries(q).filter(([k,v])=>k!=='askSource'&&v===null).map(([k])=>k)]};
   await record({kind:'quote-snapshot',...state.latest});state.samples++;
  }
  const recent=await api.get(`/markets?series_ticker=${SERIES}&status=settled&limit=5`);
  for(const m of recent.data.markets||[])await outcome(m);
  // Revisit observed contracts after close even if settlement is delayed beyond the latest five.
  for(const ticker of [...pending].slice(0,3)){
   if(ticker===selected?.ticker)continue;
   const {data}=await api.get(`/markets/${encodeURIComponent(ticker)}`);if(data.market)await outcome(data.market);
  }
  state.status=selected?'collecting':'no-active-market';state.error=null;
 }catch(e){state.status=e.auth?'access-denied':'error';state.error=e.auth?e.message:'Collection failed; no fictional replacement. Check network, API availability, or recording disk access.';if(e.auth)stopping=true;
  try{await record({kind:'collection-error',receivedAt:new Date().toISOString(),message:state.error});}catch{stopping=true;state.error='Recording write failed. Collection stopped.';}
 }finally{busy=false;if(stopping||state.attempts>=limit){clearInterval(timer);if(!['access-denied','error'].includes(state.status))state.status='stopped';await record({kind:'collector-stopped',receivedAt:new Date().toISOString(),attempts:state.attempts,samples:state.samples}).catch(()=>{});console.log(JSON.stringify({status:state.status,attempts:state.attempts,samples:state.samples,market:state.latest?.market.ticker??null,missing:state.latest?.missing??[],outcomes:state.outcomes,recording:file}));}}
}
const types={'.mjs':'text/javascript','.css':'text/css','.html':'text/html'};
const assets=new Set(['practice.html','index.html','app.mjs','engine.mjs','strategy.mjs','strategy-ui.mjs','live-ui.mjs','styles.css']);
const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; form-action 'none'");
 if(!['localhost:'+port,'127.0.0.1:'+port].includes(req.headers.host)||!['GET','HEAD'].includes(req.method)){res.writeHead(403);res.end();return;}
 if(req.url==='/api/observation'){res.setHeader('Content-Type','application/json');res.end(req.method==='HEAD'?'':JSON.stringify({...state,...freshness(state)}));return;}
 const path=req.url==='/'?'practice.html':req.url?.slice(1);
 if(!assets.has(path)){res.writeHead(404);res.end();return;}
 try{const body=await readFile(join(root,'dist',path));const ext=path.slice(path.lastIndexOf('.'));res.setHeader('Content-Type',types[ext]||'text/plain');res.end(req.method==='HEAD'?'':body);}catch{res.writeHead(500);res.end();}
});
server.on('error',e=>{console.error(`Local server failed (${e.code}); collector not started.`);process.exitCode=1;});
server.listen(port,'127.0.0.1',async()=>{
 console.log(`DS Market Lab 0.8.0 observation: http://localhost:${port}/#live\nRecording: ${file}`);
 try{const {data}=await api.get(`/series/${SERIES}`);if(data.series?.frequency!=='fifteen_min'||data.series?.ticker!==SERIES)throw Error('Series identity not verified');await record({kind:'series-verified',receivedAt:new Date().toISOString(),series:data.series});}
 catch(e){state.status=e.auth?'access-denied':'error';state.error=e.auth?e.message:'Series verification failed; collector not started.';return;}
 timer=setInterval(poll,interval);await poll();
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;clearInterval(timer);state.status='stopped';server.close();});
