// Observation lives on its own page. Never feeds the practice engine or Strategy Lab.
export function livePanel(){return `<section class="panel" id="live-observation" aria-live="polite"><h2>Kalshi · Read-only observation</h2><p>Public REST polling · No orders, simulated fills, AI, or wallet activity.</p><p id="live-status">Connecting to the local collector…</p><p id="live-warning" class="storage-warning"></p><dl id="live-fields"></dl><h3>Recent verified outcomes</h3><p id="live-outcomes">Not received.</p><p class="section-note">Live observations remain separate from fictional practice and Strategy Lab. Missing values remain unavailable. Quotes are snapshots, not guaranteed fills. Ask prices and quantities are derived from opposite-side bids. Receipt freshness does not verify exchange quote freshness.</p><p class="section-note">Start locally with <code>npm run observe</code>, then open <code>http://localhost:8081/#live</code>. A static-only host cannot collect data. No automatic startup service is installed.</p></section>`;}
const time=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'Unavailable';
const quote=v=>v?`${(v.price/100).toFixed(2)}¢ · ${(v.quantity/100).toFixed(2)} contracts`:'Unavailable';
function field(host,label,value){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;host.append(dt,dd);}
let fetching=false;
export async function refreshObservation(){
 const panel=document.querySelector('#live-observation');if(!panel||fetching)return;fetching=true;
 try{
  const r=await fetch('/api/observation',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Local collector unavailable');const s=await r.json();
  if(s.source!=='kalshi-public-rest')throw Error('Unexpected source');
  if(!panel.isConnected)return;
  panel.querySelector('#live-status').textContent=`Connection: ${s.status} · ${s.samples} recorded snapshots · ${s.intervalMs/1000}s polling`;
  const fresh=s.latest?.receivedAt?Date.now()-Date.parse(s.latest.receivedAt):Infinity;
  const stale=s.stale||fresh>20000;
  panel.querySelector('#live-warning').textContent=[s.error,stale?'STALE / UNAVAILABLE — collection stopped, failed, expired, missing/crossed quotes, or last received more than 20 seconds ago.':'Recently received; exchange quote timestamp unavailable.'].filter(Boolean).join(' ');
  const f=panel.querySelector('#live-fields');f.replaceChildren();const m=s.latest?.market,q=s.latest?.quotes;
  for(const [k,v] of [
   ['Source','Kalshi public REST · actual observations'],['Selected market',m?.ticker||'No current market received'],['Market title',m?.title||'Unavailable'],['Market status',m?.status||'Unavailable'],['Last quote received locally',time(s.latest?.receivedAt)],['Exchange quote timestamp',time(s.latest?.exchangeQuoteTime)],['Market metadata updated (not quote time)',time(s.latest?.marketMetadataUpdatedAt)],['Trading closes',time(m?.close_time)],['Expected expiration',time(m?.expected_expiration_time)],['Expiration / latest expiration',time(m?.expiration_time)+' / '+time(m?.latest_expiration_time)],['YES bid / available quantity',quote(q?.yesBid)],['YES ask / available quantity (derived)',quote(q?.yesAsk)],['NO bid / available quantity',quote(q?.noBid)],['NO ask / available quantity (derived)',quote(q?.noAsk)],['Official target',m?.floor_strike==null?'Unavailable':String(m.floor_strike)],['Current market verified result',s.outcomes?.find(o=>o.market===m?.ticker)?.result||'Unavailable / not finalized'],['Missing fields',s.latest?.missing?.join(', ')||'No snapshot received'],['Local recording',s.recording||'Unavailable']
  ])field(f,k,v);
  panel.querySelector('#live-outcomes').textContent=s.outcomes?.length?s.outcomes.map(o=>`${o.market}: ${o.result.toUpperCase()} · settled ${time(o.settlementTime)} · final value ${o.expirationValue??'unavailable'} (Kalshi reported)`).join('\n'):'No finalized outcomes received; none inferred.';
 }catch{
  if(panel.isConnected){panel.querySelector('#live-status').textContent='Connection: local collector unavailable';panel.querySelector('#live-warning').textContent='STALE / UNAVAILABLE — no current live data. Start npm run observe and use port 8081. Previously displayed values are not current.';}
 }finally{fetching=false;}
}
setInterval(refreshObservation,2000);
