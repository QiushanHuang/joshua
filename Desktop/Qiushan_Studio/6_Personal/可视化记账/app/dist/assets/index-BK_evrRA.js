(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))i(e);new MutationObserver(e=>{for(const t of e)if(t.type==="childList")for(const n of t.addedNodes)n.tagName==="LINK"&&n.rel==="modulepreload"&&i(n)}).observe(document,{childList:!0,subtree:!0});function l(e){const t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?t.credentials="include":e.crossOrigin==="anonymous"?t.credentials="omit":t.credentials="same-origin",t}function i(e){if(e.ep)return;e.ep=!0;const t=l(e);fetch(e.href,t)}})();function a(){const r=document.createElement("div");return r.dataset.appShell="true",r.innerHTML=`
    <div class="app-shell">
      <header class="app-shell__header">Asset Tracker Foundation</header>
      <main class="app-shell__main">
        <p data-role="boot-status">Loading local book...</p>
        <div id="app-root"></div>
      </main>
    </div>
  `,r}function c(r){r.innerHTML="",r.appendChild(a())}const s=document.getElementById("app");if(!s)throw new Error("Missing #app mount node");c(s);
