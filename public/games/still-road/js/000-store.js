"use strict";
/* ---------- 0.0 ХРАНИЛИЩЕ (localStorage / нативный мост macOS) ---------- */
/* В браузере — обычный localStorage. В WKWebView-обёртке — мост:
   чтение из снимка window.__STILL_STORE__ (инжектится нативом на старте),
   запись — через webkit.messageHandlers.stillStore. */
const STORE = (function(){
  const bridge = (typeof window!=='undefined' && window.webkit && window.webkit.messageHandlers &&
                  window.webkit.messageHandlers.stillStore) ? window.webkit.messageHandlers.stillStore : null;
  if(!bridge){
    return {
      getItem(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
      setItem(k,v){ try{ localStorage.setItem(k,String(v)); }catch(e){} }
    };
  }
  const snap = (typeof window.__STILL_STORE__==='object' && window.__STILL_STORE__) || {};
  return {
    getItem(k){ return Object.prototype.hasOwnProperty.call(snap,k) ? snap[k] : null; },
    setItem(k,v){ snap[k]=String(v); try{ bridge.postMessage({key:String(k),value:String(v)}); }catch(e){} }
  };
})();
