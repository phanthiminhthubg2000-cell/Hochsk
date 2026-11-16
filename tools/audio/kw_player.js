/*KW-PLAYER*/(function(){
// Trình phát audio gốc bài khoá: phát/dừng, tua ±5 giây, kéo thanh thời gian, đổi tốc độ, bấm 🔊 đoạn nào nhảy tới đoạn đó
var L=window.LESSON||{},NUM=String(L.num||"").padStart(2,"0"),SRC="/audio/hsk6kw/"+NUM+".mp3",SEG=null,A=null,one=-1;
function fmt(s){s=Math.max(0,s|0);return (s/60|0)+":"+("0"+s%60).slice(-2)}
function css(){var st=document.createElement("style");st.textContent=".kwp{position:sticky;top:8px;z-index:20;display:flex;flex-wrap:wrap;align-items:center;gap:8px;background:var(--card,#fff);border:1px solid var(--line,#ddd);border-radius:14px;padding:10px 12px;margin:12px 0;box-shadow:0 4px 14px rgba(0,0,0,.08)}.kwp button{border:1px solid var(--line,#ccc);background:#fff;border-radius:999px;min-width:40px;height:40px;padding:0 12px;font-weight:700;cursor:pointer}.kwp .pp{background:var(--main,#9E2F22);color:#fff;border-color:transparent;min-width:52px;font-size:18px}.kwp input[type=range]{flex:1;min-width:140px;accent-color:var(--main,#9E2F22)}.kwp .tm{font:600 13px system-ui;min-width:86px;text-align:center}.kwp select{height:40px;border-radius:10px;border:1px solid var(--line,#ccc);padding:0 6px}.kwp .lb{font:700 12px system-ui;opacity:.7;width:100%}.para.kwon{background:rgba(158,47,34,.07);border-radius:12px;box-shadow:inset 4px 0 0 var(--main,#9E2F22)}";document.head.appendChild(st)}
function cur(t){if(!SEG)return -1;for(var i=SEG.length-1;i>=0;i--)if(t>=SEG[i][0]-0.05)return i;return -1}
function mark(i){document.querySelectorAll(".para.kwon").forEach(function(p){p.classList.remove("kwon")});if(i>=0){var p=document.querySelector('.para[data-p="'+i+'"]');if(p)p.classList.add("kwon")}}
function build(){
  var tools=document.querySelector("#s-text .ttools");if(!tools||document.querySelector(".kwp"))return false;
  css();A=new Audio(SRC);A.preload="metadata";
  var bar=document.createElement("div");bar.className="kwp";
  bar.innerHTML='<span class="lb">🎧 Audio gốc bài khoá (giáo trình)</span><button class="pp" data-k="pp" aria-label="Phát / dừng">▶</button><button data-k="b5" aria-label="Lùi 5 giây">−5s</button><input type="range" min="0" max="1000" value="0" aria-label="Tua"><button data-k="f5" aria-label="Tới 5 giây">+5s</button><span class="tm">0:00 / 0:00</span><select aria-label="Tốc độ"><option value="0.75">0.75×</option><option value="0.9">0.9×</option><option value="1" selected>1×</option><option value="1.15">1.15×</option></select>';
  tools.parentNode.insertBefore(bar,tools.nextSibling);
  tools.querySelectorAll('[data-act="readall"],[data-act="stop"]').forEach(function(b){b.style.display="none"});
  var pp=bar.querySelector(".pp"),rg=bar.querySelector("input"),tm=bar.querySelector(".tm"),sp=bar.querySelector("select"),drag=false;
  function upd(){var d=A.duration||0;if(!drag&&d)rg.value=A.currentTime/d*1000;tm.textContent=fmt(A.currentTime)+" / "+fmt(d);pp.textContent=A.paused?"▶":"⏸";var i=cur(A.currentTime);mark(A.paused&&A.currentTime===0?-1:i);if(one>=0&&SEG&&A.currentTime>=SEG[one][1]){A.pause();one=-1}}
  A.addEventListener("timeupdate",upd);A.addEventListener("play",upd);A.addEventListener("pause",upd);A.addEventListener("loadedmetadata",upd);A.addEventListener("ended",function(){mark(-1);upd()});
  bar.addEventListener("click",function(e){var k=e.target.dataset&&e.target.dataset.k;if(!k)return;try{speechSynthesis.cancel()}catch(_){}
    if(k==="pp"){if(A.paused){one=-1;if(SEG&&A.currentTime<SEG[0][0]-1)A.currentTime=SEG[0][0];A.play()}else A.pause()}
    if(k==="b5")A.currentTime=Math.max(0,A.currentTime-5);if(k==="f5")A.currentTime=Math.min(A.duration||1e9,A.currentTime+5);upd()});
  rg.addEventListener("input",function(){drag=true;var d=A.duration||0;tm.textContent=fmt(rg.value/1000*d)+" / "+fmt(d)});
  rg.addEventListener("change",function(){drag=false;var d=A.duration||0;if(d)A.currentTime=rg.value/1000*d;one=-1;upd()});
  sp.addEventListener("change",function(){A.playbackRate=+sp.value});
  // 🔊 Đọc của từng đoạn → phát đúng đoạn đó bằng audio gốc
  document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("[data-psay]");if(!b||!SEG)return;var i=+b.getAttribute("data-psay");if(!SEG[i])return;
    e.stopPropagation();e.preventDefault();try{speechSynthesis.cancel()}catch(_){}A.currentTime=SEG[i][0];one=i;A.playbackRate=+sp.value;A.play();bar.scrollIntoView({block:"nearest"})},true);
  window.__kwStop=function(){if(A)A.pause()};
  return true;
}
fetch("/audio/hsk6kw/timings.json").then(function(r){return r.json()}).then(function(t){if(!t[NUM])return;SEG=t[NUM].seg;
  var n=0,iv=setInterval(function(){if(build()||++n>60)clearInterval(iv)},250)}).catch(function(){});
})();
