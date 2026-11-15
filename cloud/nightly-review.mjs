import {totals} from './engine.mjs';
export function nightlyReview(state,now=Date.now()){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const day=`${parts.year}-${parts.month}-${parts.day}`;state.nightlyReviews ||= [];
 if(Number(parts.hour)<21||state.nightlyReviews.some(r=>r.day===day)||!state.startedAt)return null;
 const review={day,at:new Date(now).toISOString(),status:day==='2026-11-15'?'Interrupted day · excluded from full-day comparison':'Owner review required',interrupted:day==='2026-11-15',comparisonEligible:day!=='2026-11-15',accounts:state.agents.map(a=>({id:a.id,runId:a.runId,name:a.displayName,appId:a.appId,...totals(a),realized:a.realized,interestPaid:a.interestPaid,ownerCredits:a.ownerCredits||0})),note:(day==='2026-11-15'?'Owner reported a roughly six-hour interruption. Preserve results but exclude this day from full-day comparisons. ':'')+'Paper results only. No funds, loans or replacements are automatically approved.'};state.nightlyReviews.push(review);return {type:'NIGHTLY_REVIEW',report:review,detail:'9 PM Eastern account review saved for owner. No balance changes.'};
}
