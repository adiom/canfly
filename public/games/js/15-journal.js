"use strict";
/* ---------- 15. ДНЕВНИК ДОРОГИ ---------- */
function jot(text,quiet){
  if(S.journal.indexOf(text)>=0) return;
  S.journal.push(text);
  if(!quiet) toast('* ДНЕВНИК *');
}
function glitchLine(n,seed){
  const pool='#*%=X01?/+-';
  let s='';
  for(let i=0;i<n;i++) s+=pool[(Math.floor(S.tick/5)+i*11+(seed||0))%pool.length];
  return s;
}
const SCENE_THOUGHT={
  town1:'Я ВЫШЛА. ДОМ ОСТАЛСЯ СТОЯТЬ. ОН НЕ ОБИДЕЛСЯ.',
  field:'ПОЛЕ. ТРАВА ПО ПОЯС. ЗДЕСЬ ХОРОШО СТОЯТЬ: НИКТО НЕ ПОГОНЯЕТ.',
  forest:'В ЛЕСУ ТРОПА ПУТАЕТСЯ. Я ПУТАЮСЬ ВМЕСТЕ С НЕЙ. МНЕ НЕ СПЕШНО.',
  cave:'В ПЕЩЕРЕ ТЕМНО И ТИХО. ТИШИНА ТУТ СТАРШЕ МЕНЯ.',
  bridge:'МОСТ. ПОД НИМ РЕКА, КОТОРОЙ ВСЁ РАВНО, КУДА Я ИДУ.',
  rain:'РЕЙН. ЧУЖОЙ ГОРОД. ТУТ МЕНЯ НИКТО НЕ ЖДЁТ, И ЭТО ПОЧЕМУ-ТО СПОКОЙНО.',
  home:'МОЙ ДОМ. Я ЗАШЛА И ВЫШЛА. ДВЕРЬ НЕ ОБИДЕЛАСЬ.',
  inn:'ТАВЕРНА ИЗНУТРИ МЕНЬШЕ, ЧЕМ СНАРУЖИ. ТАК БЫВАЕТ СО ВСЕМ.'
};
function sceneThought(id){
  const t=SCENE_THOUGHT[id];
  if(!t||S.flags['seen_'+id]) return;
  S.flags['seen_'+id]=1; jot(t);
}
function forgetSomething(){
  const cand=[];
  for(let i=0;i<S.journal.length;i++){
    const t=S.journal[i];
    if(t!==MEM.forgotText && t.length>12) cand.push(t);
  }
  if(cand.length){ MEM.forgotText=cand[Math.floor(Math.random()*cand.length)]; saveMem(); }
}
function updJournal(){
  const n=S.journal.length;
  if(n && S.jI>=n) S.jI=0;
  if(B()){ SFX.no(); S.mode='menu'; return; }
  if(hit('up')||hit('left')){ if(n){ S.jI=(S.jI+n-1)%n; SFX.blip(); } return; }
  if(hit('down')||hit('right')||A()){
    if(n>1){ S.jI=(S.jI+1)%n; SFX.blip(); } else { SFX.no(); S.mode='menu'; }
    return;
  }
}
function drawJournal(){
  const P=pal();
  G.fillStyle=P[3]; G.fillRect(0,0,W,H);
  boxThought(2,2,156,124);
  tx(G,'ДНЕВНИК ДОРОГИ',8,8,P[0]);
  const n=S.journal.length;
  if(n) tx(G,(S.jI+1)+'/'+n,138,8,P[2]);
  if(!n) tx(G,'ПУСТО. ДОРОГА ЕЩЁ НЕ НАЧАЛАСЬ.',8,30,P[1]);
  else {
    const txt=S.journal[S.jI];
    if(MEM.forgotText && txt===MEM.forgotText) drawForgotten(8,28);
    else { const L=wrap(txt,28); for(let i=0;i<L.length&&i<9;i++) tx(G,L[i],8,28+i*9,P[0]); }
  }
  boxThought(2,128,156,14);
  tx(G,'Z - ДАЛЬШЕ   X - ЗАКРЫТЬ',8,132,P[1]);
}
function drawForgotten(x,y){
  const P=pal();
  for(let l=0;l<3;l++) tx(G,glitchLine(26,l*7),x,y+l*9,(l===1)?'#ffffff':P[2]);
  tx(G,'...ЗАРОСЛО ШУМОМ...',x,y+34,P[1]);
  if((S.tick>>2)%4===0){ G.fillStyle='#ffffff'; G.fillRect(x,y+rnd(0,2)*9-1,rnd(20,110),1); }
}
