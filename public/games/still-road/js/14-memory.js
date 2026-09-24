"use strict";
/* ---------- 14. ПАМЯТЬ ИГРЫ ---------- */
const MEMKEY='stillroad_memory_v1';
const MEM=(function(){
  const d={v:2,visits:0,sawCorrupt:false,corruptCount:0,closedOnError:false,
           metWalker:false,endings:0,returnedPixel:false,forgotText:null,leftOnRoad:false,friends:0};
  try{
    const r=STORE.getItem(MEMKEY);
    if(r){ const o=JSON.parse(r); for(const k in d) if(o[k]!==undefined) d[k]=o[k]; }
  }catch(e){}
  d.visits=d.visits+1;
  try{ STORE.setItem(MEMKEY,JSON.stringify(d)); }catch(e){}
  return d;
})();
function saveMem(){ try{ STORE.setItem(MEMKEY,JSON.stringify(MEM)); }catch(e){} }
function remember(k,v){ MEM[k]=v; saveMem(); }
function noteExit(){
  if(S.mode==='error'||S.mode==='saving') MEM.closedOnError=true;
  else if(S.mode==='world'||S.mode==='dialog'||S.mode==='menu'||S.mode==='journal') MEM.leftOnRoad=true;
  saveMem();
}
window.addEventListener('beforeunload',noteExit);
document.addEventListener('visibilitychange',function(){
  if(document.hidden){
    noteExit();
    try{ const a=ac(); if(a&&a.suspend) a.suspend(); }catch(e){}
  } else {
    try{ const a=ac(); if(a&&a.resume) a.resume(); }catch(e){}
  }
});
