import {achievementState} from '../dist/achievements.mjs';
export const identity=id=>id==='A'?{appId:'AlphaBot',name:'15-minute Trader',color:'#438cff'}:{appId:'Beta',name:'Flexible Horizon',color:'#b18aff'};
export const IMAGE_PRICE=500;
export function upgrade(state){
 state.version='0.5.0';state.releaseVersion='0.8.0';state.imageBudget ||= {cap:1,reserved:0,spent:0};
 for(const a of state.agents){achievementState(a);a.appId=identity(a.id).appId;a.role ||= identity(a.id).name;if(!a.needsIdentity)a.displayName ||= identity(a.id).name;a.runId ||= crypto.randomUUID();a.runNumber ||= 1;a.runStartedAt ||= state.createdAt||new Date().toISOString();a.lifecycle ||= 'active';a.imageRequests ||= [];a.images ||= [];a.cosmeticSpent ||= 0;
  if(!a.imageRequests.length&&!a.images.length)a.imageRequests.push({id:crypto.randomUUID(),status:'approved',free:true,price:0,createdAt:new Date().toISOString()});
 }
 return state;
}
export function imageAllowance(a,now=Date.now()){
 const interest=a.loans.reduce((n,l)=>n+(l.unpaidInterest||0)+Math.ceil(l.principal*l.apr/100*Math.max(0,now-l.accruedFrom)/86400000/365),0);
 const b=a.performanceBaseline||{realized:0,interestPaid:0,cosmeticSpent:0};return Math.max(0,Math.min(a.cash,(a.realized-b.realized)-(a.interestPaid-b.interestPaid)-interest-((a.cosmeticSpent||0)-(b.cosmeticSpent||0))));
}
export function requestImage(a,prompt,reason,now=Date.now()){
 if(a.imageRequests.some(r=>['pending','approved','generating'].includes(r.status)))throw Error('A profile picture request is already open.');
 if(imageAllowance(a,now)<IMAGE_PRICE)throw Error('Needs $5 of available realized profit after fees and interest. Borrowed cash and open gains do not qualify.');
 const r={id:crypto.randomUUID(),status:'pending',free:false,price:IMAGE_PRICE,prompt:String(prompt).slice(0,600),reason:String(reason).slice(0,800),createdAt:new Date(now).toISOString()};a.imageRequests.push(r);return r;
}
export function reviewImage(a,id,approve,now=Date.now()){
 const r=a.imageRequests.find(r=>r.id===id);if(!r||r.status!=='pending')throw Error('This picture request is no longer pending.');
 if(approve&&imageAllowance(a,now)<r.price)throw Error('Eligible earned profit is no longer available.');
 r.status=approve?'approved':'denied';r.reviewedAt=new Date(now).toISOString();return r;
}
