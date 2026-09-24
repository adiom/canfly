"use strict";
/* ---------- 3.5 МУЗЫКА (процедурный эмбиент-чиптюн, WebAudio) ---------- */
function mf(m){ return 440*Math.pow(2,(m-69)/12); }
const MINOR=[0,2,3,5,7,8,10], DORIAN=[0,2,3,5,7,9,10];
const TRACKS={
 /* титул: медленный ля-минор, Am–F–C–G */
 title:{bpm:60,root:45,scale:MINOR,prog:[0,5,2,4],
   pad:1,padOct:1,padDur:3.6,padVol:0.050,padVoice:'sine',
   bass:1,bassPat:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0],bassOct:0,bassDur:1.1,bassVol:0.10,
   mel:1,melOct:2,melP:0.20,melDur:0.55,melVol:0.046,melVoice:'triangle',
   bell:1,bellStep:12,bellOct:3,bellP:0.40, noise:{f:320,g:0.030}},
 intro:{bpm:52,root:45,scale:MINOR,prog:[0,5,2,4],
   pad:1,padOct:1,padDur:4.2,padVol:0.052,
   bass:0,mel:1,melOct:2,melP:0.09,melDur:0.8,melVol:0.038,
   bell:1,bellStep:8,bellOct:3,bellP:0.30, noise:{f:280,g:0.026}},
 town1:{bpm:74,root:48,scale:MINOR,prog:[0,3,5,4],
   pad:1,padOct:1,padDur:2.8,padVol:0.042,
   bass:1,bassPat:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,1,0],bassOct:0,bassDur:0.6,bassVol:0.10,
   mel:1,melOct:2,melP:0.24,melDur:0.40,melVol:0.048,
   bell:1,bellStep:14,bellOct:3,bellP:0.30, noise:{f:420,g:0.022}},
 field:{bpm:84,root:50,scale:DORIAN,prog:[0,3,0,5],
   pad:1,padOct:1,padDur:2.4,padVol:0.036,
   bass:1,bassPat:[1,0,0,1,0,0,1,0,0,1,0,0,1,0,0,0],bassOct:0,bassDur:0.45,bassVol:0.09,
   mel:1,melOct:2,melP:0.28,melDur:0.34,melVol:0.046,
   bell:1,bellStep:10,bellOct:3,bellP:0.25, noise:{f:560,g:0.042}},
 forest:{bpm:66,root:43,scale:MINOR,prog:[0,2,3,4],
   pad:1,padOct:1,padDur:3.4,padVol:0.050,
   bass:1,bassPat:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],bassOct:0,bassDur:0.9,bassVol:0.09,
   mel:1,melOct:2,melP:0.13,melDur:0.7,melVol:0.040,melVoice:'sine',
   bell:1,bellStep:6,bellOct:3,bellP:0.22, noise:{f:250,g:0.048}},
 cave:{bpm:48,root:36,scale:MINOR,prog:[0,1,0,6],
   pad:1,padOct:1,padDur:4.6,padVol:0.055,
   bass:1,bassPat:[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],bassOct:0,bassDur:1.8,bassVol:0.10,
   mel:1,melOct:2,melP:0.05,melDur:1.1,melVol:0.032,melVoice:'sine',
   bell:1,bellStep:4,bellOct:3,bellP:0.18, noise:{f:150,g:0.055}},
 bridge:{bpm:70,root:45,scale:DORIAN,prog:[0,5,4,3],
   pad:1,padOct:1,padDur:3.0,padVol:0.040,
   bass:1,bassPat:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],bassOct:0,bassDur:0.7,bassVol:0.09,
   mel:1,melOct:2,melP:0.32,melDur:0.30,melVol:0.044,
   bell:1,bellStep:11,bellOct:3,bellP:0.35, noise:{f:760,g:0.048}},
 rain:{bpm:64,root:48,scale:MINOR,prog:[0,3,4,5],
   pad:1,padOct:1,padDur:3.2,padVol:0.040,
   bass:1,bassPat:[1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0],bassOct:0,bassDur:0.8,bassVol:0.085,
   mel:1,melOct:3,melP:0.24,melDur:0.42,melVol:0.040,melVoice:'sine',
   bell:1,bellStep:9,bellOct:4,bellP:0.45, noise:{f:980,g:0.032}},
 quiet:{bpm:54,root:50,scale:MINOR,prog:[0,5,3,4],
   pad:1,padOct:1,padDur:4.0,padVol:0.046,
   bass:0,mel:1,melOct:2,melP:0.06,melDur:0.9,melVol:0.032,melVoice:'sine',
   bell:1,bellStep:7,bellOct:3,bellP:0.20, noise:{f:300,g:0.020}},
 battle:{bpm:126,root:45,scale:MINOR,prog:[0,6,0,5],
   pad:1,padOct:1,padDur:1.1,padVol:0.030,padVoice:'triangle',
   bass:1,bassPat:[1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0],bassOct:0,bassDur:0.22,bassVol:0.10,
   perc:1,percPat:[1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,1],
   mel:1,melOct:2,melP:0.12,melDur:0.20,melVol:0.038,melVoice:'square',
   noise:{f:420,g:0.018}},
 error:{bpm:44,root:34,scale:MINOR,prog:[0,1,0,1],
   pad:1,padOct:1,padDur:5.0,padVol:0.050,padVoice:'triangle',
   bass:1,bassPat:[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],bassOct:0,bassDur:2.0,bassVol:0.09,
   mel:0,glitch:1, noise:{f:1300,g:0.045}}
};
const MUS={started:false,cur:null,name:'',want:null,gainNow:0,vol:0.5,
  master:null,bus:null,delay:null,wet:null,noiseBuf:null,noiseSrc:null,noiseF:null,noiseG:null,
  step:0,nextTime:0,timer:null,lastDeg:0};
/* запуск по первому жесту пользователя (политика автоплея браузера) */
function musBoot(){
  if(MUS.started) return;
  const a=ac(); if(!a) return;
  try{ if(a.state==='suspended') a.resume(); }catch(e){}
  try{
    MUS.master=a.createGain(); MUS.master.gain.value=0; MUS.master.connect(a.destination);
    MUS.bus=a.createBiquadFilter(); MUS.bus.type='lowpass'; MUS.bus.frequency.value=3400;
    MUS.bus.connect(MUS.master);
    /* эхо — пространство дороги */
    MUS.delay=a.createDelay(1.2); MUS.delay.delayTime.value=0.30;
    const fb=a.createGain(); fb.gain.value=0.36;
    const dlp=a.createBiquadFilter(); dlp.type='lowpass'; dlp.frequency.value=1700;
    MUS.delay.connect(dlp); dlp.connect(fb); fb.connect(MUS.delay);
    MUS.wet=a.createGain(); MUS.wet.gain.value=0.42; dlp.connect(MUS.wet); MUS.wet.connect(MUS.master);
    /* «коричневый» шум: ветер, вода, гул пещеры */
    const len=Math.floor(a.sampleRate*2);
    const buf=a.createBuffer(1,len,a.sampleRate), dd=buf.getChannelData(0);
    let last=0;
    for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.03*w)/1.03; dd[i]=last*3.2; }
    MUS.noiseBuf=buf;
    MUS.noiseSrc=a.createBufferSource(); MUS.noiseSrc.buffer=buf; MUS.noiseSrc.loop=true;
    MUS.noiseF=a.createBiquadFilter(); MUS.noiseF.type='lowpass'; MUS.noiseF.frequency.value=340;
    MUS.noiseG=a.createGain(); MUS.noiseG.gain.value=0;
    MUS.noiseSrc.connect(MUS.noiseF); MUS.noiseF.connect(MUS.noiseG); MUS.noiseG.connect(MUS.master);
    MUS.noiseSrc.start();
    MUS.started=true; MUS.nextTime=a.currentTime+0.15;
    if(!MUS.timer) MUS.timer=setInterval(musTick,25);
  }catch(e){ MUS.started=false; }
}
function mvoice(type,freq,t,dur,vol,det){
  const a=ac(); if(!a||!MUS.bus) return;
  try{
    const o=a.createOscillator(), g=a.createGain();
    o.type=type; o.frequency.value=freq;
    if(det) o.detune.value=det;
    const v=Math.max(0.0005,vol*(0.85+Math.random()*0.3));
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(v,t+Math.min(0.03,dur*0.25));
    g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    o.connect(g); g.connect(MUS.bus); g.connect(MUS.delay);
    o.start(t+Math.random()*0.008); o.stop(t+dur+0.1);
  }catch(e){}
}
function nvoice(t,vol,dur,hp){
  const a=ac(); if(!a||!MUS.noiseBuf) return;
  try{
    const s=a.createBufferSource(); s.buffer=MUS.noiseBuf;
    const f=a.createBiquadFilter(); f.type='highpass'; f.frequency.value=hp||2400;
    const g=a.createGain();
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0008,t+dur);
    s.connect(f); f.connect(g); g.connect(MUS.master);
    s.start(t,Math.random()*1.4); s.stop(t+dur+0.05);
  }catch(e){}
}
/* один шаг (1/16 такта): пэд, бас, мелодия, колокольчик, перкуссия */
function scheduleStep(step,t){
  const tr=MUS.cur; if(!tr) return;
  const sc=tr.scale, n=sc.length;
  const shift=(PH===3)?-2:(PH===2?-1:(PH===0?2:0));   // ночь ниже и реже, утро светлее
  const root=tr.root+shift;
  const bar=Math.floor(step/16), i=step%16;
  const chDeg=tr.prog[bar%tr.prog.length];
  const chTone=function(k,oct){
    const d=chDeg+k, o=Math.floor(d/n), idx=((d%n)+n)%n;
    return root+sc[idx]+12*(o+oct);
  };
  if(i===0 && tr.pad){
    for(let k=0;k<3;k++) mvoice(tr.padVoice||'sine',mf(chTone(k*2,tr.padOct||1)),t+k*0.015,tr.padDur||3,tr.padVol||0.045,k===2?7:0);
  }
  if(tr.bass && tr.bassPat[i]) mvoice('triangle',mf(chTone(0,tr.bassOct||0)),t,tr.bassDur||0.6,tr.bassVol||0.10);
  if(tr.perc && tr.percPat[i]){ mvoice('sine',mf(root-24),t,0.13,0.13); nvoice(t,0.045,0.05,3200); }
  if(tr.mel){
    let p=tr.melP||0.18;
    if(PH===3) p*=0.65;
    if(i%4===0) p+=0.16;
    if(Math.random()<p){
      let d=MUS.lastDeg+pick([-2,-1,-1,0,1,1,2]);        // плавное движение по ступеням
      if(Math.random()<0.22) d=chDeg+pick([0,2,4]);       // иногда — тоника аккорда
      d=clamp(d,-3,9); MUS.lastDeg=d;
      const o=Math.floor(d/n), idx=((d%n)+n)%n;
      mvoice(tr.melVoice||'triangle',mf(root+sc[idx]+12*(o+(tr.melOct||2))),t,tr.melDur||0.45,tr.melVol||0.046);
    }
  }
  if(tr.bell && i===tr.bellStep && Math.random()<(tr.bellP||0.35)) mvoice('sine',mf(chTone(4,tr.bellOct||3)),t,1.5,0.040);
  if(tr.glitch && Math.random()<0.07) mvoice('square',mf(root+24+rnd(0,14)),t,0.05,0.030);
}
function playTrack(name){ if(!TRACKS[name]) name='title'; MUS.want=name; }
function musTick(){
  const a=ac(); if(!a||!MUS.started) return;
  let target=(MUTED)?0:MUS.vol;
  if(MUS.want && MUS.want!==MUS.name) target=0;          // затухаем перед сменой трека
  MUS.gainNow+=(target-MUS.gainNow)*0.12;
  if(Math.abs(MUS.gainNow-target)<0.002) MUS.gainNow=target;
  try{ MUS.master.gain.setTargetAtTime(MUS.gainNow,a.currentTime,0.06); }catch(e){}
  if(MUS.want && MUS.want!==MUS.name && MUS.gainNow<0.012){
    MUS.name=MUS.want; MUS.cur=TRACKS[MUS.name]; MUS.step=0; MUS.lastDeg=0;
    MUS.nextTime=a.currentTime+0.08;
    if(MUS.cur&&MUS.cur.noise){ try{ MUS.noiseF.frequency.setTargetAtTime(MUS.cur.noise.f,a.currentTime,0.6); }catch(e){} }
  }
  if(!MUS.cur) return;
  const ng=MUS.cur.noise? MUS.cur.noise.g*(0.62+0.38*Math.sin(a.currentTime*0.21)) : 0;
  try{ MUS.noiseG.gain.setTargetAtTime(ng,a.currentTime,0.5); }catch(e){}
  if(MUS.nextTime<a.currentTime-0.2) MUS.nextTime=a.currentTime+0.05;   // ресинхрон после сна вкладки
  const s16=(60/MUS.cur.bpm)/4;
  let guard=0;
  while(MUS.nextTime<a.currentTime+0.3 && guard<64){
    scheduleStep(MUS.step,MUS.nextTime);
    MUS.nextTime+=s16; MUS.step=(MUS.step+1)%4096; guard++;
  }
}
function musUpdate(){
  let t;
  if(S.mode==='title') t='title';
  else if(S.mode==='intro') t='intro';
  else if(S.mode==='docs') t='quiet';
  else if(S.mode==='battle') t='battle';
  else if(S.mode==='error') t='error';
  else if(S.mode==='world'||S.mode==='dialog'||S.mode==='menu') t=(S.scene==='home'||S.scene==='inn')?'quiet':S.scene;
  else t='quiet';
  playTrack(t);
}
