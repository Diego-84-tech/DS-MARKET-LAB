export const DEFAULT_POLICY=Object.freeze({alpha15Only:true,alphaCloseMinutes:2,maximumHorizonDays:30,minimumHistory:3,minimumEdge:.05,maximumPositions:8,requireExitPlan:true,paceResearch:false});
export const policyFor=a=>({...DEFAULT_POLICY,...a?.policy});
export const ownerInstructions=(state,id)=>(state.ownerInstructions||[]).filter(x=>x.scope==='all'||x.scope===id);
export function validatePolicy(p){for(const key of Object.keys(DEFAULT_POLICY))if(typeof p[key]!==typeof DEFAULT_POLICY[key])throw Error('Invalid setting '+key);if(!Number.isInteger(p.minimumHistory)||p.minimumHistory<0||p.minimumHistory>100||p.minimumEdge<0||p.minimumEdge>1||!Number.isInteger(p.maximumPositions)||p.maximumPositions<1||p.maximumPositions>100||!Number.isInteger(p.maximumHorizonDays)||p.maximumHorizonDays<1||p.maximumHorizonDays>30||!Number.isInteger(p.alphaCloseMinutes)||p.alphaCloseMinutes<0||p.alphaCloseMinutes>14)throw Error('Settings outside supported ranges');return Object.fromEntries(Object.keys(DEFAULT_POLICY).map(k=>[k,p[k]]));}
export function researchPacing(state,now=Date.now()){
 if(!state.ownerPolicy?.paceResearch)return null;const b=state.budget,day=new Date(now).toISOString().slice(0,10),elapsed=(now-Date.parse(day+'T00:00:00Z'))/86400000,spent=b.day===day?b.daySpent:0,allowance=Math.min(b.dailyCap,Math.max(.02,b.dailyCap*elapsed));
 return spent+.02>allowance?'Daily allowance is being spread across the day; market monitoring continues.':null;
}
