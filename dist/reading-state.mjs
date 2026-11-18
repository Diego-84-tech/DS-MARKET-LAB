export function rememberReading(root=document){
 const items=[...root.querySelectorAll('[data-anchor]')],anchor=items.find(el=>el.getBoundingClientRect().bottom>100),active=root.activeElement||document.activeElement;
 return {x:window.scrollX,y:window.scrollY,anchor:anchor?.dataset.anchor,top:anchor?.getBoundingClientRect().top,open:[...root.querySelectorAll('details[open][data-key]')].map(x=>x.dataset.key),focus:active?.id,selection:active?.selectionStart,drafts:[...root.querySelectorAll('input,textarea,select')].filter(x=>x.id&&x.type!=='password').map(x=>({id:x.id,value:x.value,checked:x.checked}))};
}
export function restoreReading(saved,root=document){
 if(!saved)return;for(const key of saved.open)for(const d of root.querySelectorAll('details[data-key]'))if(d.dataset.key===key)d.open=true;
 for(const d of saved.drafts){const el=root.querySelector('#'+CSS.escape(d.id));if(el){el.value=d.value;if(el.type==='checkbox')el.checked=d.checked;}}
 const focus=saved.focus&&root.querySelector('#'+CSS.escape(saved.focus));if(focus){focus.focus({preventScroll:true});try{focus.setSelectionRange(saved.selection,saved.selection);}catch{}}
 const anchor=[...root.querySelectorAll('[data-anchor]')].find(x=>x.dataset.anchor===saved.anchor);window.scrollTo(saved.x,anchor?window.scrollY+anchor.getBoundingClientRect().top-saved.top:saved.y);
}
export function budgetStatus(state,now=Date.now()){
 const b=state.budget||{},day=new Date(now).toISOString().slice(0,10),spent=b.day===day?b.daySpent||0:0;
 const midnight=Date.parse(day+'T00:00:00Z')+86400000;
 if((b.spent||0)+(b.reserved||0)+.02>(b.cap||0))return {blocked:true,label:'Total AI allowance reached',resumesAt:null};
 if(spent+.02>(b.dailyCap||0))return {blocked:true,label:'Daily AI allowance reached',resumesAt:midnight};
 return {blocked:false,label:'AI allowance available',remaining:Math.max(0,(b.dailyCap||0)-spent),resumesAt:null};
}
