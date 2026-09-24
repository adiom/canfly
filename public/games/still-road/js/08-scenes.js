"use strict";
/* ---------- 8. СЦЕНЫ / АКТЁРЫ / ТРИГГЕРЫ ---------- */
const SCENES = {
  town1:{ name:'ПЕРВЫЙ ГОРОД', map:'town1', xArt:'.', respawn:'town1',
    start:{x:4,y:6,dir:0},
    exits:[{x:7,y:17,w:2,h:1,to:'field',tx:1,ty:8,dir:3}],
    npcs:[
      {id:'merchant',x:2,y:8,spr:'merchant',dir:0,talk:talkMerchant},
      {id:'barman',  x:11,y:13,spr:'barman', dir:2,talk:talkBarman},
      {id:'dog',     x:14,y:7, spr:'dog',    dir:2,talk:talkDog}
    ],
    look:{
      'S':()=> 'ВЫВЕСКА: РЕЙН - 3 ДНЯ ПУТИ. ИЛИ ТРИ ЭКРАНА. ПЕРЕВОДЧИК НЕ УВЕРЕН.',
      'D':doorTown, 'w':wellTown,
      'C':()=> 'ПРИЛАВОК. НА НЁМ ПЫЛЬ И ОДНА СВЕЧА. СИНЯЯ.',
      'B':()=> 'БОЧКА. В НЕЙ ВОДА. ИЛИ ТИШИНА.',
      'R':()=> 'КРЫША. СВОЯ.'
    }
  },
  home:{ name:'ДОМ', map:'home', xArt:'i', respawn:'town1',
    start:{x:9,y:15,dir:1},
    exits:[],
    npcs:[],
    look:{
      'D':doorHome, 'b':bedHome,
      'H':()=> 'СТЕНА. ЗА НЕЙ ДОЖДЬ. ИЛИ ТИШИНА. СМОТРЯ КАКОЙ ЧАС.',
      'C':()=> 'СТОЛ. НА НЁМ КРУЖКА ВОДЫ И ПИСЬМО, КОТОРОГО НЕТ.'
    }
  },
  inn:{ name:'ТАВЕРНА', map:'inn', xArt:'i', respawn:'town1',
    start:{x:9,y:15,dir:1},
    exits:[],
    npcs:[{id:'keeper',x:9,y:6,spr:'barman',dir:0,talk:talkBarman}],
    look:{
      'D':doorInn,
      'C':()=> 'СТОЙКА. ЗА НЕЙ НИКОГО. ТОЛЬКО СТАКАНЫ И ВРЕМЯ.',
      'H':()=> 'СТЕНА. ЗДЕСЬ ПАХНЕТ ВОДОЙ И ДЕРЕВОМ.'
    }
  },
  field:{ name:'ПОЛЕ', map:'field', xArt:',', respawn:'town1',
    enc:{tiles:[','],rate:0.075,pool:['slime','slime','wolf']},
    exits:[{x:0,y:8,w:1,h:2,to:'town1',tx:7,ty:16,dir:1},
           {x:39,y:8,w:1,h:2,to:'forest',tx:9,ty:24,dir:1}],
    npcs:[],
    look:{
      'S':()=> 'ПОЛЕ. ТРАВА ПО ПОЯС. БОЙ СЛУЧАЕТСЯ САМ, КОГДА ЗАХОЧЕТ.',
      '#':()=> has('key') ? 'КАМЕНЬ. ПОД НИМ БОЛЬШЕ НИЧЕГО.' :
        'БОЛЬШОЙ КАМЕНЬ. ЗА НИМ ЧТО-ТО БЛЕСТИТ. ПРЯМО ТАК НЕ ДОЙТИ. НУЖНО ОБОЙТИ СЛЕВА.',
      'M':()=> 'ГОРЫ. ОНИ ТУТ ДАВНО И УХОДИТЬ НЕ СОБИРАЮТСЯ.',
      ',':()=> 'ТРАВА ПО ПОЯС. В НЕЙ КТО-ТО ЕСТЬ. ИЛИ НИКОГО.'
    }
  },
  forest:{ name:'ЛЕС', map:'forest', xArt:'.', respawn:'town1',
    enc:{tiles:['.'],rate:0.09,pool:['wolf','wolf','shadow']},
    exits:[{x:9,y:25,w:2,h:1,to:'field',tx:38,ty:8,dir:2},
           {x:9,y:0,w:2,h:1,to:'cave',tx:9,ty:16,dir:1},
           {x:19,y:13,w:1,h:2,to:'bridge',tx:1,ty:8,dir:3}],
    npcs:[],
    look:{
      'S':()=> 'ПЕНЬ. НА НЁМ ВЫРЕЗАНО: ЛЕС. ТУТ НИКОГО НЕТ. ЭТО НЕ ГРУСТНО.',
      'T':()=> 'ДЕРЕВО. ОНО СТОИТ ТУТ ДОЛЬШЕ, ЧЕМ ДОРОГА.',
      '#':()=> 'КАМЕНЬ. МОХ ПОМНИТ ЕГО ДРУГИМ.'
    }
  },
  cave:{ name:'ПЕЩЕРА', map:'cave', xArt:'f', respawn:'town1',
    enc:{tiles:['f'],rate:0.12,pool:['shadow','shadow','walker']},
    exits:[{x:9,y:17,w:2,h:1,to:'forest',tx:9,ty:1,dir:0}],
    npcs:[],
    look:{
      'A':altar,
      'c':()=> 'СТЕНА. БЕЗ СВЕЧИ ЭТО ПРОСТО ТЕМНО. СО СВЕЧОЙ - ЭТО СТЕНА.',
      '~':()=> 'ВОДА В ПЕЩЕРЕ. ОНА КАПАЕТ. ЭТО ЕДИНСТВЕННЫЙ ЗВУК ТУТ.',
      'Y':()=> 'НИША. В НЕЙ ЧТО-ТО ЛЕЖИТ.'
    }
  },
  bridge:{ name:'МОСТ', map:'bridge', xArt:'.', respawn:'town1',
    exits:[{x:0,y:8,w:1,h:2,to:'forest',tx:18,ty:13,dir:2},
           {x:19,y:8,w:1,h:2,to:'rain',tx:1,ty:8,dir:3}],
    npcs:[{id:'oldman',x:10,y:8,spr:'oldman',dir:2,talk:talkOldman}],
    look:{
      'S':()=> 'МОСТ. РЕКА НЕ СПРАШИВАЕТ ИМЕНИ. ОНА ПРОСТО ТЕЧЁТ.',
      '~':()=> 'ВОДА. ПОД НЕЙ КАМНИ. НАД НЕЙ - ТЫ.',
      '=':()=> 'ДОСКИ. КТО-ТО ИХ ПОЛОЖИЛ. КТО-ТО ПО НИМ ИДЁТ.'
    }
  },
  rain:{ name:'РЕЙН', map:'rain', xArt:'.', respawn:'rain',
    exits:[{x:0,y:8,w:1,h:2,to:'bridge',tx:18,ty:8,dir:2}],
    npcs:[{id:'girl',x:11,y:7,spr:'girl',dir:3,talk:talkGirl}],
    look:{
      'S':()=> 'РЕЙН. ВТОРОЙ ГОРОД. ПЕРВЫЙ БЫЛ ГДЕ-ТО ТАМ. ИЛИ ЗДЕСЬ.',
      'w':wellRain, 'D':()=> 'ДВЕРЬ. ЗА НЕЙ КТО-ТО ЖИВЁТ. ЭТО СЛЫШНО ПО ТИШИНЕ.',
      'L':towerDoor, 'O':towerDoor,
      'K':()=> 'БАШНЯ. ОНА ВЫШЕ, ЧЕМ КАЖЕТСЯ. И СТАРШЕ, ЧЕМ НАДО.',
      'R':()=> 'КРЫША. ЧУЖАЯ.'
    }
  }
};
const MAP = ()=> MAPS[SCENES[S.scene].map];
