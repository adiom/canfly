"use strict";
/* ---------- 9. ВВОД ---------- */
const keys=new Set(), pressed=new Set();
const KMAP={ArrowUp:'up',KeyW:'up',ArrowDown:'down',KeyS:'down',ArrowLeft:'left',KeyA:'left',
  ArrowRight:'right',KeyD:'right',KeyZ:'a',Enter:'a',Space:'a',NumpadEnter:'a',
  KeyX:'b',ShiftLeft:'b',ShiftRight:'b',Backspace:'b',Escape:'b',KeyT:'t',KeyM:'m'};
addEventListener('keydown',function(e){
  const k=KMAP[e.code]; if(!k) return;
  if(DIRK.indexOf(k)>=0||k==='a'||k==='b') e.preventDefault();
  if(!keys.has(k)) pressed.add(k);
  keys.add(k); musBoot();               // первый жест — запускаем музыку
});
addEventListener('keyup',function(e){ const k=KMAP[e.code]; if(k) keys.delete(k); });
Array.prototype.forEach.call(document.querySelectorAll('[data-k]'),function(b){
  const k=b.getAttribute('data-k');
  const on=function(e){ if(e&&e.preventDefault) e.preventDefault(); if(!keys.has(k)) pressed.add(k); keys.add(k); musBoot(); };
  const off=function(e){ if(e&&e.preventDefault) e.preventDefault(); keys.delete(k); };
  b.addEventListener('pointerdown',on); b.addEventListener('pointerup',off);
  b.addEventListener('pointercancel',off); b.addEventListener('pointerleave',off);
});
const hit=function(k){ return pressed.has(k); };
const A=function(){ return pressed.has('a'); };
const B=function(){ return pressed.has('b'); };
function dirHeld(){ for(let d=0;d<4;d++) if(keys.has(DIRK[d])) return d; return -1; }
