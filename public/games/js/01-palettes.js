"use strict";
/* ---------- 1. ПАЛИТРЫ GBC ---------- */
const PALS = [
  ['#e8f0d0','#a8bc8c','#5f7450','#26311f'],
  ['#f2f8dc','#bccc98','#6d7f52','#232f1c'],
  ['#f0d0a4','#b98c68','#6d4c40','#2a1c22'],
  ['#8ba0c0','#4e6488','#2a3a5c','#111a2c']
];
const PHASE = ['УТРО','ДЕНЬ','ВЕЧЕР','НОЧЬ'];
const PINK = '#e0789a', BLUE = '#6aa8e8';
let PH = 1;
const pal = ()=> PALS[PH];
