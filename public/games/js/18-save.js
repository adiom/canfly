"use strict";
/* ---------- 18. СОХРАНЕНИЕ ---------- */
const SLOT='stillroad_save_v1';
function saveData(){
  return {v:2,scene:S.scene,x:S.px,y:S.py,dir:S.dir,hp:S.hp,lv:S.lv,exp:S.exp,gold:S.gold,
    items:S.items.slice(),flags:Object.assign({},S.flags),tod:PH,cnt:S.saveCount,steps:S.steps,
    journal:S.journal.slice()};
}
function readSave(){ try{ const r=STORE.getItem(SLOT); return r?JSON.parse(r):null; }catch(e){ return null; } }
function writeSave(){ try{ STORE.setItem(SLOT,JSON.stringify(saveData())); return true; }catch(e){ return false; } }
function applySave(d){
  S.scene=d.scene; S.px=d.x; S.py=d.y; S.dir=d.dir||0; S.hp=d.hp; S.lv=d.lv; S.exp=d.exp;
  S.gold=d.gold; S.items=d.items||[]; S.flags=d.flags||{}; S.saveCount=d.cnt||0; S.steps=d.steps||0;
  S.journal=d.journal||[]; S.jI=0; S.still=0; S.guest=null; S.fx=null; S.cd={};
  PH=d.tod||1; S.ox=0; S.oy=0; S.mv=null;
  if(S.flags.candleLit) MAPS.cave[3][10]='f';
  if(S.flags.tower) MAPS.rain[4][10]='O';
  S.mode='world'; S.banner=120; S.bannerTxt=SCENES[S.scene].name;
}
function slotLabel(){
  const d=readSave();
  if(!d) return 'СЛОТ 1: ПУСТО';
  const sc=SCENES[d.scene]?SCENES[d.scene].name:'?';
  return 'СЛОТ 1: УР.'+d.lv+' '+sc+((d.flags&&d.flags.corrupted)?' (ПОВРЕЖДЁН)':'');
}
function willCorrupt(){
  if(S.flags.corrupted) return false;
  if(S.scene==='cave' && PH===3) return true;
  if(S.saveCount>=2) return true;
  return false;
}
function doSave(){ S.mode='saving'; S.svT=0; S.svBad=willCorrupt(); }
function finishSave(){
  if(S.svBad){
    S.flags.corrupted=true; S.saveCount++;
    remember('sawCorrupt',true); MEM.corruptCount++; saveMem();
    jot('ЧТО-ТО СЛОМАЛОСЬ, КОГДА Я ПЫТАЛАСЬ ЗАПОМНИТЬ СЕБЯ. Я НЕ ЗЛЮСЬ. Я ПРОСТО ЗАБУДУ.',true);
    forgetSomething();
    S.mode='error'; S.errT=0; SFX.err();
  } else {
    writeSave(); S.saveCount++; SFX.save();
    say(['СОХРАНЕНО. ДОРОГА ЗАПОМНИЛА ТЕБЯ.','СЛОТ ОДИН. ДРУГОГО НЕТ. АВТОСОХРАНЕНИЯ ТОЖЕ.'],null,'world');
  }
}
