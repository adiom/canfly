"use strict";
/* ---------- 21. ОТРИСОВКА МИРА ---------- */
function camPos(){
  const m=MAP(), mw=m[0].length, mh=m.length;
  const cx=S.px*TS+S.ox+4, cy=S.py*TS+S.oy+4;
  return {
    x: mw*TS<=W?0:clamp(Math.floor(cx-W/2),0,mw*TS-W),
    y: mh*TS<=H?0:clamp(Math.floor(cy-H/2),0,mh*TS-H)
  };
}
function drawWorld(){
  const sc=SCENES[S.scene], m=MAP(), cam=camPos(), P=pal();
  const wfr=(S.tick>>5)%2;
  const x0=Math.floor(cam.x/TS), y0=Math.floor(cam.y/TS);
  for(let ty=y0;ty<y0+19;ty++){
    for(let txx=x0;txx<x0+21;txx++){
      if(ty<0||ty>=m.length||txx<0||txx>=m[0].length) continue;
      const ch=m[ty][txx];
      let art=ch;
      if(ch==='X') art=sc.xArt;
      else if(ch==='Y') art='f';
      else if(ch==='A'&&S.flags.candleLit) art='A2';
      const fr=(ch==='~')?wfr:0;
      G.drawImage(tileImg(ch,PH,fr,art), txx*TS-cam.x, ty*TS-cam.y);
    }
  }
  const dr=[];
  for(let i=0;i<sc.npcs.length;i++) dr.push({y:sc.npcs[i].y,n:sc.npcs[i]});
  if(S.guest) dr.push({y:S.guest.y,gs:S.guest});
  dr.push({y:S.py,me:1});
  dr.sort(function(a,b){ return a.y-b.y; });
  for(let i=0;i<dr.length;i++){
    const it=dr[i];
    if(it.n){
      const n=it.n;
      const gap=(n.spr==='girl'&&!S.flags.pixelReturned&&!MEM.returnedPixel);
      G.drawImage(charImg(n.spr,n.dir,0,PH,gap),n.x*TS-cam.x-4,n.y*TS-cam.y-11);
    } else if(it.gs){
      const gs=it.gs;
      let al=1;
      if(gs.t<26) al=gs.t/26;
      if(gs.t>gs.ttl-46) al=Math.max(0,(gs.ttl-gs.t)/46);
      G.globalAlpha=al;
      if(gs.big) G.drawImage(enemyImg(gs.spr,(S.tick>>5)%2,PH),gs.x*TS-cam.x-8,gs.y*TS-cam.y-14,24,24);
      else G.drawImage(charImg(gs.spr,gs.dir,0,PH,false),gs.x*TS-cam.x-4,gs.y*TS-cam.y-11);
      G.globalAlpha=1;
    } else {
      const fr=S.mv?((Math.floor(S.anim/6)%2)):0;
      let bx=0,by=0;
      if(S.bump>0){ bx=DX[S.dir]*((S.bump%2)?1:0); by=DY[S.dir]*((S.bump%2)?1:0); }
      G.drawImage(charImg('traveler',S.dir,fr,PH,false),S.px*TS+S.ox-cam.x-4+bx,S.py*TS+S.oy-cam.y-11+by);
    }
  }
  drawFx(cam);
  if(S.scene==='field'&&!S.flags.key){
    const gx=26*TS-cam.x, gy=2*TS-cam.y;
    if(gx>-8&&gx<W&&gy>-8&&gy<H&&((S.tick>>3)%2===0)){ G.fillStyle=P[0]; G.fillRect(gx+3,gy+3,2,2); G.fillRect(gx+2,gy+4,1,1); }
  }
  if(S.scene==='cave'&&S.flags.candleLit&&!S.flags.pixel){
    const gx=10*TS-cam.x, gy=2*TS-cam.y;
    if(gx>-8&&gx<W&&gy>-8&&gy<H&&((S.tick>>3)%2===0)){ G.fillStyle=PINK; G.fillRect(gx+3,gy+3,2,2); }
  }
  if(S.still>90 && (S.still%60)<30 && !S.guest && S.mode==='world'){
    G.fillStyle=P[1]; G.fillRect(S.px*TS+S.ox-cam.x+3,S.py*TS+S.oy-cam.y-14,1,1);
  }
  if(S.banner>0 && (S.banner>90||((S.banner%8)<4))){
    const w=Math.max(40,txW(S.bannerTxt)+16);
    box(2,2,w,16); tx(G,S.bannerTxt,10,7,P[3]);
  }
  if(S.toastT>0){
    const w2=Math.max(40,txW(S.toast)+16);
    box(2,H-18,w2,16); tx(G,S.toast,10,H-13,pal()[3]);
  }
}
