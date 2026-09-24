"use strict";
/* ---------- 11. ВРЕМЯ СУТОК ---------- */
function setTime(t,silent){ PH=((t%4)+4)%4; if(!silent) toast(PHASE[PH]); }
function toast(t){ S.toast=t; S.toastT=110; }
