"use strict";
/* ---------- 22. ТИТУЛ / NEW GAME / ДОКУМЕНТАЦИЯ ---------- */
function drawTitleBG(){
  const P=pal();
  for(let y=0;y<92;y++){ G.fillStyle = y<28?P[0]:(y<48?P[1]:(y<70?P[2]:P[3])); G.fillRect(0,y,W,1); }
  G.fillStyle=P[2];
  for(let x=0;x<W;x++){ const h=18+Math.round(9*Math.sin(x/17)+5*Math.sin(x/7)); G.fillRect(x,84-h,1,h); }
  G.fillStyle=P[3];
  for(let x=0;x<W;x++){ const h=10+Math.round(6*Math.sin(x/23+2)); G.fillRect(x,88-h,1,h); }
  G.fillStyle=P[1]; G.fillRect(0,92,W,H-92);
  for(let y=92;y<H;y++){
    const k=(y-92)/(H-92), hw=4+k*46;
    G.fillStyle=((y%6)<3)?P[0]:P[1];
    G.fillRect(Math.floor(80-hw),y,Math.floor(hw*2),1);
  }
  G.fillStyle=P[2];
  for(let y=92;y<H;y+=8){
    const k=(y-92)/(H-92), hw=4+k*46;
    G.fillRect(Math.floor(80-hw),y,1,4); G.fillRect(Math.floor(80+hw),y,1,4);
  }
  G.drawImage(charImg('traveler',1,(S.tick>>5)%2,PH,false),72,74);
  for(let i=0;i<4;i++){
    G.drawImage(tileImg('T',PH,0,'T'),6+i*3,86+i*3,12,12);
    G.drawImage(tileImg('T',PH,0,'T'),142-i*3,88+i*4,12,12);
  }
}
const TITLE_N=4;
function titleHello(){
  if(MEM.closedOnError) return 'ТЫ ЗАКРЫЛА МЕНЯ НА ЧЁРНОМ ЭКРАНЕ. Я НЕ ОБИДЕЛАСЬ.';
  if(MEM.endings>0) return 'ТЫ УЖЕ ДОШЛА ДО БАШНИ. ДОРОГА ВСЁ ЕЩЁ ЗДЕСЬ.';
  if(MEM.sawCorrupt) return 'ТЫ СНОВА ЗДЕСЬ. Я ПОМНЮ, КАК СЛОМАЛОСЬ.';
  if(MEM.friends>0) return 'ТЕ, КТО В ТРАВЕ, ТЕБЯ ПОМНЯТ. И Я ПОМНЮ.';
  if(MEM.visits>1) return 'ТЫ ВЕРНУЛАСЬ. Я НИКУДА НЕ УХОДИЛА.';
  return 'МИР ЖДЁТ. ТАЙМЕРА НЕТ.';
}
function drawTitle(){
  drawTitleBG();
  const P=pal();
  const t='STILL ROAD';
  const gw=t.length*10-2, ox=80-Math.floor(gw/2);
  for(let i=0;i<t.length;i++){
    const gl=FONT[t[i]]||FONT['?'];
    for(let r=0;r<6;r++) for(let c=0;c<4;c++) if(gl[r]&(8>>c)){
      G.fillStyle=P[3]; G.fillRect(ox+i*10+c*2+2,20+r*2+2,2,2);
      G.fillStyle=P[0]; G.fillRect(ox+i*10+c*2,20+r*2,2,2);
    }
  }
  tx(G,'СТИЛЛ РОАД - ФАН-ПЕРЕВОД',10,38,P[3]);
  boxThought(4,46,152,26);
  const hel=wrap(titleHello(),29);
  for(let i=0;i<hel.length&&i<2;i++) tx(G,hel[i],10,53+i*9,P[0]);
  box(12,94,136,48);
  const d=readSave();
  const labels=['НОВАЯ ИГРА', d?'ПРОДОЛЖИТЬ':'ПРОДОЛЖИТЬ (НЕТ)', 'ЗВУК: '+(MUTED?'ВЫКЛ':'ВКЛ'), 'ДОКУМЕНТАЦИЯ'];
  for(let i=0;i<labels.length;i++){
    const sel=(i===S.titleI);
    tx(G,labels[i],30,100+i*9, sel?P[3]:P[2]);
    if(sel && ((S.tick>>3)%2===0)) arrow(22,101+i*9);
  }
  if(MEM.visits>1) tx(G,'ИГРА ПОМНИТ: ВИЗИТОВ '+MEM.visits,30,135,P[2]);
  else tx(G,'НАЖМИ ЛЮБУЮ КЛАВИШУ - ЗВУК',30,135,P[2]);
}
function updTitle(){
  if(hit('up')){ S.titleI=(S.titleI+TITLE_N-1)%TITLE_N; SFX.blip(); }
  if(hit('down')){ S.titleI=(S.titleI+1)%TITLE_N; SFX.blip(); }
  if(A()){
    SFX.ok();
    if(S.titleI===0){ S.mode='intro'; S.introT=0; }
    else if(S.titleI===1){ const d=readSave(); if(d) applySave(d); else SFX.no(); }
    else if(S.titleI===2){ MUTED=!MUTED; toast('ЗВУК: '+(MUTED?'ВЫКЛ':'ВКЛ')); }
    else { S.mode='docs'; S.docsI=0; }
  }
}
function newGame(){
  const st=SCENES.town1.start;
  S.scene='town1'; S.px=st.x; S.py=st.y; S.dir=st.dir; S.ox=0; S.oy=0; S.mv=null;
  S.hp=32; S.hpMax=32; S.lv=22; S.exp=0; S.gold=30;
  S.items=['letter']; S.flags={}; S.steps=0;
  S.journal=[]; S.jI=0; S.frI=0; S.helpI=0; S.still=0; S.idleN=0; S.cd={};
  S.guest=null; S.fx=null; S.glitchT=0;
  jot('Я НЕ ПОМНЮ, ОТКУДА ВЫШЛА. ЭТО НЕ СТРАШНО. СТРАШНО - НЕКУДА ИДТИ. У МЕНЯ ЕСТЬ КУДА.',true);
  jot('В СУМКЕ ПИСЬМО. АДРЕСА НЕТ. НО ОНО ТЯНЕТ ВПЕРЁД, КАК БУДТО ЗНАЕТ ДОРОГУ.',true);
  PH=1; S.banner=140; S.bannerTxt='ПЕРВЫЙ ГОРОД'; S.mode='world';
  sceneThought('town1');
}
function drawIntro(){
  const P=pal();
  for(let y=0;y<H;y++){ G.fillStyle= y<70?(((y%6)<3)?P[0]:P[1]):(((y%8)<4)?P[1]:P[2]); G.fillRect(0,y,W,1); }
  G.fillStyle=P[2];
  for(let x=0;x<W;x++){ const h=10+Math.round(6*Math.sin(x/13)); G.fillRect(x,70-h,1,h); }
  for(let y=70;y<H;y++){
    const k=(y-70)/(H-70), hw=6+k*50;
    G.fillStyle=((y%6)<3)?P[0]:P[1];
    G.fillRect(Math.floor(80-hw),y,Math.floor(hw*2),1);
  }
  G.drawImage(charImg('traveler',1,0,PH,false),72,54);
  tx(G,'NEW GAME',54,10,P[3]);
  boxThought(6,96,148,42);
  tx(G,'ПУТНИЦА СТОИТ В НАЧАЛЕ ДОРОГИ.',12,102,P[0]);
  tx(G,'ОНА ЖДЁТ.',12,112,P[0]);
  if((S.tick>>4)%2===0) tx(G,'ОНА МОЖЕТ ЖДАТЬ ВЕЧНО.  Z',12,126,P[2]);
}
function updIntro(){ S.introT++; if(A()&&S.introT>20){ SFX.ok(); fade(newGame); } }
const DOCS=[
 ['ДОКУМЕНТАЦИЯ / GB STUDIO','ЭТО ВЕБ-ЭКСПОРТ MVP.','ДЛЯ СБОРКИ В GB STUDIO 4.0:','1. ПРОЕКТ: GB COLOR, 160X144.','2. ПАЛИТРА: 4 ЦВЕТА НА ФАЗУ.','3. ТАЙЛЫ 8X8, СПРАЙТЫ 16X16.','4. ВСЕ АССЕТЫ - PNG.'],
 ['СЦЕНЫ (ТЗ 7.1)','TOWN1 20X18 - ПЕРВЫЙ ГОРОД','FIELD 40X18 - ПОЛЕ (2 ЭКР.)','FOREST 20X26 - ЛЕС','CAVE 20X18 - ПЕЩЕРА','BRIDGE 20X18 - МОСТ','RAIN 20X18 - РЕЙН','+ TITLE/INTRO/SAVE/ERROR','+ JOURNAL, HELP, FRIENDS'],
 ['АКТЁРЫ (ТЗ 7.2)','PLAYER - ПУТНИЦА, 4X2 КАДРА','MERCHANT - ЗА ПРИЛАВКОМ','GIRL - У КОЛОДЦА, RAIN','OLDMAN - НА МОСТУ','BARMAN, DOG - TOWN1','GUEST - СТРАННИК И ДРУЗЬЯ','ВРАГИ: СЛИЗЕНЬ, ВОЛК,','ТЕНЬ, СТРАННИК'],
 ['ТРИГГЕРЫ (ТЗ 7.3)','INTERACT: NPC, ДВЕРЬ,','ВЫВЕСКА, КОЛОДЕЦ, АЛТАРЬ,','ДВЕРЬ БАШНИ, КАМЕНЬ.','COLLISION: 8 ПЕРЕХОДОВ.','STEP ON: X (КЛЮЧ), Y (ПИКС.)','IDLE 2-4 СЕК -> ТИХОЕ СОБЫТИЕ','ENCOUNTER: ПОЛЕ 7, ЛЕС 9,','ПЕЩЕРА 12 ПРОЦЕНТОВ.'],
 ['ПЕРЕМЕННЫЕ (ТЗ 7.4)','TOD 0..3 - ВРЕМЯ СУТОК','LV, EXP, HP, GOLD','FLAGS: KEY, CANDLE,','CANDLELIT, PIXEL, TOWER,','CORRUPTED, STILL_*, FRIENDS','STILL - КАДРЫ НЕПОДВИЖНОСТИ','SAVCOUNT - ДЛЯ ОШИБКИ СЕЙВА','ОПЫТ: 22 -> 23 = 40.'],
 ['ПАМЯТЬ И МУЗЫКА','MEM - ОТДЕЛЬНО ОТ СЛОТА:','VISITS, SAWCORRUPT, ENDINGS,','METWALKER, RETURNEDPIXEL,','FORGOTTEXT, FRIENDS.','МУЗЫКА: 11 ПРОЦЕДУРНЫХ ТРЕКОВ','(ПО СЦЕНЕ + ФАЗЕ СУТОК).','ДНЕВНИК ПИШЕТСЯ САМ (JOT).','ЗАПИСЬ ЗАРАСТАЕТ ШУМОМ.'],
 ['СКРИПТЫ СОБЫТИЙ','ДЕВОЧКА: TOD>=2 -> ДРУГАЯ','РЕПЛИКА. PIXEL -> КВЕСТ.','MEM.RETURNEDPIXEL -> ОНА','ПОМНИТ ПРОШЛУЮ ДОРОГУ.','ПЕЩЕРА: CANDLE -> ТАЙЛ 10,3.','РЕЙН: KEY -> ДВЕРЬ БАШНИ.','БОЙ: ПОГОВОРИТЬ -> RAND,','ФЛАГ FRIENDS.X ИЛИ ХОД ВРАГА.'],
 ['ПРИНЦИПЫ (ТЗ 4, 10)','НЕТ ТАЙМЕРА. НЕТ СЧЁТЧИКА.','НЕТ ПРОИГРЫША: ПОРАЖЕНИЕ ->','ПРОБУЖДЕНИЕ В ГОРОДЕ,','БЕЗ ШТРАФА.','ЕДИНСТВЕННЫЙ ГЛАГОЛ -','ВНИМАНИЕ.','ВРАГА МОЖНО НЕ БИТЬ,','А ПОГОВОРИТЬ С НИМ.']
];
function drawDocs(){
  const P=pal();
  G.fillStyle=P[3]; G.fillRect(0,0,W,H);
  boxThought(2,2,156,124);
  const pg=DOCS[S.docsI];
  for(let i=0;i<pg.length;i++) tx(G,pg[i],8,8+i*12, i===0?P[0]:P[1]);
  box(2,128,156,14);
  tx(G,'СТР. '+(S.docsI+1)+'/'+DOCS.length+'  Z-ДАЛЕЕ X-НАЗАД',8,132,P[3]);
}
function updDocs(){
  if(A()||hit('right')||hit('down')){ S.docsI=(S.docsI+1)%DOCS.length; SFX.blip(); }
  else if(B()||hit('left')||hit('up')){
    S.docsI--;
    if(S.docsI<0){ S.docsI=0; S.mode='title'; SFX.no(); } else SFX.blip();
  }
}
