export async function seedRuleHistory(call,catalog){
 let count=0;for(const e of catalog.history){const h=e.id.slice(0,32),requestId=[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');await call('release-note',{requestId,sourceAt:e.at,author:'Codex / recorded repository history',text:'Historical source: '+e.source+' — '+e.title,data:{...e,historyImport:true,status:'historical'}});count++;}return count;
}
