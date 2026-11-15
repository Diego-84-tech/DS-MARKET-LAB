const KEY='market-lab:auth:v2',OLD='market-lab:auth:v1',PREF='market-lab:remember:v1';
export function normalizeSession(value,now=Date.now()){
 if(!value||typeof value.access_token!=='string'||!value.access_token||typeof value.refresh_token!=='string'||!value.refresh_token)return null;
 const expires=Number(value.expires_at)||((Number(value.expires_in)>0)?Math.floor(now/1000)+Number(value.expires_in):0);if(!Number.isFinite(expires)||expires<=0)return null;
 return {...value,expires_at:expires};
}
export function loadAuth(temporary,persistent){
 let remember=false;try{remember=persistent.getItem(PREF)==='true';}catch{}
 for(const store of [remember?persistent:temporary,temporary])for(const key of [KEY,OLD]){try{const session=normalizeSession(JSON.parse(store.getItem(key)||'null'));if(session)return {session,remember:store===persistent&&remember};}catch{}}
 return {session:null,remember};
}
export function saveAuth(session,remember,temporary,persistent){
 const valid=normalizeSession(session);if(session&&!valid)throw Error('Invalid login session');
 for(const store of [temporary,persistent])for(const key of [KEY,OLD]){try{store.removeItem(key);}catch{}}
 try{persistent.setItem(PREF,valid&&remember?'true':'false');}catch{if(valid&&remember)throw Error('This browser cannot keep you signed in. Uncheck Keep me signed in and try again.');}
 if(valid){try{(remember?persistent:temporary).setItem(KEY,JSON.stringify(valid));}catch{throw Error('Could not save this device session.');}}
}
