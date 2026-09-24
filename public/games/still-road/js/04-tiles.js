"use strict";
/* ---------- 4. ТАЙЛЫ 8×8 ---------- */
function rndSeq(seed){ let s=((seed*2654435761)>>>0)||1; return ()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; }; }
const tileCache = {};
function tileImg(ch,ph,fr,art){
  const key = ch+'|'+ph+'|'+(fr||0);
  if(tileCache[key]) return tileCache[key];
  const c = document.createElement('canvas'); c.width=8; c.height=8;
  const g = c.getContext('2d');
  tileArt(g, art||ch, PALS[ph], fr||0);
  tileCache[key]=c; return c;
}
function tileArt(g,ch,P,fr){
  const fill=c=>{g.fillStyle=c;g.fillRect(0,0,8,8);};
  const px=(x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x,y,w,h);};
  const dots=(c,n,seed)=>{const r=rndSeq(seed);g.fillStyle=c;for(let i=0;i<n;i++)g.fillRect(Math.floor(r()*8),Math.floor(r()*8),1,1);};
  const ground=()=>{fill(P[1]);dots(P[2],7,11);dots(P[0],4,29);};
  switch(ch){
    case '.': ground(); break;
    case ',':
      fill(P[2]);
      for(let x=0;x<8;x+=2) px(x,3+((x>>1)%2),1,5,P[3]);
      for(let x=1;x<8;x+=2) px(x,2+(x%3?0:1),1,4,P[1]);
      px(0,7,8,1,P[3]); break;
    case 'P': fill(P[0]); dots(P[1],9,7); dots(P[2],4,17); break;
    case 'T':
      ground(); px(3,6,2,2,P[3]);
      px(1,0,6,6,P[3]); px(0,1,8,4,P[3]);
      px(1,1,6,4,P[2]); px(2,0,4,1,P[2]); px(2,5,4,1,P[2]);
      px(2,1,2,1,P[1]); px(4,2,1,1,P[1]); px(5,3,1,1,P[1]); break;
    case 'M':
      fill(P[2]); px(0,0,8,2,P[1]); px(0,6,8,2,P[3]);
      px(1,2,2,1,P[3]); px(5,3,2,1,P[3]); px(2,4,3,1,P[3]); px(6,1,1,2,P[3]); break;
    case '#':
      ground(); px(1,2,6,6,P[3]); px(2,1,4,1,P[3]);
      px(2,2,4,4,P[2]); px(2,2,2,1,P[1]); px(3,3,1,1,P[1]); break;
    case 'F':
      ground(); px(3,5,1,3,P[2]); px(2,3,1,1,P[0]); px(4,3,1,1,P[0]);
      px(3,2,1,1,P[0]); px(3,4,1,1,P[0]); px(3,3,1,1,P[3]); break;
    case 'R':
      fill(P[3]); for(let y=1;y<8;y+=2) px(0,y,8,1,P[2]);
      px(2,0,1,8,P[3]); px(6,0,1,8,P[3]); px(0,0,8,1,P[1]); break;
    case 'H':
      fill(P[1]); px(0,2,8,1,P[2]); px(0,5,8,1,P[2]);
      px(3,0,1,2,P[2]); px(6,3,1,2,P[2]); px(1,6,1,2,P[2]); px(5,6,1,2,P[2]);
      px(0,7,8,1,P[3]); break;
    case 'D':
      fill(P[1]); px(0,2,8,1,P[2]); px(0,0,8,1,P[2]);
      px(2,1,4,7,P[3]); px(3,2,2,6,P[2]); px(4,5,1,1,P[0]); break;
    case 'C':
      fill(P[2]); px(0,0,8,2,P[1]); px(0,0,8,1,P[0]); px(0,6,8,2,P[3]);
      px(1,3,1,3,P[3]); px(6,3,1,3,P[3]); break;
    case 'B':
      ground(); px(2,1,4,7,P[3]); px(3,2,2,5,P[2]); px(2,3,4,1,P[3]); px(2,5,4,1,P[3]); break;
    case 'S':
      ground(); px(3,4,2,4,P[3]); px(1,1,6,4,P[3]); px(2,2,4,2,P[1]);
      px(2,2,3,1,P[2]); px(2,3,2,1,P[2]); break;
    case 'w':
      fill(P[2]); px(0,0,8,1,P[3]); px(0,7,8,1,P[3]); px(0,0,1,8,P[3]); px(7,0,1,8,P[3]);
      px(2,2,4,4,P[3]); px(3,3,2,2,P[1]); px(3,3,1,1,P[0]); break;
    case '~':
      fill(P[2]); dots(P[3],10,3);
      { const y1 = fr? 5:2, y2 = fr? 1:6;
        px(1,y1,2,1,P[1]); px(5,y1,2,1,P[1]); px(3,y2,2,1,P[0]); px(6,y2+1,1,1,P[1]); }
      break;
    case '=':
      fill(P[1]); px(0,0,8,1,P[3]); px(0,7,8,1,P[3]);
      px(1,1,1,6,P[3]); px(5,1,1,6,P[3]); px(2,2,3,1,P[2]); px(6,4,1,2,P[2]); break;
    case 'c':
      fill(P[3]); px(0,0,8,1,P[2]); px(0,4,8,1,P[2]);
      px(3,1,1,3,P[2]); px(6,5,1,3,P[2]); px(1,5,1,2,P[2]); dots(P[2],3,5); break;
    case 'f': fill(P[2]); dots(P[3],9,13); dots(P[1],3,23); break;
    case 'A':
      fill(P[2]); dots(P[3],6,9);
      px(1,4,6,4,P[3]); px(2,3,4,1,P[3]); px(2,4,4,2,P[2]); px(3,2,2,1,P[1]); break;
    case 'A2':
      fill(P[2]); dots(P[3],6,9);
      px(1,4,6,4,P[3]); px(2,3,4,1,P[3]); px(2,4,4,2,P[2]);
      px(3,1,2,2,P[0]); px(3,0,1,1,BLUE); px(4,1,1,2,BLUE); px(2,2,1,1,P[0]); break;
    case 'K':
      fill(P[2]); px(0,0,8,1,P[1]); px(0,3,8,1,P[3]); px(0,7,8,1,P[3]);
      px(2,1,1,2,P[3]); px(6,1,1,2,P[3]); px(4,4,1,3,P[3]); px(1,4,1,3,P[3]); break;
    case 'L':
      fill(P[2]); px(1,0,6,8,P[3]); px(2,1,4,7,P[1]); px(2,1,4,1,P[2]);
      px(4,4,1,2,P[3]); px(3,3,2,1,P[3]); break;
    case 'O':
      fill(P[2]); px(1,0,6,8,P[3]); px(2,1,4,7,P[3]); px(2,1,4,1,P[2]); px(3,2,2,6,P[2]); break;
    case 'i':
      fill(P[1]); px(0,0,8,1,P[2]); px(0,4,8,1,P[2]);
      px(2,1,1,3,P[2]); px(6,5,1,3,P[2]); break;
    case 'b':
      fill(P[3]); px(1,1,6,6,P[1]); px(1,1,6,2,P[0]); px(1,3,6,4,P[2]); break;
    default: ground();
  }
}
