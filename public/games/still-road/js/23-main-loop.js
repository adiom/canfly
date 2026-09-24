"use strict";
/* ---------- 23. ГЛАВНЫЙ ЦИКЛ ---------- */
function update(){
  S.tick++;
  if(keys.has('a')) S.holdA++; else S.holdA=0;
  if(S.toastT>0) S.toastT--;
  musUpdate();
  updFade();
  if(hit('t') && (S.mode==='world'||S.mode==='menu')) setTime(PH+1);
  if(hit('m')){ MUTED=!MUTED; toast('ЗВУК: '+(MUTED?'ВЫКЛ':'ВКЛ')); }
  if(S.mode==='title') updTitle();
  else if(S.mode==='intro') updIntro();
  else if(S.mode==='docs') updDocs();
  else if(S.mode==='world'){
    updWorld();
    if(S.mode==='world' && !S.fade.on){
      if(B()){ SFX.ok(); S.mode='menu'; S.menu.i=0; }
      else if(A()){ S.still=0; interact(); }
      else updStill();
    }
  }
  else if(S.mode==='dialog') updDialog();
  else if(S.mode==='menu') updMenu();
  else if(S.mode==='journal') updJournal();
  else if(S.mode==='friends') updFriends();
  else if(S.mode==='help') updHelp();
  else if(S.mode==='items') updItems();
  else if(S.mode==='status'){ if(A()||B()){ SFX.blip(); S.mode='menu'; } }
  else if(S.mode==='save') updSave();
  else if(S.mode==='saving') updSaving();
  else if(S.mode==='error') updError();
  else if(S.mode==='battle'){ if(!S.fade.on) btUpd(); }
  pressed.clear();
}
function draw(){
  if(S.mode==='title') drawTitle();
  else if(S.mode==='intro') drawIntro();
  else if(S.mode==='docs') drawDocs();
  else if(S.mode==='error') drawError();
  else if(S.mode==='battle') drawBattle();
  else if(S.mode==='journal') drawJournal();
  else if(S.mode==='friends') drawFriends();
  else if(S.mode==='help') drawHelp();
  else {
    drawWorld();
    if(S.mode==='dialog') drawDialog();
    else if(S.mode==='menu') drawMenu();
    else if(S.mode==='items') drawItems();
    else if(S.mode==='status') drawStatus();
    else if(S.mode==='save') drawSave();
    else if(S.mode==='saving') drawSaving();
  }
  if(PH===3 && S.mode!=='error'){ G.fillStyle='rgba(10,14,30,0.18)'; G.fillRect(0,0,W,H); }
  drawFade();
  drawGlitch();
}
function fatal(msg,line){
  try{
    G.fillStyle='#000'; G.fillRect(0,0,W,H);
    tx(G,'ОШИБКА:',4,8,'#ff9090');
    const ls=wrap(String(msg),28).slice(0,7);
    for(let i=0;i<ls.length;i++) tx(G,ls[i],4,22+i*10,'#ffffff');
    tx(G,'СТРОКА: '+line,4,112,'#93a4bd');
  }catch(e){}
}
window.onerror=function(msg,src,line,col){ fatal(msg,line); return false; };
let lastT=0, accT=0;
function loop(t){
  requestAnimationFrame(loop);
  if(!lastT) lastT=t;
  let dt=t-lastT; lastT=t; if(dt>200) dt=200;
  accT+=dt;
  let guard=0;
  while(accT>=16.6667 && guard<6){ update(); accT-=16.6667; guard++; }
  if(guard>=6) accT=0;
  try{ draw(); }catch(err){ fatal((err&&err.message)||err,0); }
}
S.mode='title';
try{ draw(); }catch(e){ fatal((e&&e.message)||e,0); }
(function(){ const b=document.getElementById('boot'); if(b&&b.parentNode) b.parentNode.removeChild(b); })();
requestAnimationFrame(loop);
