const screens=new Set(['trading','accounts','bank','markets']);
const screen=value=>screens.has(value)?value:'trading';
export function createNavigation(initial){
 let current=screen(initial);const previous=[];
 return {
  visit(value){const next=screen(value);if(next!==current){previous.push(current);current=next;}return current;},
  back(){current=previous.pop()||'trading';return current;},
  get canBack(){return previous.length>0||current!=='trading';}
 };
}
