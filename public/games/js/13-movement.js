"use strict";
/* ---------- 13. ДВИЖЕНИЕ ---------- */
function npcAt(x,y){
  const list=SCENES[S.scene].npcs;
  for(let i=0;i<list.length;i++) if(list[i].x===x&&list[i].y===y) return list[i];
  return null;
}
function tileAt(x,y){
  const m=MAP();
  if(y<0||y>=m.length||x<0||x>=m[0].length) return 'T';
  return m[y][x];
}
function solidAt(x,y){
  const ch=tileAt(x,y);
  if(ch==='L' && S.flags.tower) return false;
  return isSolidCh(ch) || !!npcAt(x,y);
}
function tryStep(d){
  const nx=S.px+DX[d], ny=S.py+DY[d];
  if(solidAt(nx,ny)){ S.bump=6; return; }
  S.mv={dx:DX[d],dy:DY[d],nx:nx,ny:ny,t:0,total:11};
  if(S.steps%2===0) SFX.step();
}
function updWorld(){
  updGuest(); updFx();
  if(S.banner>0) S.banner--;
  if(S.bump>0) S.bump--;
  if(S.fade.on) return;
  if(S.mv){
    S.mv.t++;
    const k=S.mv.t/S.mv.total;
    S.ox=S.mv.dx*TS*k; S.oy=S.mv.dy*TS*k; S.anim++;
    if(S.mv.t>=S.mv.total){ S.px=S.mv.nx; S.py=S.mv.ny; S.ox=0; S.oy=0; S.mv=null; S.steps++; onStep(); }
    return;
  }
  const d=dirHeld();
  if(d>=0){ S.dir=d; tryStep(d); }
}
function onStep(){
  const sc=SCENES[S.scene], ch=tileAt(S.px,S.py);
  for(let i=0;i<sc.exits.length;i++){
    const e=sc.exits[i];
    if(S.px>=e.x && S.px<e.x+e.w && S.py>=e.y && S.py<e.y+e.h){ travel(e.to,e.tx,e.ty,e.dir); return; }
  }
  if(ch==='X'||ch==='Y') pickUp();
  if(sc.enc && sc.enc.tiles.indexOf(ch)>=0 && S.steps-S.lastBattle>5 && Math.random()<sc.enc.rate){
    S.lastBattle=S.steps;
    const kind=pick(sc.enc.pool);
    startBattle(kind, isFriend(kind) && Math.random()<0.55);
  }
}
function pickUp(){
  const m=MAP();
  if(S.scene==='field' && !has('key')){
    m[S.py][S.px]=','; addItem('key'); S.flags.key=true; SFX.item();
    jot('КЛЮЧ ОТ БАШНИ. КТО-ТО СПРЯТАЛ ЕГО ЗА КАМНЕМ И ЗАБЫЛ. Я ПОНИМАЮ. Я ТОЖЕ ЗАБЫВАЮ.');
    say(['ТЫ НАШЛА: КЛЮЧ ОТ БАШНИ.','КТО-ТО ПОЛОЖИЛ ЕГО ЗА КАМЕНЬ И ЗАБЫЛ.','КАК И ВСЁ ОСТАЛЬНОЕ В ЭТОЙ ИГРЕ.','(РЕЙН. БАШНЯ НА СЕВЕРЕ. ДВЕРЬ ЖДЁТ.)']);
  } else if(S.scene==='cave' && !has('pixel')){
    m[S.py][S.px]='f'; addItem('pixel'); S.flags.pixel=true; SFX.item();
    jot('РОЗОВЫЙ ПИКСЕЛЬ. ТЁПЛЫЙ. ЧЕЙ-ТО. Я ПОНЕСУ ЕГО ОБРАТНО.');
    say(['ТЫ НАШЛА: РОЗОВЫЙ ПИКСЕЛЬ.','ОН ТЁПЛЫЙ. ОН ЧЕЙ-ТО.','В РЕЙНЕ У КОЛОДЦА СТОИТ ДЕВОЧКА. У НЕЁ ВОЛОСЫ НЕ ПОЛНОЦВЕТНЫЕ.']);
  } else {
    m[S.py][S.px]=SCENES[S.scene].xArt;
    say(['ЗДЕСЬ ЧТО-ТО БЫЛО. ТЕПЕРЬ НЕТ.','МИР НЕ ОБЪЯСНЯЕТ. МИР ПРОСТО ПРОДОЛЖАЕТСЯ.']);
  }
}
function interact(){
  const fx=S.px+DX[S.dir], fy=S.py+DY[S.dir];
  const n=npcAt(fx,fy);
  if(n){ SFX.blip(); n.talk(n); return; }
  const ch=tileAt(fx,fy), sc=SCENES[S.scene];
  const fn=sc.look?sc.look[ch]:null;
  if(fn){ const r=fn(fx,fy); if(typeof r==='string') say([r]); else if(r&&r.length) say(r); return; }
  SFX.no();
}
