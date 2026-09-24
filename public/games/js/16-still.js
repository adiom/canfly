"use strict";
/* ---------- 16. ТИХИЕ СОБЫТИЯ ---------- */
const IDLE_THOUGHTS=[
 'Я МОГУ СТОЯТЬ СКОЛЬКО ХОЧУ. НИКТО НЕ СЧИТАЕТ.',
 'ВЕТЕР ИДЁТ В ТУ ЖЕ СТОРОНУ. МЫ С НИМ СОГЛАСНЫ.',
 'ЕСЛИ НИКУДА НЕ ИДТИ, ДОРОГА ВСЁ РАВНО ЕСТЬ.',
 'Я НЕ ОПОЗДАЮ. МНЕ НЕКУДА ОПОЗДАТЬ.',
 'СТОЯТЬ - ЭТО ТОЖЕ ДВИЖЕНИЕ. ПРОСТО МЕДЛЕННЕЕ.',
 'ПИСЬМО В СУМКЕ СТАЛО ЧУТЬ ТЕПЛЕЕ. ИЛИ ЭТО Я.',
 'МУЗЫКА СТАЛА ТИШЕ. ИЛИ ЭТО Я ПРИСЛУШАЛАСЬ.'
];
const STILL=[
 {id:'home', scene:'town1', need:150, once:1, run:function(){
    sayThought('ГОРОД ДЫШИТ МЕДЛЕННО. Я ПОПРОБУЮ ТАК ЖЕ.'); }},
 {id:'well1', scene:'town1', need:140, once:1, near:{x:8,y:7,r:3}, run:function(){
    S.fx={type:'ripple',t:0,ttl:80,x:8*TS,y:7*TS};
    sayThought('КОЛОДЕЦ СЛУШАЕТ.','ЕСЛИ СМОТРЕТЬ ДОЛЬШЕ, ОН НАЧНЁТ ОТВЕЧАТЬ.'); }},
 {id:'grass', scene:'field', need:170, tile:',', once:1, run:function(){
    S.fx={type:'grass',t:0,ttl:80,x:S.px*TS+4,y:S.py*TS+4};
    tone(520,0.2,'triangle',0.03);
    const p=['ТРАВА РАССТУПИЛАСЬ.','НЕ ПОТОМУ ЧТО Я ПРОСИЛА. ПРОСТО Я ПЕРЕСТАЛА ИДТИ.'];
    if(!S.flags.key) p.push('ГДЕ-ТО ДАЛЬШЕ, ЗА БОЛЬШИМ КАМНЕМ, ЧТО-ТО БЛЕСТИТ. ОБХОДИТЬ СЛЕВА.');
    sayThought(p);
    jot('ЕСЛИ ОСТАНОВИТЬСЯ В ПОЛЕ, ТРАВА РАССТУПАЕТСЯ САМА. МИР ПОМОГАЕТ ТОЛЬКО ТЕМ, КТО СТОИТ.'); }},
 {id:'forest', scene:'forest', need:180, once:1, run:function(){
    const sp=freeSpotNear(4);
    if(sp) spawnGuest('dog',sp,760,2,false);
    sayThought('ЛЕС СЛУШАЕТ. Я СЛУШАЮ В ОТВЕТ.','ВДАЛИ КТО-ТО СЕЛ И СМОТРИТ. НЕ СТРАШНО. ПРОСТО СМОТРИТ.'); }},
 {id:'cave', scene:'cave', need:210, once:1, run:function(){
    S.fx={type:'dim',t:0,ttl:150,x:0,y:0};
    sayThought('В ТЕМНОТЕ КТО-ТО ДЫШИТ.','МОЖЕТ, ЭТО Я. НАДЕЮСЬ, ЧТО Я.'); }},
 {id:'bridgeday', scene:'bridge', need:180, once:1, day:1, run:function(){
    sayThought('РЕКА НЕ СПРАШИВАЕТ, ЗАЧЕМ Я ИДУ.','МНЕ ЭТО НРАВИТСЯ БОЛЬШЕ ВСЕХ ВОПРОСОВ.'); }},
 {id:'bridgenight', scene:'bridge', need:230, phase:3, cooldown:3000, run:function(){
    const gy=(S.py<=8)?8:9;
    const gx=clamp(S.px+3,3,16);
    spawnGuest('walker',{x:gx,y:gy},900,2,false);
    remember('metWalker',true);
    tone(220,0.5,'triangle',0.03);
    sayThought('КТО-ТО ВСТАЛ РЯДОМ НА МОСТУ.','ОН НЕ ГОВОРИТ. Я ТОЖЕ.','ЭТО БЫЛ ЛУЧШИЙ РАЗГОВОР ЗА ВСЮ ДОРОГУ.'); }},
 {id:'rainwell', scene:'rain', need:170, once:1, near:{x:12,y:7,r:3}, run:function(){
    S.fx={type:'ripple',t:0,ttl:90,x:13*TS,y:7*TS};
    sayThought('КОЛОДЕЦ РЕЙНА СЛУШАЕТ.','ОН ПОМНИТ БОЛЬШЕ, ЧЕМ ДЕВОЧКА РЯДОМ С НИМ.'); }},
 {id:'tower', scene:'rain', need:200, once:1, near:{x:10,y:5,r:3}, run:function(){
    sayThought('БАШНЯ СМОТРИТ СВЕРХУ.','ЕЙ ВСЁ РАВНО, ПРИДУ ЛИ Я. ПОЭТОМУ Я ПРИДУ.'); }}
];
function freeSpotNear(dist){
  for(let d=dist;d<=dist+2;d++){
    const c=[[d,0],[-d,0],[0,d],[0,-d],[d-1,1],[-(d-1),1],[d-1,-1]];
    for(let i=0;i<c.length;i++){
      const x=S.px+c[i][0], y=S.py+c[i][1];
      if(x>0&&y>0&&!solidAt(x,y)) return {x:x,y:y};
    }
  }
  return null;
}
function spawnGuest(spr,spot,ttl,dir,big){
  S.guest={spr:spr,x:spot.x,y:spot.y,dir:dir||0,t:0,ttl:ttl||600,big:!!big};
  SFX.hush();
}
function maybeFriendVisit(to){
  const sc=SCENES[to];
  if(!sc||!sc.enc) return;
  const pool=[];
  for(let i=0;i<sc.enc.pool.length;i++){
    const k=sc.enc.pool[i];
    if(isFriend(k)&&pool.indexOf(k)<0) pool.push(k);
  }
  if(!pool.length) return;
  if(Math.random()<0.4){
    const k=pick(pool), sp=freeSpotNear(4);
    if(sp){ spawnGuest(ENEMIES[k].spr,sp,620,0,true); toast(ENEMIES[k].name+' ПОМНИТ ТЕБЯ'); }
  }
}
function updGuest(){
  const gs=S.guest; if(!gs) return;
  gs.t++;
  if(gs.t>=gs.ttl){
    const was=gs.spr, wasBig=gs.big; S.guest=null;
    if(was==='walker'&&!wasBig){
      jot('НА МОСТУ РЯДОМ ВСТАЛ КТО-ТО. МЫ ПОСТОЯЛИ И РАЗОШЛИСЬ. ЭТО БЫЛ САМЫЙ ДОЛГИЙ РАЗГОВОР ЗА ДОРОГУ.');
      sayThought('ОН УШЁЛ. Я НЕ ВИДЕЛА КАК.','ТАК БЫВАЕТ. ТАК, НАВЕРНОЕ, И НАДО.');
    } else if(wasBig){
      sayThought('ОН УШЁЛ. ПРИХОДИЛ ПРОСТО ПОСТОЯТЬ РЯДОМ.','ТАК ДЕЛАЮТ ТОЛЬКО ДРУЗЬЯ.');
    } else { sayThought('ОН УШЁЛ. Я ДАЖЕ НЕ ПОПРОЩАЛАСЬ.','МОЖЕТ, ЕЩЁ ВСТРЕТИМСЯ. МОЖЕТ, НЕТ.'); }
  }
}
function updStill(){
  if(S.fade.on||S.guest) return;
  if(S.mv||dirHeld()>=0){ S.still=0; return; }
  S.still++;
  for(let i=0;i<STILL.length;i++){
    const r=STILL[i];
    if(r.scene!==S.scene||S.still<r.need) continue;
    if(r.once && S.flags['still_'+r.id]) continue;
    if(r.phase!==undefined && PH!==r.phase) continue;
    if(r.day && PH>=2) continue;
    if(r.tile && tileAt(S.px,S.py)!==r.tile) continue;
    if(r.near){ const dx=S.px-r.near.x, dy=S.py-r.near.y; if(dx*dx+dy*dy>r.near.r*r.near.r) continue; }
    if(r.cooldown){ const last=S.cd[r.id]; if(last!==undefined && S.tick-last<r.cooldown) continue; S.cd[r.id]=S.tick; }
    S.flags['still_'+r.id]=1; S.still=0; r.run(); return;
  }
  if(S.still>0 && S.still%700===0){
    const t=IDLE_THOUGHTS[S.idleN%IDLE_THOUGHTS.length];
    S.idleN++; sayThought(t); S.still=0;
  }
}
function updFx(){ if(S.fx){ S.fx.t++; if(S.fx.t>S.fx.ttl) S.fx=null; } }
function drawFx(cam){
  const f=S.fx; if(!f) return;
  const P=pal(), k=f.t/f.ttl;
  if(f.type==='grass'){
    G.fillStyle=P[0];
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4, r=4+k*15;
      G.fillRect(Math.round(f.x+Math.cos(a)*r-cam.x),Math.round(f.y+Math.sin(a)*r*0.5-cam.y),1,1);
    }
  } else if(f.type==='ripple'){
    for(let ring=0;ring<3;ring++){
      const r=Math.round(k*20-ring*5);
      if(r<=0) continue;
      G.fillStyle=(ring%2)?P[1]:P[0];
      const x=f.x-cam.x, y=f.y-cam.y;
      G.fillRect(x-r,y,r*2+1,1); G.fillRect(x-r,y+r,r*2+1,1);
      G.fillRect(x-r,y,1,r+1); G.fillRect(x+r,y,1,r+1);
    }
  } else if(f.type==='dim'){
    G.fillStyle='rgba(8,10,20,'+(0.5*Math.sin(Math.PI*k)).toFixed(3)+')';
    G.fillRect(0,0,W,H);
  }
}
function drawGlitch(){
  if(!MEM.sawCorrupt) return;
  if(S.glitchT<=0){ if(Math.random()<0.0022) S.glitchT=rnd(3,7); return; }
  S.glitchT--;
  for(let i=0;i<3;i++){
    const y=rnd(0,H-8), h=rnd(2,6), sh=rnd(-6,6);
    try{ G.drawImage(CV,0,y,W,h,sh,y,W,h); }catch(e){}
  }
  G.fillStyle='#ffffff';
  for(let i=0;i<24;i++) G.fillRect(rnd(0,W-1),rnd(0,H-1),1,1);
}
