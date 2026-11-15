export function resumeBlock(state,acknowledged,now=Date.now()){
 if(state.reviewRequired&&acknowledged!==true)return 'Review mode: examine the forecast report and explicitly acknowledge it before resuming new purchases.';
 if(state.endsAt&&now>=Date.parse(state.endsAt))return 'Experiment ended. Preserve records and review before a new experiment.';
 if(state.keyExpiresAt&&now>=Date.parse(state.keyExpiresAt))return 'Key safety deadline reached. New purchases cannot resume.';
 return null;
}
