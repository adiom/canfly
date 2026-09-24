"use strict";
/* ---------- 20. МЕНЮ / ПРЕДМЕТЫ / ДРУЗЬЯ / СТАТУС / СПРАВКА / SAVE? / ОШИБКА ---------- */
const MENU_ITEMS=['ДНЕВНИК','ПРЕДМЕТЫ','ДРУЗЬЯ','СТАТУС','ВРЕМЯ','СПРАВКА','СОХРАНИТЬ','ЗАКРЫТЬ'];
const MENU_DESC=['ТО, ЧТО Я ЗАПОМНИЛА САМА.','ПИСЬМО, КЛЮЧИ, СВЕЧИ, ПИКСЕЛИ.','ТЕ, КТО НЕ СТАЛ ОПЫТОМ.','УРОВЕНЬ, ОПЫТ, HP, МОНЕТЫ.',
  'УТРО / ДЕНЬ / ВЕЧЕР / НОЧЬ.','ЧТО ЭТО ЗА ИГРА И КАК В НЕЁ ИГРАТЬ.','ОДИН СЛОТ. ИНОГДА ОН ЛОМАЕТСЯ.','ВЕРНУТЬСЯ НА ДОРОГУ.'];
function updMenu(){
  const m=S.menu, n=MENU_ITEMS.length;
  if(hit('up')){ m.i=(m.i+n-1)%n; SFX.blip(); }
  if(hit('down')){ m.i=(m.i+1)%n; SFX.blip(); }
  if(B()){ SFX.no(); S.mode='world'; return; }
  if(A()){
    SFX.ok();
    if(m.i===0){ S.mode='journal'; S.jI=0; }
    else if(m.i===1){ S.mode='items'; S.itm.i=0; }
    else if(m.i===2){ S.mode='friends'; S.frI=0; }
    else if(m.i===3){ S.mode='status'; }
    else if(m.i===4){ setTime(PH+1); }
    else if(m.i===5){ S.mode='help'; S.helpI=0; }
    else if(m.i===6){ S.mode='save'; S.sv.i=0; }
    else { S.mode='world'; }
  }
}
function drawMenu(){
  const m=S.menu, P=pal();
  box(48,4,110,64);
  for(let i=0;i<MENU_ITEMS.length;i++){
    const sel=(i===m.i);
    tx(G,MENU_ITEMS[i],64,9+i*7, sel?P[3]:P[2]);
    if(sel) arrow(56,10+i*7);
  }
  box(2,96,156,46);
  const lines=wrap(MENU_DESC[m.i],30);
  for(let i=0;i<lines.length;i++) tx(G,lines[i],8,104+i*9,P[3]);
  tx(G,'ФАЗА: '+PHASE[PH]+'   X - ЗАКРЫТЬ',8,132,P[2]);
}
function updItems(){
  if(B()){ SFX.no(); S.mode='menu'; return; }
  if(!S.items.length){ if(A()){ SFX.no(); S.mode='menu'; } return; }
  if(S.itm.i>=S.items.length) S.itm.i=0;
  if(hit('up')){ S.itm.i=(S.itm.i+S.items.length-1)%S.items.length; SFX.blip(); }
  if(hit('down')){ S.itm.i=(S.itm.i+1)%S.items.length; SFX.blip(); }
  if(A()) SFX.ok();
}
function drawItems(){
  const P=pal();
  if(S.items.length && S.itm.i>=S.items.length) S.itm.i=0;
  box(2,2,156,64); tx(G,'ПРЕДМЕТЫ',8,8,P[3]);
  if(!S.items.length) tx(G,'ПУСТО. КАК И ДОРОГА ВПЕРЕДИ.',8,22,P[2]);
  for(let i=0;i<S.items.length;i++){
    const it=ITEMS[S.items[i]], sel=(i===S.itm.i);
    tx(G,it.name,16,20+i*11, sel?P[3]:P[2]);
    if(sel) arrow(8,21+i*11);
  }
  box(2,96,156,46);
  const cur=S.items.length?ITEMS[S.items[S.itm.i]]:null;
  const dl=cur?wrap(cur.desc,30):['У ТЕБЯ ПОКА НИЧЕГО НЕТ.','ЭТО ТОЖЕ НОРМАЛЬНО.'];
  for(let i=0;i<dl.length;i++) tx(G,dl[i],8,102+i*9,P[3]);
  tx(G,'МОНЕТ: '+S.gold,8,124,P[2]);
  tx(G,'X - НАЗАД',110,124,P[2]);
}
function updFriends(){
  if(B()){ SFX.no(); S.mode='menu'; return; }
  const n=Object.keys(FRIEND_INFO).length;
  if(hit('up')){ S.frI=(S.frI+n-1)%n; SFX.blip(); }
  if(hit('down')){ S.frI=(S.frI+1)%n; SFX.blip(); }
  if(A()) SFX.ok();
}
function drawFriends(){
  const P=pal(), k=Object.keys(FRIEND_INFO);
  if(S.frI>=k.length) S.frI=0;
  box(2,2,156,64); tx(G,'ДРУЗЬЯ ДОРОГИ',8,8,P[3]);
  for(let i=0;i<k.length;i++){
    const fr=isFriend(k[i]);
    tx(G, fr?FRIEND_INFO[k[i]].name:'???', 16,20+i*11, fr?P[3]:P[2]);
    if(i===S.frI) arrow(8,21+i*11);
    if(fr) tx(G,'*',148,20+i*11,P[3]);
  }
  box(2,96,156,46);
  const fr=isFriend(k[S.frI]);
  const txt= fr? FRIEND_INFO[k[S.frI]].note : 'ВЫ ЕЩЁ НЕ ГОВОРИЛИ. В БОЮ ЕСТЬ КОМАНДА ПОГОВОРИТЬ.';
  const L=wrap(txt,30);
  for(let i=0;i<L.length;i++) tx(G,L[i],8,102+i*9,P[3]);
  tx(G,'ДРУЗЕЙ: '+friendCount()+' ИЗ '+k.length,8,124,P[2]);
  tx(G,'X - НАЗАД',110,124,P[2]);
}
function drawStatus(){
  const P=pal();
  box(14,12,132,120);
  tx(G,'СТАТУС',22,20,P[3]);
  const rows=['УРОВЕНЬ: '+S.lv,'ОПЫТ: '+S.exp+' / '+expNeed(S.lv),'HP: '+S.hp+' / '+S.hpMax,
    'МОНЕТ: '+S.gold,'ВРЕМЯ: '+PHASE[PH],'ШАГОВ: '+S.steps,'ЗАПИСЕЙ: '+S.journal.length,
    'ДРУЗЕЙ: '+friendCount()+' ИЗ '+Object.keys(FRIEND_INFO).length];
  for(let i=0;i<rows.length;i++) tx(G,rows[i],22,34+i*10,P[3]);
  tx(G,'СМЕРТИ НЕТ. ТАЙМЕРА НЕТ.',22,118,P[2]);
  if((S.tick>>4)%2===0) tx(G,'Z - ЗАКРЫТЬ',84,118,P[3]);
}
const HELP=[
 ['СПРАВКА','STILL ROAD - ТИХАЯ JRPG.','ТЫ ИДЁШЬ. МИР НЕ ТОРОПИТ.','НЕТ ТАЙМЕРА. НЕТ СЧЁТЧИКА.','НЕТ ПРОИГРЫША. ВООБЩЕ.','ПРОГРЕСС - ИЛЛЮЗИЯ.','ВНИМАНИЕ - ЕДИНСТВЕННАЯ','ВАЛЮТА ЭТОЙ ИГРЫ.'],
 ['УПРАВЛЕНИЕ','СТРЕЛКИ / WASD - ИДТИ.','Z / ENTER - ГОВОРИТЬ,','СМОТРЕТЬ, ВЫБИРАТЬ.','X / SHIFT - МЕНЮ И ОТМЕНA.','T - ВРЕМЯ СУТОК.','M - МУЗЫКА И ЗВУК.','УДЕРЖИВАЙ Z - ТЕКСТ СРАЗУ.'],
 ['МУЗЫКА','У КАЖДОГО МЕСТА СВОЙ ТРЕК.','НОЧЬЮ ВСЁ ЗВУЧИТ НИЖЕ','И РЕЖЕ: МИР УСТАЁТ.','УТРОМ - СВЕТЛЕЕ.','ВКЛЮЧАЕТСЯ ПОСЛЕ ПЕРВОЙ','НАЖАТОЙ КЛАВИШИ.'],
 ['ТИХИЕ СОБЫТИЯ','СТОЙ НА МЕСТЕ 2-4 СЕКУНДЫ.','МИР ОТВЕТИТ САМ.','ПОЛЕ: ТРАВА РАССТУПИТСЯ','И ПОДСКАЖЕТ, ГДЕ КАМЕНЬ.','ЛЕС: КТО-ТО СЯДЕТ И СМОТРИТ.','МОСТ НОЧЬЮ: РЯДОМ ВСТАНЕТ','ТИХИЙ СТРАННИК.','ТОЧКА НАД НЕЙ - ОНА СТОИТ.'],
 ['ДНЕВНИК И МЫСЛИ','МЫСЛИ ПИШУТСЯ САМИ.','ОКНО МЫСЛЕЙ - ТЁМНОЕ.','МЕНЮ -> ДНЕВНИК: ЧИТАТЬ.','ИНОГДА ЗАПИСЬ ЗАРАСТАЕТ','ШУМОМ. ЭТО НЕ ОШИБКА.','ЭТО ПАМЯТЬ ИГРЫ.'],
 ['ДРУЗЬЯ','В БОЮ ЕСТЬ КОМАНДА','ПОГОВОРИТЬ.','СЛИЗЕНЬ СОГЛАШАЕТСЯ ЧАЩЕ,','ТЕНЬ - РЕЖЕ.','УДАРИЛА ПЕРВОЙ - ШАНС МЕНЬШЕ.','НОЧЬЮ ГОВОРИТЬ ЛЕГЧЕ.','ДРУЗЬЯ НЕ НАПАДАЮТ И','ЗАХОДЯТ В ГОСТИ.'],
 ['БОЙ И ПОРАЖЕНИЕ','АТАКА, АТАКА,','ПОГОВОРИТЬ, ЛЕЧИТЬ.','ПОБЕДА: +40 ОПЫТА.','ДРУЖБА: +20 ОПЫТА.','УРОВЕНЬ 22 -> 23.','СМЕРТИ НЕТ: ОЧНЁШЬСЯ','В БЛИЖАЙШЕМ ГОРОДЕ.','ШТРАФА НЕТ.'],
 ['СОХРАНЕНИЕ И ПАМЯТЬ','СЛОТ ОДИН. РУЧНОЕ.','ИНОГДА ОНО ЛОМАЕТСЯ:','SAVE DATA CORRUPTED.','ЭТО СЮЖЕТ, А НЕ ПОЛОМКА.','ИГРА ПОМНИТ ТЕБЯ МЕЖДУ','ЗАПУСКАМИ. ЗАКРОЕШЬ НА','ЧЁРНОМ ЭКРАНЕ - ЗАМЕТИТ.'],
 ['МАРШРУТ MVP','ГОРОД -> ПОЛЕ (2 ЭКРАНА)','-> ЛЕС. ИЗ ЛЕСА:','НА СЕВЕР - ПЕЩЕРА,','НА ВОСТОК - МОСТ И РЕЙН.','КЛЮЧ ОТ БАШНИ - В ПОЛЕ','ЗА КАМНЕМ, ОБХОД СЛЕВА.','СВЕЧУ КУПИ ДО ПЕЩЕРЫ.']
];
function updHelp(){
  if(A()||hit('down')||hit('right')){ S.helpI=(S.helpI+1)%HELP.length; SFX.blip(); }
  else if(hit('up')||hit('left')){ S.helpI=(S.helpI+HELP.length-1)%HELP.length; SFX.blip(); }
  else if(B()){ SFX.no(); S.mode='menu'; }
}
function drawHelp(){
  const P=pal();
  G.fillStyle=P[3]; G.fillRect(0,0,W,H);
  boxThought(2,2,156,124);
  const pg=HELP[S.helpI];
  for(let i=0;i<pg.length;i++) tx(G,pg[i],8,10+i*13, i===0?P[0]:P[1]);
  box(2,128,156,14);
  tx(G,'СТР. '+(S.helpI+1)+'/'+HELP.length+'  Z-ДАЛЕЕ X-МЕНЮ',8,132,P[3]);
}
function drawSave(){
  const P=pal();
  G.fillStyle=P[3]; G.fillRect(0,0,W,H);
  box(24,22,112,96);
  tx(G,'SAVE?',58,34,P[3]);
  tx(G,'(ЭКРАН СОХРАНЕНИЯ)',32,46,P[2]);
  const opts=['ДА','НЕТ'];
  for(let i=0;i<2;i++){
    tx(G,opts[i],64,68+i*16, i===S.sv.i?P[3]:P[2]);
    if(i===S.sv.i && (S.tick>>3)%2===0) arrow(54,69+i*16);
  }
  tx(G,'АВТОСОХРАНЕНИЯ НЕТ.',32,104,P[2]);
  tx(G,slotLabel(),10,126,P[1]);
}
function updSave(){
  if(hit('left')||hit('right')||hit('up')||hit('down')){ S.sv.i=1-S.sv.i; SFX.blip(); }
  if(B()){ SFX.no(); S.mode='world'; return; }
  if(A()){ if(S.sv.i===1){ SFX.no(); S.mode='world'; return; } SFX.ok(); doSave(); }
}
function drawSaving(){
  const P=pal();
  G.fillStyle=P[3]; G.fillRect(0,0,W,H);
  box(18,50,124,44);
  const dots=(S.tick>>3)%4;
  tx(G,'СОХРАНЕНИЕ',30,62,P[3]);
  tx(G,'.'.repeat(dots),30+txW('СОХРАНЕНИЕ')+2,62,P[3]);
  tx(G,'СЛОТ 1 ИЗ 1',44,78,P[2]);
}
function updSaving(){ S.svT++; if(S.svT>70) finishSave(); }
function drawError(){
  G.fillStyle='#000'; G.fillRect(0,0,W,H);
  const fl=((S.tick>>5)%2===0);
  tx(G,'SAVE DATA CORRUPTED',16,26,'#ffffff');
  tx(G,'ДАННЫЕ СОХРАНЕНИЯ',24,44,fl?'#e8e8e8':'#c0c0c0');
  tx(G,'ПОВРЕЖДЕНЫ',50,54,fl?'#e8e8e8':'#c0c0c0');
  tx(G, MEM.corruptCount>1?'ТЫ УЖЕ ВИДЕЛА ЭТО. Я ТОЖЕ.':'ЭТО НЕ ТВОЯ ВИНА.',24,72,'#93a4bd');
  if(MEM.forgotText){
    tx(G,'Я ЗАБЫЛА ОДНУ ЗАПИСЬ:',24,88,'#7f8fa8');
    tx(G,glitchLine(20,3),24,98,'#5f6f88');
  }
  tx(G,'ИГРА ПРОДОЛЖАЕТСЯ.',26,114,'#93a4bd');
  if((S.tick>>4)%2===0) tx(G,'Z - ПРОДОЛЖИТЬ',34,128,'#ffffff');
  if(S.tick%97<3){ G.fillStyle='#ffffff'; G.fillRect(0,rnd(0,H-1),W,1); }
}
function updError(){ S.errT++; if(A()&&S.errT>20){ SFX.blip(); S.mode='world'; } }
