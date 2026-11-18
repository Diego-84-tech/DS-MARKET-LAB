const aliases={accounts:'profiles',bank:'loans',markets:'recordings'};
const screens=new Set(['home','trading','profiles','loans','recordings','settings','archives','rules','chat']);
export const screen=value=>{const base=String(value||'').split('/')[0];return screens.has(aliases[base]||base)?(aliases[base]||base):'home';};
export const route=value=>{try{const parts=String(value||'').split('/'),base=aliases[parts[0]]||parts[0];if(!screens.has(base))return 'home';if(!['profiles','chat'].includes(base))return base;if(parts.slice(1).some(x=>!/^[-A-Za-z0-9]+$/.test(x)))return base;return [base,...parts.slice(1,3)].join('/');}catch{return 'home';}};
export function createNavigation(initial){let current=route(initial);const previous=[];return {visit(value){const next=route(value);if(next!==current){previous.push(current);current=next;}return current;},back(){current=previous.pop()||'home';return current;},get canBack(){return previous.length>0||current!=='home';}};}
