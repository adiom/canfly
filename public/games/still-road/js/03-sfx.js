"use strict";
/* ---------- 3. ЗВУКОВЫЕ ЭФФЕКТЫ ---------- */
let AC=null, MUTED=false;
function ac(){ if(!AC){ try{ AC=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} } return AC; }
function tone(f,d,type,vol,slideTo){
  if(MUTED) return; const a=ac(); if(!a) return;
  try{
    const o=a.createOscillator(), g=a.createGain();
    o.type=type||'square'; o.frequency.value=f;
    if(slideTo) o.frequency.linearRampToValueAtTime(slideTo, a.currentTime+d);
    g.gain.value=vol||0.045;
    g.gain.exponentialRampToValueAtTime(0.0008, a.currentTime+d);
    o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime+d+0.02);
  }catch(e){}
}
const SFX = {
  blip : ()=>tone(760,0.028,'square',0.03),
  ok   : ()=>{tone(660,0.05,'square',0.05); setTimeout(()=>tone(990,0.07,'square',0.05),55);},
  no   : ()=>{tone(220,0.09,'square',0.05);},
  step : ()=>tone(180,0.02,'triangle',0.018),
  hit  : ()=>tone(140,0.09,'sawtooth',0.06,70),
  heal : ()=>{tone(520,0.06,'triangle',0.05); setTimeout(()=>tone(780,0.09,'triangle',0.05),60);},
  meet : ()=>{tone(880,0.05,'square',0.05); setTimeout(()=>tone(440,0.05,'square',0.05),60); setTimeout(()=>tone(220,0.12,'square',0.05),120);},
  win  : ()=>{[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,0.1,'square',0.05),i*90));},
  save : ()=>{tone(600,0.05,'square',0.04); setTimeout(()=>tone(900,0.08,'square',0.04),70);},
  err  : ()=>{tone(120,0.5,'sawtooth',0.07); setTimeout(()=>tone(90,0.6,'square',0.05),120);},
  item : ()=>{[784,988,1175].forEach((f,i)=>setTimeout(()=>tone(f,0.08,'square',0.05),i*70));},
  door : ()=>tone(300,0.12,'triangle',0.05,180),
  hush : ()=>tone(320,0.35,'triangle',0.022,240),
  friend:()=>{[392,523,659].forEach((f,i)=>setTimeout(()=>tone(f,0.14,'triangle',0.045),i*110));}
};
