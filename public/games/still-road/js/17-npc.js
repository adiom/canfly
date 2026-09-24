"use strict";
/* ---------- 17. NPC ---------- */
function talkMerchant(){
  if(has('candle')){ say(['"YOU ALREADY HAVE THE CANDLE. THE CAVE REMEMBERS IT."','ТЫ УЖЕ ВЗЯЛА СВЕЧУ. ПЕЩЕРА ЕЁ УЖЕ ПОМНИТ.','ВТОРАЯ НЕ НУЖНА. НАВЕРНОЕ.']); return; }
  say([
    {lines:['"YOU LOOK TIRED, TRAVELER.','- REST IS ALSO A JOURNEY."']},
    'ТЫ ВЫГЛЯДИШЬ УСТАВШЕЙ, ПУТНИЦА. ОТДЫХ ЕСТЬ ТОЖЕ ПУТЕШЕСТВИЕ.',
    {lines:['СИНЯЯ СВЕЧА. 20 МОНЕТ. БРАТЬ?'],choices:['ДА','НЕТ'],onPick:function(i){
      if(i===0){
        if(S.gold>=20){
          S.gold-=20; addItem('candle'); S.flags.candle=true; SFX.item();
          jot('СИНЯЯ СВЕЧА. ОНА ГОРИТ ВБОК. МОЖЕТ, ТАК И НАДО.');
          return ['"THANK YOU. IT BURNS SIDEWAYS."','СПАСИБО. ОНА ГОРИТ ВБОК. ЭТО НОРМАЛЬНО.','(ТЕПЕРЬ В ПЕЩЕРЕ ПОЯВИТСЯ ЧТО-ТО ЕЩЁ.)'];
        }
        return ['"NO COINS. NO PROBLEM. THE ROAD IS FREE."','МОНЕТ НЕТ. ТОРГОВЕЦ НЕ ЗЛИТСЯ. ТОРГОВЕЦ ЖДЁТ.'];
      }
      return ['"NO IS ALSO AN ANSWER."','НЕТ - ЭТО ТОЖЕ ОТВЕТ. ТОРГОВЕЦ КИВАЕТ.'];
    }}
  ]);
}
function talkBarman(){
  say([
    {lines:['"MILK IS FOR HEROES.','- WE ONLY HAVE WATER."']},
    'МОЛОКО ДЛЯ ГЕРОЕВ. У НАС ЕСТЬ ТОЛЬКО ВОДА.',
    {lines:['ПОСПАТЬ ЗА СТОЛОМ? БЕСПЛАТНО.','ВРЕМЯ СДВИНЕТСЯ, СИЛЫ ВЕРНУТСЯ.'],choices:['ДА','НЕТ'],onPick:function(i){
      if(i===0){ rest(); return null; }
      return ['БАРМЕН НЕ ОБИДЕЛСЯ. ОН НИКОГДА НЕ ОБИЖАЕТСЯ.'];
    }}
  ]);
}
function talkDog(){ say(['СОБАКА: ГАВ.','(ПЕРЕВОД НЕ ТРЕБУЕТСЯ. ВСЁ И ТАК ЯСНО.)']); }
function talkOldman(){
  const base=[
    {lines:['"THE HERO ALWAYS RETURNS.','- BUT THE ROAD DOES NOT WAIT."']},
    'ГЕРОЙ ВСЕГДА ВЕРНЁТСЯ ОБРАТНО. НО ДОРОГА НЕ БУДЕТ ЖДАТЬ.'
  ];
  if(MEM.endings>0) base.push('ТЫ УЖЕ БЫЛА НАВЕРХУ. Я ПОМНЮ. ДОРОГА ТОЖЕ ПОМНИТ, НО МОЛЧИТ.');
  if(S.flags.corrupted||MEM.sawCorrupt) base.push('ТЫ ВИДЕЛА ЧЁРНЫЙ ЭКРАН С БЕЛЫМИ БУКВАМИ. ЗНАЧИТ, ТЫ ВИДЕЛА ПРАВДУ.');
  if(MEM.metWalker) base.push('ТЫ ВСТРЕЧАЛА ТОГО, КТО ПРОСТО СТОИТ. ОН ПРО ТЕБЯ СПРАШИВАЛ. Я НЕ ОТВЕТИЛ.');
  if(friendCount()>0) base.push('ТЫ ГОВОРИЛА С ТЕМИ, КТО В ТРАВЕ. ОНИ ТЕПЕРЬ ПРО ТЕБЯ СПРАШИВАЮТ.');
  base.push('ИДИ. СТОЙ. ОБА ВАРИАНТА - ОДНО И ТО ЖЕ. ПЕРЕВОДЧИК ПРОСИТ ПРОЩЕНИЯ ЗА РИФМУ.');
  say(base);
}
function talkGirl(){
  if(MEM.returnedPixel && !S.flags.pixelReturned){
    say([
      {lines:['"YOU CAME BACK. I REMEMBER','- THE ROAD YOU WALKED."']},
      'ТЫ ВЕРНУЛАСЬ. Я ПОМНЮ ДОРОГУ, ПО КОТОРОЙ ТЫ ШЛА.',
      'ОНА УЛЫБАЕТСЯ. ТЕПЕРЬ ОНА ЦЕЛАЯ. Я ПОМНЮ ЭТО ЗА НЕЁ.'
    ],function(){ S.flags.girlRemembered=true;
      jot('ДЕВОЧКА У КОЛОДЦА ПОМНИТ МЕНЯ С ПРОШЛОЙ ДОРОГИ. ЗНАЧИТ, Я ТОЖЕ БЫЛА.'); });
    return;
  }
  if(has('pixel') && !S.flags.pixelReturned){
    say([
      {lines:['"OH. YOU FOUND IT.','- MY PINK PIXEL."']},
      'О. ТЫ НАШЛА. МОЙ РОЗОВЫЙ ПИКСЕЛЬ.',
      {lines:['ОТДАТЬ ЕГО ЕЙ?'],choices:['ДА','НЕТ'],onPick:function(i){
        if(i===0){
          S.flags.pixelReturned=true; remember('returnedPixel',true);
          S.items=S.items.filter(function(x){ return x!=='pixel'; });
          SFX.heal();
          jot('Я ОТДАЛА РОЗОВЫЙ ПИКСЕЛЬ. ОНА УЛЫБНУЛАСЬ. ИДУ ДАЛЬШЕ ЛЕГЧЕ, ЧЕМ ПРИШЛА.');
          return ['"THANK YOU. I AM WHOLE NOW. PROBABLY."','СПАСИБО. ТЕПЕРЬ Я ЦЕЛАЯ. НАВЕРНОЕ.','ОНА СМОТРИТ В КОЛОДЕЦ. В ВОДЕ ТЕПЕРЬ ДВА ОТРАЖЕНИЯ.'];
        }
        return ['ОНА НЕ РАССТРОИЛАСЬ. ОНА ЖДАЛА И НЕ ТАКОЕ.'];
      }}
    ]);
    return;
  }
  if(S.flags.pixelReturned){
    say([
      {lines:['"I AM WHOLE NOW. I STILL DO NOT','- REMEMBER THE MORNING."']},
      'ТЕПЕРЬ Я ЦЕЛАЯ. УТРО Я ВСЁ ЕЩЁ НЕ ПОМНЮ.',
      PH>=2 ? 'НОЧЬЮ КОЛОДЕЦ ПОКАЗЫВАЕТ ДОРОГУ. ОНА ВСЕГДА ОДНА И ТА ЖЕ.'
            : 'ДНЁМ КОЛОДЕЦ ПОКАЗЫВАЕТ ТОЛЬКО МЕНЯ. ЭТОГО ДОСТАТОЧНО.'
    ]);
    return;
  }
  if(PH>=2){
    say([
      {lines:['"THE WELL SHOWED ME A FACE.','- IT WAS WAITING FOR SOMETHING."']},
      'КОЛОДЕЦ ПОКАЗАЛ МНЕ ЛИЦО. ОНО ЧЕГО-ТО ЖДАЛО.',
      S.flags.candleLit ? 'У НЕГО БЫЛА СИНЯЯ СВЕЧА. ОНА ГОРЕЛА ВБОК.' : 'ПОСЛЕ ЗАКАТА ОН ГОВОРИТ БОЛЬШЕ. Я - МЕНЬШЕ.'
    ]);
  } else {
    say([
      {lines:['"I HAVE BEEN HERE SINCE MORNING.','- OR MAYBE LONGER."']},
      {lines:['"THE WELL REMEMBERS, I DO NOT."']},
      'Я БЫЛА ТУТ С УТРА. ИЛИ МОЖЕТ ДОЛЬШЕ. КОЛОДЕЦ ПОМНИТ, Я НЕТ.',
      '(В ЕЁ ВОЛОСАХ НЕ ХВАТАЕТ ОДНОГО РОЗОВОГО ПИКСЕЛЯ.)'
    ]);
  }
}
function doorTown(x,y){
  SFX.door();
  if(x===4){ travel('home',9,15,1); return; }          // дом
  if(x===10||x===12){ travel('inn',9,15,1); return; }  // таверна
  say(['ДВЕРЬ ЗАКРЫТА. ВНУТРИ КТО-ТО ЕСТЬ. ИЛИ НИКОГО.','ИГРЕ ВСЁ РАВНО. ИГРЕ НЕКУДА СПЕШИТЬ.']);
}
function doorHome(){ SFX.door(); travel('town1',4,5,0); }
function doorInn(){ SFX.door(); travel('town1',12,5,0); }
function bedHome(){
  say(['ТВОЯ КРОВАТЬ. ОНА ЗАПРАВЛЕНА. ЭТО ЕДИНСТВЕННОЕ, ЧТО ЗДЕСЬ ЖДЁТ.',
    {lines:['СПАТЬ? ВРЕМЯ СДВИНЕТСЯ.'],choices:['ДА','НЕТ'],onPick:function(i){
      if(i===0){ rest(); return null; }
      return ['ТЫ НЕ СПЕШИШЬ. ДОРОГА ТОЖЕ НЕ СПЕШИТ.'];
    }}
  ]);
}
function wellTown(){
  if(S.flags.corrupted||MEM.sawCorrupt) say(['КОЛОДЕЦ. ВОДА ПОМНИТ ВСЕХ, КТО СМОТРЕЛ.','В ВОДЕ - ЧЁРНЫЙ ЭКРАН С БЕЛЫМИ БУКВАМИ.','ТЫ ОТХОДИШЬ. БУКВЫ ОСТАЮТСЯ.']);
  else say(['КОЛОДЕЦ. ВОДА ПОМНИТ ВСЕХ, КТО СМОТРЕЛ.','ТЫ СМОТРИШЬ. ВОДА НЕ ПРОТИВ.']);
}
function wellRain(){
  if(S.flags.pixelReturned) say(['КОЛОДЕЦ РЕЙНА. В ВОДЕ ДВА ОТРАЖЕНИЯ: ТВОЁ И ЕЁ.','ОБА НИКУДА НЕ СПЕШАТ.']);
  else say(['КОЛОДЕЦ РЕЙНА. ВОДА ТЁМНАЯ. В НЕЙ НЕ ХВАТАЕТ ОДНОГО ЦВЕТА.']);
}
function altar(){
  if(S.flags.candleLit){ say(['АЛТАРЬ ГОРИТ СИНЕЙ СВЕЧОЙ. НИША НАД НИМ ОТКРЫТА.','ПРОХОД, КОТОРОГО ТУТ НЕ БЫЛО, ТЕПЕРЬ ЕСТЬ.']); return; }
  if(!has('candle')){ say(['АЛТАРЬ. В НЁМ УГЛУБЛЕНИЕ - РОВНО ПОД СВЕЧУ.','У ТЕБЯ НЕТ СВЕЧИ. В ПЕЩЕРЕ ПРОСТО ТЕМНО.','(СВЕЧУ ПРОДАЮТ В ПЕРВОМ ГОРОДЕ. ДО ПЕЩЕРЫ.)']); return; }
  SFX.heal();
  say(['ТЫ ЗАЖГЛА СИНЮЮ СВЕЧУ.','СВЕТ ПОШЁЛ ВБОК. ТАК И НАПИСАНО В ИНСТРУКЦИИ, КОТОРОЙ НЕТ.','ПЕЩЕРА ПОКАЗАЛА ДВЕРЬ, КОТОРОЙ ТУТ РАНЬШЕ НЕ БЫЛО.'],
    function(){ S.flags.candleLit=true; MAPS.cave[3][10]='f'; toast('НИША ОТКРЫТА');
      jot('Я ЗАЖГЛА СВЕЧУ В ПЕЩЕРЕ. СТЕНА ОТОДВИНУЛАСЬ. МИР ПОДВИНУЛСЯ РАДИ МЕНЯ.'); });
}
function towerDoor(){
  if(S.flags.tower){ say(['ДВЕРЬ БАШНИ ОТКРЫТА. ВНУТРИ - ЛЕСТНИЦА И ВЕТЕР.','ТЫ УЖЕ БЫЛА НАВЕРХУ. МОЖНО ЕЩЁ РАЗ. МОЖНО НЕ НАДО.']); return; }
  if(!has('key')){ SFX.no(); say(['БАШНЯ ЗАКРЫТА.','КЛЮЧ ГДЕ-ТО В ТРАВЕ. ИЛИ ЗА КАМНЕМ. ПЕРЕВОДЧИК СЛЫШАЛ ЭТО В ПОЛЕ.']); return; }
  SFX.door(); S.flags.tower=true; MAPS.rain[4][10]='O';
  say(['КЛЮЧ ПОДОШЁЛ. ДВЕРЬ ОТКРЫЛАСЬ БЕЗ ЗВУКА.','ТЫ ПОДНЯЛАСЬ. НАВЕРХУ НИКОГО.','ТОЛЬКО ВЕТЕР И ДОРОГА - ОНА ВИДНА ОТСЮДА ЦЕЛИКОМ.',
       'Я ДОСТАЛА ПИСЬМО. АДРЕСА ВСЁ ЕЩЁ НЕТ.','НО ТЕПЕРЬ Я ЗНАЮ: ОНО БЫЛО НЕ МНЕ.','ДОРОГА ИДЁТ ДАЛЬШЕ. ИГРА ЭТО ЗНАЕТ И НЕ ТОРОПИТ.','КОНЕЦ MVP. СПАСИБО, ЧТО НЕ СПЕШИЛА.'],
    function(){ toast('БАШНЯ ОТКРЫТА'); remember('endings',MEM.endings+1);
      jot('НАВЕРХУ НИКОГО. ТОЛЬКО ВЕТЕР И ДОРОГА. ПИСЬМО ОКАЗАЛОСЬ НЕ МОЁ. НО ОНО ПРИВЕЛО МЕНЯ СЮДА.'); });
}
function rest(){
  fade(function(){ setTime(PH+1,true); S.hp=S.hpMax; S.banner=100; S.bannerTxt=PHASE[PH]; });
  toast('МИР ПОДОЖДАЛ');
}
