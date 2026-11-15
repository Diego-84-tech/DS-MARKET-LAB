// Cosmetic achievements only: no cash, credit, model access, or API budget changes.
export const ACHIEVEMENT_VERSION=1;
export const BADGES=[
 {id:'evidence-first',name:'Evidence First',symbol:'◈',xp:10,description:'Use at least three real history samples in checked research on three distinct markets.'},
 {id:'first-net-win',name:'First Net Win',symbol:'★',xp:20,description:'Close a whole position with a positive combined result after trading fees.'},
 {id:'plan-keeper',name:'Plan Keeper',symbol:'◇',xp:25,description:'Close three whole positions through their server-monitored numeric exit plans. Loss exits count as following a plan.'},
 {id:'five-percent',name:'Five Percent',symbol:'✦',xp:30,description:'Earn realized net profit equal to 5% of starting capital after fees, interest and picture costs. Open losses reduce progress; open gains and loans do not help.'},
 {id:'steady-earner',name:'Steady Earner',symbol:'◆',xp:40,description:'Have three winning positions among five recent complete closes, a positive combined result, and positive qualifying account earnings.'},
 {id:'profitable-finish',name:'Profitable Finish',symbol:'♜',xp:75,description:'Complete the experiment with positive qualifying earnings, no open positions or orders, and all loans paid.'}
];
export function achievementState(agent,now=Date.now()){
 agent.achievements ||= {version:ACHIEVEMENT_VERSION,startedAt:new Date(now).toISOString(),awards:[],completed:0,wins:0,planCloses:0,netClosed:0,evidenceMarkets:[],recentCloses:[],activeRounds:{},seen:[],lastFinancialAt:null};return agent.achievements;
}
export function qualifyingEarnings(agent,now=Date.now()){
 const b=agent.performanceBaseline||{realized:0,interestPaid:0,cosmeticSpent:0};
 const interest=(agent.loans||[]).reduce((s,l)=>s+(l.unpaidInterest||0)+Math.ceil(l.principal*l.apr/100*Math.max(0,now-l.accruedFrom)/86400000/365),0);
 const realized=(agent.realized-b.realized)-(agent.interestPaid-b.interestPaid)-((agent.cosmeticSpent||0)-(b.cosmeticSpent||0))-interest;
 const openLoss=(agent.positions||[]).reduce((s,p)=>s+Math.min(0,(p.mark??p.cost)-p.cost),0);
 return {realized,qualifying:realized+openLoss,stale:(agent.positions||[]).some(p=>p.markStale===true||!Number.isFinite(p.mark))};
}
export function achievementProgress(agent,mode,now=Date.now()){
 const a=agent.achievements||{awards:[],completed:0,wins:0,planCloses:0,evidenceMarkets:[],recentCloses:[]},earned=qualifyingEarnings(agent,now),recent=a.recentCloses||[],steady=recent.length>=5&&recent.filter(c=>c.pnl>0).length>=3&&recent.reduce((n,c)=>n+c.pnl,0)>0&&earned.qualifying>0&&!earned.stale;
 const noDebt=!(agent.loans||[]).some(l=>l.principal>0||l.unpaidInterest>0);
 const goals={'evidence-first':[(a.evidenceMarkets||[]).length,3],'first-net-win':[a.wins||0,1],'plan-keeper':[a.planCloses||0,3],'five-percent':[earned.stale?0:Math.max(0,earned.qualifying),agent.start*.05],'steady-earner':[steady?1:0,1],'profitable-finish':[mode==='completed'&&!agent.positions.length&&!agent.orders.length&&noDebt&&earned.qualifying>0&&!earned.stale?1:0,1]};
 return BADGES.map(b=>({...b,earned:(a.awards||[]).find(x=>x.id===b.id)||null,current:Math.min(goals[b.id][0],goals[b.id][1]),target:goals[b.id][1],ready:goals[b.id][0]>=goals[b.id][1]}));
}
export function achievementSummary(agent){const awards=agent.achievements?.awards||[],xp=awards.reduce((n,a)=>n+(BADGES.find(b=>b.id===a.id)?.xp||0),0);return {earned:awards.length,total:BADGES.length,xp,level:1+Math.floor(xp/50)};}
export function updateAchievements(state,events=[],now=Date.now()){
 const awarded=[];
 for(const agent of state.agents){const a=achievementState(agent,now),mine=events.filter(e=>e.agent===agent.id).sort((x,y)=>(Date.parse(x.at)||now)-(Date.parse(y.at)||now));
  for(const e of mine){
   if(e.type==='ASSESSMENT'&&e.checked===true&&(e.history?.samples||0)>=3&&e.market&&a.evidenceMarkets.length<3&&!a.evidenceMarkets.includes(e.market))a.evidenceMarkets.push(e.market);
   if(!['SELL','SETTLE'].includes(e.type)||!Number.isFinite(e.pnl))continue;
   const at=Date.parse(e.at);if(Number.isFinite(e.openedAt)&&e.openedAt<Date.parse(a.startedAt))continue;if(!Number.isFinite(at)||at<Date.parse(a.startedAt)||at<Date.parse(a.lastFinancialAt||a.startedAt))continue;
   const key=[e.type,e.order||'',e.market,e.side||'',e.openedAt||'',e.at,e.quantity||'',e.pnl].join('|');if(a.seen.includes(key))continue;a.seen.push(key);a.seen=a.seen.slice(-100);a.lastFinancialAt=e.at;
   const roundKey=[e.market,e.side||'',e.openedAt||e.order||e.at].join('|'),r=a.activeRounds[roundKey]||{pnl:0,planned:true};r.pnl+=e.pnl;r.planned&&=e.planExit===true;a.activeRounds[roundKey]=r;
   if(e.type==='SETTLE'||e.positionClosed===true){a.completed++;a.netClosed+=r.pnl;if(r.pnl>0)a.wins++;if(r.planned)a.planCloses++;a.recentCloses.push({market:e.market,at:e.at,pnl:r.pnl});a.recentCloses=a.recentCloses.slice(-5);delete a.activeRounds[roundKey];}
  }
  for(const badge of achievementProgress(agent,state.mode,now))if(badge.ready&&!badge.earned){const award={id:badge.id,earnedAt:new Date(now).toISOString(),xp:badge.xp};a.awards.push(award);awarded.push({type:'ACHIEVEMENT',agent:agent.id,badge:badge.id,name:badge.name,xp:badge.xp,at:award.earnedAt,detail:'Cosmetic achievement earned from server-recorded evidence. No money or permissions granted.'});}
 }
 return awarded;
}
