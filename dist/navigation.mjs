const aliases={accounts:'profiles',bank:'loans',markets:'recordings'};
const screens=new Set(['home','trading','profiles','loans','recordings','settings']);
export const screen=value=>screens.has(aliases[value]||value)?(aliases[value]||value):'home';
export function createNavigation(initial){let current=screen(initial);const previous=[];return {visit(value){const next=screen(value);if(next!==current){previous.push(current);current=next;}return current;},back(){current=previous.pop()||'home';return current;},get canBack(){return previous.length>0||current!=='home';}};}
