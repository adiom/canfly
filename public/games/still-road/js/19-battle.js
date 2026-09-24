"use strict";
/* ---------- 19. БОЙ И ДРУЖБА ---------- */
const ENEMIES={
  slime :{name:'СЛИЗЕНЬ',        hp:12, atk:[2,4], spr:'slime',  line:'СЛИЗЕНЬ ВЫШЕЛ ИЗ ТРАВЫ. ОН НЕ ЗОЛ. ПРОСТО СТОИТ.'},
  wolf  :{name:'ЛЕСНОЙ ВОЛК',    hp:22, atk:[4,6], spr:'wolf',   line:'ВОЛК ВЫШЕЛ ИЗ ТРАВЫ. ОН ТОЖЕ НЕ ХОТЕЛ ДРАТЬСЯ.'},
  shadow:{name:'ПЕЩЕРНАЯ ТЕНЬ',  hp:30, atk:[5,8], spr:'shadow', line:'ТЕНЬ ОТДЕЛИЛАСЬ ОТ СТЕНЫ. У НЕЁ НЕТ ПРИЧИН.'},
  walker:{name:'ТИХИЙ СТРАННИК', hp:44, atk:[0,0], spr:'walker', line:'ТИХИЙ СТРАННИК СМОТРИТ НА ТЕБЯ. ОН НЕ АТАКУЕТ.'}
};
const TALK_CHANCE={slime:0.55,wolf:0.38,shadow:0.25,walker:0.9};
const FRIEND_LINE={
  slime:['СЛИЗЕНЬ ПОКАЗАЛ, КАК ОН ДЫШИТ. ЭТО БЫЛО ДОЛГО И СПОКОЙНО.','СЛИЗЕНЬ НЕ ГОВОРИТ. НО ОН СОГЛАСЕН.'],
  wolf:['ВОЛК ПОНЮХАЛ РУКУ И СЕЛ. ЭТО ЗНАЧИТ - МОЖНО.','ВОЛК УШЁЛ В ТРАВУ. ОН ЗАПОМНИЛ ТВОЙ ЗАПАХ.'],
  shadow:['ТЕНЬ ПОВТОРИЛА ТВОЁ ДВИЖЕНИЕ. ЭТО ПОХОЖЕ НА ПРИВЕТ.','ТЕНЬ СТАЛА МЕНЬШЕ. ОНА БОЛЬШЕ НЕ ХОЧЕТ БЫТЬ СТРАШНОЙ.'],
  walker:['СТРАННИК КИВНУЛ. ОН ЖДАЛ ИМЕННО ЭТОГО.','ВЫ ПОСТОЯЛИ РЯДОМ. БОЛЬШЕ НИЧЕГО НЕ НУЖНО.']
};
const FRIEND_MEET={
  slime:'СЛИЗЕНЬ ВЫШЕЛ ИЗ ТРАВЫ. ОН ТЕБЯ ПОМНИТ. БОЯ НЕ БУДЕТ.',
  wolf:'ВОЛК ВЫШЕЛ ИЗ ТРАВЫ. ОН ЗАПОМНИЛ ТВОЙ ЗАПАХ. БОЯ НЕ БУДЕТ.',
  shadow:'ТЕНЬ ОТДЕЛИЛАСЬ ОТ СТЕНЫ И ПОМАХАЛА. БОЯ НЕ БУДЕТ.',
  walker:'ТИХИЙ СТРАННИК СНОВА ЗДЕСЬ. ОН РАД. ОН НЕ УМЕЕТ ИНАЧЕ.'
};
const FAIL_TALK=['ТЫ СКАЗАЛА ЧТО-ТО НЕ ТО. ПЕРЕВОДЧИК ВИНОВАТ.','ОН НЕ ПОНЯЛ. ТЫ ПОПРОБУЕШЬ ПОЗЖЕ. ИЛИ НЕТ.','СЛОВА УШЛИ В ТРАВУ. ОТВЕТА НЕ БЫЛО.'];
const FRIEND_INFO={
  slime:{name:'СЛИЗЕНЬ',         note:'ОН НЕ ЗОЛ. ОН ПРОСТО СТОИТ. ТЕПЕРЬ - РЯДОМ С ТОБОЙ.'},
  wolf:{name:'ЛЕСНОЙ ВОЛК',     note:'ОН ЗАПОМНИЛ ТВОЙ ЗАПАХ. ЭТО КРЕПЧЕ, ЧЕМ ИМЯ.'},
  shadow:{name:'ПЕЩЕРНАЯ ТЕНЬ', note:'ОНА СТАЛА МЕНЬШЕ И ПЕРЕСТАЛА ПРЯТАТЬСЯ ПО СТЕНАМ.'},
  walker:{name:'ТИХИЙ СТРАННИК',note:'ВЫ ПРОСТО ПОСТОЯЛИ РЯДОМ. ЭТОГО ДОСТАТОЧНО.'}
};
function isFriend(k){ return !!(S.flags.friends && S.flags.friends[k]); }
function friendCount(){ let n=0; for(const k in FRIEND_INFO) if(isFriend(k)) n++; return n; }
function expNeed(lv){ return lv===22?40:40+(lv-22)*80; }
function startBattle(kind,friendly){
  const e=ENEMIES[kind]||ENEMIES.slime;
  S.mode='battle'; S.still=0; SFX.meet();
  S.bt={e:Object.assign({kind:kind,max:e.hp},e),phase:'intro',cur:0,msg:null,ch:0,next:null,
        flash:0,shake:0,turn:0,seenFlash:0,t:0,hits:0,friendly:!!friendly};
  if(friendly) btSay(FRIEND_MEET[kind]||FRIEND_MEET.slime, btMenu);
  else btSay(e.line, btMenu);
}
function btOpts(b){ return b.friendly? ['ПОСТОЯТЬ РЯДОМ','ПОГОВОРИТЬ','УЙТИ'] : ['АТАКА','АТАКА','ПОГОВОРИТЬ','ЛЕЧИТЬ']; }
function btSay(text,next){ const b=S.bt; b.msg=String(text); b.ch=0; b.next=next||null; b.phase='msg'; }
function btMenu(){ const b=S.bt; b.phase='menu'; b.cur=0; }
function btUpd(){
  const b=S.bt; if(!b) return;
  b.t++;
  if(b.flash>0) b.flash--;
  if(b.shake>0) b.shake--;
  if(b.seenFlash>0) b.seenFlash--;
  if(b.phase==='msg'){
    if(b.ch<b.msg.length){
      if(S.holdA>10) b.ch=b.msg.length;
      else { b.ch+=2; if(b.ch%3===0) SFX.blip(); }
    }
    if(A()){
      if(b.ch<b.msg.length){ b.ch=b.msg.length; return; }
      const n=b.next; b.next=null; b.msg=null;
      if(n) n(); else btMenu();
    }
    return;
  }
  if(b.phase==='menu'){
    const n=btOpts(b).length;
    if(hit('up')){ b.cur=(b.cur+n-1)%n; SFX.blip(); }
    if(hit('down')){ b.cur=(b.cur+1)%n; SFX.blip(); }
    if(A()){
      SFX.ok();
      if(b.friendly){
        if(b.cur===0){ S.exp+=5; btSay('ВЫ ПОСТОЯЛИ РЯДОМ. МИР ПРОДОЛЖИЛСЯ. +5 ОПЫТА.',btPeaceEnd); }
        else if(b.cur===1){ S.exp+=5; btSay(pick(FRIEND_LINE[b.e.kind]||FRIEND_LINE.slime)+' +5 ОПЫТА.',btPeaceEnd); }
        else btSay('ТЫ УШЛА. ОН НЕ ОБИДЕЛСЯ. ОН УМЕЕТ ЖДАТЬ.',btPeaceEnd);
      } else {
        if(b.cur===0) playerHit(1);
        else if(b.cur===1) playerHit(2);
        else if(b.cur===2) playerTalk();
        else playerHeal();
      }
    }
  }
}
function playerHit(variant){
  const b=S.bt, e=b.e;
  if(variant===2 && Math.random()<0.3){ btSay('ТЫ ПРОМАХНУЛАСЬ. ЭТО ТОЖЕ ЧАСТЬ ПУТИ.',afterPlayer); return; }
  const base = variant===2? rnd(7,12) : rnd(5,8);
  const dmg = base + Math.max(0,S.lv-22);
  e.hp=Math.max(0,e.hp-dmg); b.flash=10; b.shake=8; b.hits++; SFX.hit();
  btSay(variant===1
      ? 'ТЫ УДАРИЛА. '+e.name+' ПОТЕРЯЛ '+dmg+' HP.'
      : 'ТЫ УДАРИЛА СНОВА. ЭТО ТА ЖЕ АТАКА. ПЕРЕВОДЧИК ИЗВИНЯЕТСЯ. -'+dmg+' HP.',
    function(){ if(e.hp<=0) btWin(); else afterPlayer(); });
}
function playerTalk(){
  const b=S.bt, e=b.e;
  let ch = (TALK_CHANCE[e.kind]!==undefined)? TALK_CHANCE[e.kind] : 0.3;
  if(b.turn===0) ch+=0.2;
  if(b.hits>0)  ch-=0.25;
  if(PH===3)    ch+=0.1;
  if(Math.random()<ch){ befriend(e); return; }
  btSay(pick(FAIL_TALK), afterPlayer);
}
function befriend(e){
  S.flags.friends=S.flags.friends||{};
  S.flags.friends[e.kind]=true;
  MEM.friends=(MEM.friends||0)+1; saveMem();
  S.exp+=20; SFX.friend();
  jot('Я ПОГОВОРИЛА, И ОН СОГЛАСИЛСЯ: '+e.name+'. ОН НЕ СТАЛ ОПЫТОМ. ОН СТАЛ ЗНАКОМЫМ.');
  const p=[pick(FRIEND_LINE[e.kind]||FRIEND_LINE.slime),
           'ТЫ НИКОГО НЕ ПОБЕДИЛА. ЭТО ТОЖЕ ПРОГРЕСС. +20 ОПЫТА.',
           'ОН ТЕПЕРЬ ЗНАЕТ ТЕБЯ. ИНОГДА ОН БУДЕТ ПРИХОДИТЬ ПРОСТО ПОСТОЯТЬ РЯДОМ.'];
  const need=expNeed(S.lv);
  if(S.exp>=need){ S.exp-=need; S.lv++; p.push('УРОВЕНЬ ПОВЫШЕН: '+(S.lv-1)+' -> '+S.lv+'. БЕЗ ЕДИНОГО УДАРА.'); }
  let i=0;
  const step=function(){ if(i>=p.length){ endBattle(); return; } btSay(p[i++],step); };
  step();
}
function playerHeal(){
  const h=Math.min(14,S.hpMax-S.hp); S.hp+=h; SFX.heal();
  btSay('ТЫ ОТДОХНУЛА ПРЯМО В БОЮ. +'+h+' HP. ЭТО НЕЧЕСТНО, НО РАБОТАЕТ.',afterPlayer);
}
function afterPlayer(){
  const b=S.bt, e=b.e; b.turn++;
  if(b.friendly){ btMenu(); return; }
  if(e.kind==='walker'){
    if(b.turn>=3){ btSay('ОН УШЁЛ. БОЙ ЗАКОНЧИЛСЯ САМ. НИКТО НЕ ПОСТРАДАЛ.',btWin); return; }
    btSay('ОН НЕ АТАКУЕТ. ОН ПРОСТО СМОТРИТ. ЭТО ХУЖЕ.',btMenu);
    return;
  }
  const dmg=rnd(e.atk[0],e.atk[1]); S.hp=Math.max(0,S.hp-dmg); SFX.hit(); b.seenFlash=8;
  btSay(e.name+' ДУМАЕТ. И УДАРАЕТ ТЕБЯ. -'+dmg+' HP.',function(){ if(S.hp<=0) btLose(); else btMenu(); });
}
function btWin(){
  S.exp+=40; S.gold+=8; SFX.win();
  const pages=['ПОБЕДА. +40 ОПЫТА. И 8 МОНЕТ.','МИР ПРОДОЛЖАЕТСЯ. НИЧЕГО ЭПИЧЕСКОГО НЕ БУДЕТ.'];
  const need=expNeed(S.lv);
  if(S.exp>=need){ S.exp-=need; S.lv++; pages.push('УРОВЕНЬ ПОВЫШЕН: '+(S.lv-1)+' -> '+S.lv+'. НИЧЕГО НЕ ИЗМЕНИЛОСЬ. НО ПРИЯТНО.'); }
  let i=0;
  const step=function(){ if(i>=pages.length){ endBattle(); return; } btSay(pages[i++],step); };
  step();
}
function btPeaceEnd(){
  const need=expNeed(S.lv);
  if(S.exp>=need){
    S.exp-=need; S.lv++; SFX.win();
    btSay('УРОВЕНЬ ПОВЫШЕН: '+(S.lv-1)+' -> '+S.lv+'. НИКТО НЕ ПОСТРАДАЛ.',endBattle);
  } else endBattle();
}
function endBattle(){ fade(function(){ S.bt=null; S.mode='world'; }); }
function btLose(){
  SFX.no();
  btSay('ТЫ УПАЛА.',function(){
    btSay('СМЕРТИ НЕТ. ШТРАФА ТОЖЕ НЕТ.',function(){
      btSay('ТЫ ОЧНУЛАСЬ В ГОРОДЕ. ДОРОГА ПРОСТО ПОДОЖДАЛА.',function(){
        fade(function(){
          S.bt=null;
          const sc=SCENES[S.scene], st=SCENES[sc.respawn].start;
          S.scene=sc.respawn; S.px=st.x; S.py=st.y; S.dir=st.dir;
          S.ox=0; S.oy=0; S.mv=null; S.hp=S.hpMax; S.still=0; S.guest=null;
          S.mode='world'; S.banner=120; S.bannerTxt=SCENES[S.scene].name;
        });
      });
    });
  });
}
function drawBattle(){
  const b=S.bt; if(!b) return;
  const P=pal(), e=b.e;
  for(let y=0;y<H;y++){
    G.fillStyle = y<70 ? (y<20?P[0]:P[1]) : (y<72?P[3]:((y%4<2)?P[2]:P[1]));
    G.fillRect(0,y,W,1);
  }
  if(S.scene==='cave'){
    G.fillStyle=P[3]; G.fillRect(0,0,W,72);
    for(let i=0;i<40;i++){ G.fillStyle=P[2]; G.fillRect((i*37)%W,(i*23)%70,2,1); }
  }
  const img=enemyImg(e.spr,(S.tick>>4)%2,PH);
  const ex=Math.floor(W/2-24)+((b.shake>0)?rnd(-2,2):0), ey=20+(((S.tick>>4)%2)?1:0);
  G.drawImage(img,ex,ey,48,48);
  if(b.flash>0 && (b.flash%4<2)){ G.fillStyle=P[0]; G.globalAlpha=0.7; G.fillRect(ex,ey,48,48); G.globalAlpha=1; }
  if(b.seenFlash>0 && (b.seenFlash%4<2)){ G.fillStyle=P[3]; G.globalAlpha=0.55; G.fillRect(0,0,W,H); G.globalAlpha=1; }
  if(b.friendly && (S.tick>>4)%2===0){ G.fillStyle=P[1]; G.fillRect(ex+22,ey-6,2,2); G.fillRect(ex+18,ey-3,10,1); }
  box(2,2,74,26); tx(G,'LV '+S.lv,7,8,P[3]); tx(G,'HP '+S.hp+'/'+S.hpMax,7,17,P[3]);
  box(84,2,74,26); tx(G,e.name,89,8,P[3]);
  G.fillStyle=P[3]; G.fillRect(89,18,60,4);
  G.fillStyle=P[0]; G.fillRect(90,19,Math.max(0,Math.round(58*e.hp/e.max)),2);
  box(0,94,160,50);
  if(b.phase==='menu'){
    const opts=btOpts(b);
    tx(G, b.friendly?'ОН НЕ ВРАГ.':'ЧТО ДЕЛАТЬ?',6,100,P[3]);
    for(let i=0;i<opts.length;i++){
      const y=109+i*8;
      tx(G,opts[i],20,y,P[3]);
      if(i===b.cur) arrow(12,y+1);
    }
    if(!b.friendly){
      tx(G,'(ДА, ДВЕ АТАКИ.',100,109,P[2]);
      tx(G,'ПЕРЕВОД ТАКОЙ)',100,118,P[2]);
      tx(G,'МОЖНО ПОГОВОРИТЬ',100,130,P[2]);
    } else tx(G,'ДРУЗЕЙ: '+friendCount(),100,109,P[2]);
  } else if(b.msg){
    const lines=wrap(b.msg,30).slice(0,3);
    let left=b.ch;
    for(let l=0;l<lines.length;l++){
      const sh=lines[l].slice(0,Math.max(0,left)); left-=lines[l].length;
      tx(G,sh,6,101+l*9,P[3]);
    }
    if(b.ch>=b.msg.length && (S.tick>>3)%2===0) arrow(150,134);
  }
}
