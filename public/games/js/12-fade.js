"use strict";
/* ---------- 12. ЗАТЕМНЕНИЕ И ПЕРЕХОДЫ ---------- */
function fade(after){ S.fade={on:true,lvl:0,dir:1,after:after||null}; }
function updFade(){
  const f=S.fade; if(!f.on) return;
  if(S.tick%3) return;
  f.lvl+=f.dir;
  if(f.lvl>=4){ f.lvl=4; if(f.after){ const a=f.after; f.after=null; a(); } f.dir=-1; }
  else if(f.lvl<=0){ f.lvl=0; f.on=false; f.dir=1; }
}
const DITHER=(function(){
  const out=[];
  const pats=[[],[[0,0]],[[0,0],[2,2]],[[0,0],[2,2],[1,1]],[[0,0],[1,0],[0,1],[1,1]]];
  for(let lv=0;lv<5;lv++){
    const c=document.createElement('canvas'); c.width=W; c.height=H;
    const g=c.getContext('2d'); g.fillStyle='#000';
    if(lv===4){ g.fillRect(0,0,W,H); }
    else { const pat=pats[lv];
      for(let y=0;y<H;y+=2) for(let x=0;x<W;x+=2)
        for(let i=0;i<pat.length;i++) g.fillRect(x+pat[i][0],y+pat[i][1],1,1);
    }
    out.push(c);
  }
  return out;
})();
function drawFade(){ if(S.fade.on && S.fade.lvl>0) G.drawImage(DITHER[S.fade.lvl],0,0); }
function travel(to,tx2,ty2,dir){
  fade(function(){
    S.scene=to; S.px=tx2; S.py=ty2; S.dir=dir; S.ox=0; S.oy=0; S.mv=null;
    S.banner=120; S.bannerTxt=SCENES[to].name; S.lastBattle=S.steps-4;
    S.still=0; S.guest=null; S.fx=null;
    sceneThought(to);
    maybeFriendVisit(to);
  });
}
