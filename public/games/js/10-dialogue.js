"use strict";
/* ---------- 10. ДИАЛОГИ И МЫСЛИ ---------- */
function say(pages,cb,back){
  S.still=0; S.mode='dialog';
  S.dlg={pages:mkPages(pages),i:0,ch:0,cb:cb||null,back:back||null,ci:0};
}
function sayThought(list){
  S.still=0; S.mode='dialog';
  S.dlg={pages:mkPages(list),i:0,ch:0,cb:null,back:'world',ci:0,thought:true};
}
function dlgPage(){ return S.dlg ? S.dlg.pages[S.dlg.i] : null; }
function dlgLen(){ const p=dlgPage(); return (p&&p.lines)? p.lines.join('').length : 0; }
function updDialog(){
  const d=S.dlg; if(!d) return;
  const p=dlgPage();
  if(!p||!p.lines){ closeDialog(); return; }
  const total=dlgLen();
  if(d.ch<total){
    if(S.holdA>10) d.ch=total;
    else { d.ch += d.thought?5:2; if(d.ch%3===0) SFX.blip(); }
  }
  if(A()){
    if(d.ch<total){ d.ch=total; return; }
    if(p.choices){
      if(p.onPick){
        const nx=p.onPick(d.ci);
        if(nx && nx.length){ d.pages=mkPages(nx); d.i=0; d.ch=0; d.ci=0; return; }
      }
      closeDialog(); return;
    }
    SFX.blip(); d.i++; d.ch=0;
    if(d.i>=d.pages.length) closeDialog();
    return;
  }
  if(p.choices){
    if(hit('up')){ d.ci=(d.ci+p.choices.length-1)%p.choices.length; SFX.blip(); }
    if(hit('down')){ d.ci=(d.ci+1)%p.choices.length; SFX.blip(); }
  }
}
function closeDialog(){
  const cb=S.dlg?S.dlg.cb:null, back=S.dlg?S.dlg.back:null;
  S.dlg=null; S.mode=back||'world';
  if(cb) cb();
}
function arrow(x,y,col){
  G.fillStyle=col||pal()[3];
  G.fillRect(x,y,5,1); G.fillRect(x+1,y+1,3,1); G.fillRect(x+2,y+2,1,1);
}
function box(x,y,w,h){
  const P=pal();
  G.fillStyle=P[0]; G.fillRect(x,y,w,h);
  G.fillStyle=P[3]; G.fillRect(x,y,w,1); G.fillRect(x,y+h-1,w,1); G.fillRect(x,y,1,h); G.fillRect(x+w-1,y,1,h);
  G.fillStyle=P[1]; G.fillRect(x+1,y+1,w-2,1); G.fillRect(x+1,y+h-2,w-2,1);
}
function boxThought(x,y,w,h){
  const P=pal();
  G.fillStyle=P[3]; G.fillRect(x,y,w,h);
  G.fillStyle=P[1]; G.fillRect(x,y,w,1); G.fillRect(x,y+h-1,w,1); G.fillRect(x,y,1,h); G.fillRect(x+w-1,y,1,h);
  G.fillStyle=P[2]; G.fillRect(x+1,y+1,w-2,1);
}
function drawDialog(){
  const d=S.dlg; if(!d) return;
  const p=dlgPage(); if(!p||!p.lines) return;
  const th=!!d.thought, ink=th?pal()[0]:pal()[3];
  if(th) boxThought(4,96,152,48); else box(0,96,160,48);
  let left=d.ch;
  for(let l=0;l<p.lines.length;l++){
    const line=p.lines[l];
    const shown=line.slice(0,Math.max(0,left));
    left-=line.length;
    tx(G,shown,th?10:6,103+l*9,ink);
  }
  if(p.choices){
    for(let i=0;i<p.choices.length;i++){
      const y=112+i*9;
      tx(G,p.choices[i],116,y,ink);
      if(i===d.ci && (S.tick>>3)%2===0) tx(G,'>',110,y,ink);
    }
  } else if(d.ch>=dlgLen() && (S.tick>>3)%2===0){ arrow(148,134,ink); }
}
