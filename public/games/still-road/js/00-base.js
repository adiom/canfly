"use strict";
/* =====================================================================
   STILL ROAD — MVP-прототип
   тихие события · игра помнит · дневник дороги · дружба с «врагами»
   процедурная фоновая музыка (11 треков, зависит от места и времени суток)
   ===================================================================== */

/* ---------- 0. БАЗА ---------- */
const CV = (function(){
  let c = document.getElementById('game');
  if(!c){
    c = document.createElement('canvas');
    c.width = 160; c.height = 144; c.id = 'game';
    c.style.cssText = 'width:min(96vw,640px);image-rendering:pixelated;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:#0b0f08';
    (document.body || document.documentElement).appendChild(c);
  }
  return c;
})();
const G = CV.getContext('2d');
G.imageSmoothingEnabled = false;
const W = 160, H = 144, TS = 8;
const DX = [0,0,-1,1], DY = [1,-1,0,0];
const DIRK = ['up','down','left','right'];
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const rnd   = (a,b)=> a + Math.floor(Math.random()*(b-a+1));
const pick  = a => a[Math.floor(Math.random()*a.length)];
