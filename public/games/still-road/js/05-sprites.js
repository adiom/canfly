"use strict";
/* ---------- 5. СПРАЙТЫ 16×16 ---------- */
const sprCache = {};
function charImg(name,dir,fr,ph,gap){
  const key=name+'|'+dir+'|'+fr+'|'+ph+'|'+(gap?1:0);
  if(sprCache[key]) return sprCache[key];
  const c=document.createElement('canvas'); c.width=16; c.height=16;
  const g=c.getContext('2d');
  drawChar(g,name,PALS[ph],dir,fr,gap);
  sprCache[key]=c; return c;
}
function drawChar(g,name,P,dir,fr,gap){
  const px=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
  const dark=P[3], up=dir===1, left=dir===2, right=dir===3;
  if(name==='dog'){
    px(4,14,8,1,dark);
    px(3,9,9,4,P[2]); px(3,9,9,1,dark); px(3,12,9,1,dark);
    px(11,7,4,4,P[2]); px(11,7,4,1,dark);
    px(11,6,1,2,dark); px(14,6,1,2,dark);
    px(13,8,1,1,dark); px(14,10,1,1,P[0]);
    px(4,13,2,2,dark); px(9,13,2,2,dark);
    px(2,7,1,3,P[2]); px(2,7,1,1,dark);
    return;
  }
  const CFG={
    traveler:{cloth:P[2],skin:P[1],hat:P[3],trim:P[0],style:'cap',pack:1},
    merchant:{cloth:P[2],skin:P[1],hat:P[3],trim:P[0],style:'bald',apron:1,beard:1},
    girl    :{cloth:P[1],skin:P[0],hat:PINK,trim:P[2],style:'long'},
    oldman  :{cloth:P[2],skin:P[1],hat:P[0],trim:P[0],style:'hood',beard:1,staff:1},
    barman  :{cloth:P[3],skin:P[1],hat:P[0],trim:P[0],style:'band',apron:1},
    walker  :{cloth:P[3],skin:P[3],hat:P[3],trim:P[0],style:'hood',ghost:1}
  };
  const o = CFG[name]||CFG.traveler;
  const skin=o.skin, cloth=o.cloth, hat=o.hat, trim=o.trim;
  px(4,14,8,1,dark);
  if(fr===0){ px(5,12,2,3,dark); px(9,12,2,3,dark); }
  else if(left||right){ px(6,12,2,3,dark); px(9,13,2,2,dark); }
  else { px(4,12,2,3,dark); px(10,12,2,3,dark); }
  px(4,7,8,6,cloth);
  px(4,7,1,6,dark); px(11,7,1,6,dark); px(4,12,8,1,dark);
  if(o.apron && !up){ px(5,9,6,3,trim); px(7,8,2,1,trim); }
  if(o.style==='hood' && !up){ px(5,8,6,4,P[2]); }
  if(o.pack && up){ px(5,8,6,4,P[3]); px(6,9,4,2,trim); }
  if(o.ghost){ px(4,9,8,4,dark); }
  px(3,8,1,3,dark); px(12,8,1,3,dark);
  px(4,2,8,6,dark); px(5,3,6,4, up? hat : skin);
  if(!up){
    if(left){ px(5,4,1,2,dark); px(6,6,2,1,dark); }
    else if(right){ px(10,4,1,2,dark); px(8,6,2,1,dark); }
    else { px(6,4,1,2,dark); px(9,4,1,2,dark); px(7,6,2,1,dark); }
  }
  if(o.style==='cap'){ px(4,1,8,2,hat); px(3,3,10,1,hat); px(4,1,8,2,hat); }
  if(o.style==='band'){ px(4,2,8,1,trim); }
  if(o.style==='bald'){ px(4,2,8,1,skin); px(5,1,6,1,skin); }
  if(o.style==='hood'){ px(4,1,8,3,hat); px(3,3,10,1,hat); px(4,1,8,2,hat); }
  if(o.style==='long'){
    px(4,1,8,3,hat); px(3,3,10,1,hat);
    px(3,3,2,7,hat); px(11,3,2,7,hat); px(4,1,8,2,hat);
    if(gap) px(10,2,1,2,dark); else px(10,2,1,1,'#ffffff');
  }
  if(o.beard){ px(5,6,6,3,trim); px(4,6,1,2,trim); px(11,6,1,2,trim); if(!up) px(7,6,2,1,dark); }
  if(o.staff){ px(13,3,1,11,dark); px(13,2,1,1,trim); px(12,5,1,2,skin); }
}
const eneCache={};
function enemyImg(kind,fr,ph){
  const key=kind+'|'+fr+'|'+ph; if(eneCache[key]) return eneCache[key];
  const c=document.createElement('canvas'); c.width=24; c.height=24;
  const g=c.getContext('2d'); enemyArt(g,kind,PALS[ph],fr);
  eneCache[key]=c; return c;
}
function enemyArt(g,k,P,fr){
  const px=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
  const b=fr?1:0;
  if(k==='slime'){
    px(5,12+b,14,8-b,P[2]); px(7,8+b,10,5,P[2]); px(9,6+b,6,3,P[2]);
    px(4,19,16,2,P[3]); px(5,12+b,1,7-b,P[3]); px(18,12+b,1,7-b,P[3]);
    px(9,6+b,6,1,P[3]); px(7,8+b,2,1,P[3]); px(15,8+b,2,1,P[3]);
    px(7,11+b,3,3,P[0]); px(14,11+b,3,3,P[0]);
    px(8,12+b,1,2,P[3]); px(15,12+b,1,2,P[3]); px(8,8+b,2,1,P[1]);
  } else if(k==='wolf'){
    px(4,11+b,14,6,P[3]); px(3,9+b,5,5,P[3]); px(2,11+b,3,3,P[2]);
    px(2,12+b,1,1,P[0]); px(4,7+b,2,3,P[3]); px(6,7+b,2,3,P[3]);
    px(5,17,2,4,P[3]); px(9,17,2,4,P[3]); px(14,17,2,4,P[3]);
    px(18,8+b,4,3,P[3]); px(19,7+b,2,1,P[2]);
    px(3,13+b,1,1,P[0]); px(6,12+b,10,2,P[2]);
  } else if(k==='shadow'){
    px(6,8+b,12,11-b,P[3]); px(8,5+b,8,4,P[3]); px(4,12+b,3,5,P[3]); px(17,11+b,3,6,P[3]);
    px(9,3+b,2,3,P[3]); px(14,4+b,2,2,P[3]);
    px(8,10+b,3,2,P[0]); px(14,10+b,3,2,P[0]);
    px(9,10+b,1,1,P[3]); px(15,10+b,1,1,P[3]); px(6,16+b,12,2,P[2]);
  } else {
    px(8,3+b,8,6,P[3]); px(9,4+b,6,4,P[2]);
    px(9,9+b,6,11-b,P[3]); px(10,10+b,4,8,P[2]);
    px(6,10+b,2,7,P[3]); px(16,10+b,2,7,P[3]);
    px(10,6+b,1,2,P[0]); px(13,6+b,1,2,P[0]); px(7,20,10,2,P[3]);
  }
}
