"use strict";
/* ---------- 7. СОСТОЯНИЕ ---------- */
const S = {
  mode:'title',
  scene:'town1', px:4, py:6, dir:0, ox:0, oy:0, mv:null,
  frame:0, anim:0, steps:0, lastBattle:-99, bump:0,
  hp:32, hpMax:32, lv:22, exp:0, gold:30,
  items:[], flags:{},
  journal:[], jI:0, frI:0, helpI:0, holdA:0,
  still:0, idleN:0, cd:{}, guest:null, fx:null, glitchT:0,
  saveCount:0, banner:0, bannerTxt:'',
  fade:{on:false,lvl:0,dir:1,after:null},
  dlg:null, menu:{i:0}, itm:{i:0}, sv:{i:0}, bt:null, tick:0,
  titleI:0, docsI:0, introT:0, errT:0, svT:0, svBad:false, toastT:0, toast:''
};
const ITEMS = {
  letter:{name:'ПИСЬМО БЕЗ АДРЕСА', desc:'ОНО ТЯНЕТ ВПЕРЁД. АДРЕСА НЕТ, НО ОНО ЗНАЕТ, КУДА.'},
  key   :{name:'КЛЮЧ ОТ БАШНИ',     desc:'ТЯЖЁЛЫЙ. ГДЕ-ТО В РЕЙНЕ ЕСТЬ ДВЕРЬ, КОТОРАЯ ЖДЁТ.'},
  candle:{name:'СИНЯЯ СВЕЧА',       desc:'КУПЛЕНА ДО ПЕЩЕРЫ. ГОРИТ НЕ ТАК, КАК ПРИНЯТО.'},
  pixel :{name:'РОЗОВЫЙ ПИКСЕЛЬ',   desc:'ОН ТЁПЛЫЙ. ОН ЧЕЙ-ТО. НАВЕРНОЕ, ДЕВОЧКИ У КОЛОДЦА.'}
};
const has = id => S.items.indexOf(id)>=0;
const addItem = id => { if(!has(id)) S.items.push(id); };
