export const SUPABASE_URL='https://lfgmvycxqinoriamprhr.supabase.co';
export const PUBLIC_KEY='sb_publishable_YD4bieZnZkromklCfPi2ng_oG-LZ2dL';
export async function gateway(action,payload={},jwt=null){
 const response=await fetch(SUPABASE_URL+'/rest/v1/rpc/market_lab_gateway',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})},body:JSON.stringify({p_action:action,p_payload:jwt?payload:{...payload,worker:process.env.MARKET_LAB_WORKER_SECRET}}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('State service unavailable ('+response.status+')');return response.json();
}
export async function archiveGateway(action,payload={},jwt=null){
 const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/market_lab_archives',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})},body:JSON.stringify({p_action:action,p_payload:jwt?payload:{...payload,worker:process.env.MARKET_LAB_WORKER_SECRET}}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Archive service unavailable ('+r.status+')');return r.json();
}
export async function workspaceGateway(action,payload={},jwt=null){
 const r=await fetch(SUPABASE_URL+'/rest/v1/rpc/market_lab_workspace',{method:'POST',headers:{apikey:PUBLIC_KEY,'Content-Type':'application/json',...(jwt?{Authorization:'Bearer '+jwt}:{})},body:JSON.stringify({p_action:action,p_payload:jwt?payload:{...payload,worker:process.env.MARKET_LAB_WORKER_SECRET}}),signal:AbortSignal.timeout(20000)});if(!r.ok){let message='Workspace unavailable ('+r.status+')';try{const d=await r.json();if(typeof d.message==='string'&&!d.message.includes('SQL'))message=d.message.slice(0,250);}catch{}throw Error(message);}return r.json();
}
