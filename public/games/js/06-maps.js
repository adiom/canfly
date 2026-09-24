"use strict";
/* ---------- 6. КАРТЫ ---------- */
const MAPSRC = {
town1: [
"TTTTTTTTTTTTTTTTTTTT","T..F............F..T","T.RRRR....RRRR.....T","T.RRRR....RRRR.....T",
"T.HHDH....HHDH.....T","T...P.......P......T","T...P..ww...P...S..T","TRRRP..ww...P......T",
"T...PPPPPPPPP......T","TCCBP.......P......T","TCC.P...RRRRP......T","T...P...RRRRP......T",
"T...P...HHDHP......T","T...P.F...P.P....F.T","T...PPPPPPPPPPPP...T","T......PP..........T",
"T.F....PP.....F....T","TTTTTTT..TTTTTTTTTTT"],
field: [
"MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM","M,,,,,,,,,,,,,,,,,,,,,,,,#,,,,,,,,,,,,,M",
"M,,,,,,,TT,,,,,,,,,,,,,,#.X#####,,,,,,,M","M,,,,##,,,,,,,,,,,,,T,,,#.######,,,,,,,M",
"M,T,,,,,,,,,,,,#,,,,,,,,#.#####,,,,,#,,M","M,,,,,,,,,,,,,,,,,,,,,,,,.#####,,,,,,,,M",
"M,,,,,,,,,,,,,,,,,,,,,,,,.#####,,,,,,,,M","M,,S,,,,,,,,,,,,,,,,,,,,,.,,,,,,,,,,,,,M",
"PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP","PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP",
"M,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,M","M,,,,,,,,,,,,,T,,,,,,,,,,,,,,,,,,,,T,,,M",
"M,,#,,,,,,,,,,,,,,,,,,#,,,,,,,,,,,,,,,,M","M,,,,,,,,,,##,,,,,,,,,,,,,,,,,,,,#,,,,,M",
"M,,,,,,,,,,,,,,,,,#,,,,,,T,,,,,T,,,,,,,M","M,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,M",
"M,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,M","MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM"],
forest: [
"TTTTTTTTTPPTTTTTTTTT","T........PP........T","T........PP........T","T..TT....PP........T",
"T..T.....PP....TT..T","T......F.PP........T","T........PP.F......T","T.#......PP........T",
"T.....T..PP......#.T","T........PP..T.....T","T........PPF.......T","T......S.PP........T",
"T..T.....PP.....T..T","T........PPPPPPPPPPP","T........PPPPPPPPPPP","T........PP........T",
"T....T...PP........T","T.#......PP...T....T","T.....F..PP......#.T","T........PP........T",
"T...TT...PP..F.....T","T........PP....TT..T","T.......FPP........T","T........PP........T",
"T........PP........T","TTTTTTTTTPPTTTTTTTTT"],
cave: [
"cccccccccccccccccccc","cccccccccccccccccccc","ccccccccccYccccccccc","cccccccccccccccccccc",
"ccfffffffAffffffffcc","ccfffffffffffcccffcc","ccffccfffffffcccffcc","ccffccffffffffffffcc",
"ccffccffffffffffffcc","ccffffffffffffffffcc","ccffffffcccfffffffcc","ccffffffcccffffccfcc",
"ccfff~fffffffffccfcc","ccfff~~ffffffffccfcc","cccccccccffccccccccc","cccccccccffccccccccc",
"cccccccccffccccccccc","cccccccccffccccccccc"],
bridge: [
"~~~~~~~~~~~~~~~~~~~~","~~~~~~~~~~~~~~~~~~~~","~~~~~~~~~~~~~~~~~~~~","~~~~~~~~~~~~~~~~~~~~",
"~~~~~~~~~~~~~~~~~~~~","~~~~~~~#~~~~~~~~~~~~","~~~~~~~~~~~~~~~~~~~~","..S.~~~~~~~~~~~~....",
"=..==============..=","=..==============..=","....~~~~~~~~~~~~....","~~~~~~~~~~~~~~~~~~~~",
"~~~~~~~~~~~~#~~~~~~~","~~~~~~~~~~~~~~~~~~~~","~~~~~~~~~~~~~~~~~~~~","~~~~~~~~~~~~~~~~~~~~",
"~~~~~~~~~~~~~~~~~~~~","~~~~~~~~~~~~~~~~~~~~"],
rain: [
"TTTTTTTTTTTTTTTTTTTT","T.......KKKK.......T","T.......KKKK.......T","T.RRRR..KKKK......FT",
"T.RRRR..KKLK.......T","T.HHDH....P........T","T.....F...P.ww...F.T","T.........P.ww...#.T",
"PPPPPPPPPPPPPPPPPPPT","PPPPPPPPPPPPPPPPPPPT","T......F......RRRR.T","T..S..........RRRR.T",
"T.............HHDH.T","T......#...........T","T..........#.......T","T.....F......F.....T",
"T..................T","TTTTTTTTTTTTTTTTTTTT"],
home: [
"HHHHHHHHHHHHHHHHHHHH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HibbbiiiiiiiibbbiiiH",
"HibbbiiiiiiiibbbiiiH",
"HibbbiiiiiiiibbbiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiCCCCiiiiiiiH",
"HiiiiiiiCCCCiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiDiiiiiiiiiH",
"HHHHHHHHHHHHHHHHHHHH"],
inn: [
"HHHHHHHHHHHHHHHHHHHH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiCCCCCCCCCCCCCCiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiCCiiiiiiiCCiiiiH",
"HiiiCCiiiiiiiCCiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiiiiiiiiiiiH",
"HiiiiiiiiDiiiiiiiiiH",
"HHHHHHHHHHHHHHHHHHHH"]
};
const MAPS = {};
for(const k in MAPSRC) MAPS[k] = MAPSRC[k].map(function(r){ return r.split(''); });
const SOLID = ['T','M','R','H','D','C','B','S','w','c','A','K','L','~','b'];
function isSolidCh(ch){ return SOLID.indexOf(ch)>=0; }
