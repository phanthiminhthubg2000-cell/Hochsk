/* HSK GARDEN · Phòng thi HSKK (giao diện kiểu Hanban/CTI). Dữ liệu đề: window.EXAM */
(function () {
  "use strict";
  const E = window.EXAM;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const mmss = t => { t = Math.max(0, Math.ceil(t)); return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); };
  const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  const SUBJ = `HSK（${CN[E.level]}级）口语`;
  const PAPER = E.sub || "样卷";
  const URLQ = new URLSearchParams(location.search);
  const EMBED = window.parent !== window;
  const CIRC = ["❶", "❷", "❸", "❹", "❺", "❻"];

  /* ---------- các bước theo file nghe ---------- */
  const S = [];
  { let wi = 0; E.timeline.forEach(t => { if (t.t === "play") S.push({ t: "play", a: t.a, b: t.b }); else { const w = E.windows[wi++]; if (w) S.push(Object.assign({ t: "win", d: t.d }, w)); } }); }
  for (let i = S.length - 1, nx = null; i >= 0; i--) { if (S[i].t === "win") nx = S[i]; else S[i].next = nx; }
  const keyOfWin = w => w.k === "intro" ? "intro" : w.k === "prep" ? "p" + w.part : "q" + w.q;
  let lastKey = "intro";
  S.forEach(s => { const w = s.t === "win" ? s : s.next; s.key = w ? keyOfWin(w) : lastKey; s.win = w || null; lastKey = s.key; if (s.key !== "intro") s.part = w ? w.part : S.filter(x => x.t === "win").pop().part; });
  const ITEMS = []; // mục ở cột trái
  E.windows.forEach(w => { if (w.k === "intro") return; const k = keyOfWin(w); if (!ITEMS.some(x => x.key === k)) ITEMS.push({ key: k, part: w.part, q: w.q, prep: w.k === "prep" }); });
  const ORDER = ["intro", ...ITEMS.map(x => x.key)];
  const partHasPrep = p => E.windows.some(w => w.k === "prep" && w.part === p);
  const partQs = p => [...new Set(E.windows.filter(w => w.k === "ans" && w.part === p).map(w => w.q))];
  const totalDur = S.reduce((a, s) => a + (s.t === "play" ? s.b - s.a : s.d), 0);

  /* ---------- trạng thái ---------- */
  const R = { i: -1, name: "", email: "", gender: "男", nat: "越南", practice: false, paused: false, stream: null, rec: null, chunks: [], recs: {}, timer: null, left: 0, mime: "", vol: 1, big: false, running: false, submitted: false, sent: false, testBlob: null };
  const A = new Audio(E.audio); A.preload = "auto"; window.__A = A;
  const DR = {}; // nháp theo phần

  /* ---------- khung trang ---------- */
  const BRAND = `<div class="brand"><span class="lg">汉</span><span class="tx">HSK GARDEN · HÀNH TRÌNH HSK<small>汉语水平模拟考试系统</small></span></div>`;
  const FOOT = `<div class="foot">HSK GARDEN · 新版HSK（3.0）模拟考试</div>`;
  const NOTICE = [
    "本考试为<b>口语考试</b>，全程录音，请佩戴耳机并在安静的环境中作答。",
    "考试开始后，录音自动播放，<b>不能暂停、不能返回</b>，请按提示作答。",
    "听到“嘀”声后开始回答，屏幕显示“<b>录音中</b>”时系统正在录音。",
    "每题作答时间到后，系统自动进入下一题；第三部分有准备时间，可以使用草稿区。",
    "考试结束后，录音自动提交给老师评分，请不要关闭或刷新页面。",
    "<span style=\"color:#888\">Bài thi nói: đeo tai nghe, cho phép trình duyệt dùng micro; đề chạy liên tục theo file nghe, hết giờ tự sang câu sau và tự nộp khi xong.</span>"
  ].map((t, i) => `<p>${i + 1}. ${t}</p>`).join("");

  document.title = `${SUBJ} · ${PAPER} · HSK GARDEN`;
  document.body.innerHTML = `
<div class="deco l">杰出英才<br>智成大路</div><div class="deco r">桃花潭水<br>春闻上谱</div>
<section class="scr" id="sLogin"><div class="clock"></div>${BRAND}
  <div class="wrapC"><div class="panel">
    <div class="notice"><h3>考场须知<label><input type="checkbox" id="nRead"><span>我已阅读</span></label></h3><div>${NOTICE}</div></div>
    <form class="login" id="loginForm" autocomplete="on" onsubmit="return false">
      <h3><span>🔒</span><span>考生登录</span></h3>
      <div class="frow"><span>姓名</span><input id="fName" name="name" maxlength="60" placeholder="Họ tên"></div>
      <div class="frow"><span>邮箱</span><input id="fMail" name="email" type="email" maxlength="80" placeholder="Email (không bắt buộc)"></div>
      <div class="frow"><span>性别</span><select id="fGender"><option>男</option><option>女</option></select></div>
      <div class="frow"><span>国籍</span><input id="fNat" maxlength="40" value="越南"></div>
      <div class="frow"><span>考试科目</span><select id="fSubj"></select></div>
      <div class="frow paperpick on"><span>试卷</span><select id="fPaper"></select></div>
      <label class="prow"><input type="checkbox" id="fPrac"><span>练习模式</span><small>Luyện tập: được tạm dừng, nghe lại, bỏ qua</small></label>
      <div class="lerr" id="lErr"></div>
      <div class="lbtns"><button class="btn" type="button" id="btnLogin">登 录</button>${EMBED && !E.back ? "" : '<button class="btn g" type="button" id="btnBack">返 回</button>'}</div>
    </form>
  </div></div>${FOOT}
</section>
<section class="scr hide" id="sMic"><div class="clock"></div>${BRAND}
  <div class="wrapC" style="max-width:1100px"><div class="panel" style="display:block;min-height:0"><span class="ptag">麦克风调试</span>
    <p style="text-align:center;font-size:17px;margin:0;padding:44px 20px 0">请点击“录音”，对着麦克风说：<b>“我叫……，我是……国人。”</b>然后点击“播放”，检查录音是否清楚。</p>
    <p style="text-align:center;color:#888;font-size:13px;margin:6px 0 0">Bấm 🎙 để ghi âm thử (tự dừng sau 6 giây), rồi bấm ▶ “播放” nghe lại. Nghe rõ thì bấm “下一步”.</p>
    <div class="mic">
      <div class="mlv" id="mLv"><i></i></div>
      <div class="c"><div style="display:flex;align-items:center;gap:8px"><button class="rb small" type="button" id="bPlus">+</button><button class="rb" type="button" id="bTry">▶</button><button class="rb small" type="button" id="bMinus">−</button></div><span>试听</span></div>
      <div class="c"><button class="rb big" type="button" id="bRec">🎙</button><span id="lRec">录音</span></div>
      <div class="c"><button class="rb" type="button" id="bPb">▶</button><span>播放</span></div>
    </div>
    <div class="micmsg" id="micMsg"></div>
    <div style="text-align:center;padding:10px 0 34px"><button class="btn" type="button" id="btnMicNext" disabled>下一步</button><br><button class="linkbtn hide" type="button" id="btnNoMic">Không dùng được micro — vẫn vào thi (không ghi âm)</button></div>
  </div></div>${FOOT}
</section>
<section class="scr hide" id="sIntro"><div class="clock"></div>${BRAND}
  <div class="wrapC" style="max-width:1000px"><div class="panel" style="padding:50px 6% 34px"><span class="ptag">考试说明</span>
    <h2 style="text-align:center;margin:0 0 4px;font-size:26px">${SUBJ}</h2>
    <p style="text-align:center;color:#777;margin:0 0 16px">${esc(PAPER)} · 全部考试约${Math.round(totalDur / 60)}分钟</p>
    <table class="st3"><tr><th>部分</th><th>题型</th><th>题量</th><th>作答时间</th></tr>${E.parts.map((p, i) => { const r = (E.struct || [])[i] || []; return `<tr><td>${p.cn}</td><td>${esc(p.title.split("：").pop())}</td><td>${partQs(i).length}题</td><td>${esc(cnTime(i))}</td></tr>`; }).join("")}</table>
    <div id="iStat"></div>
  </div></div>${FOOT}
</section>
<section class="scr hide" id="sExam">${BRAND.replace('class="brand"', 'class="brand" style="margin-left:max(18px,calc(50vw - 612px))"')}
  <div class="ex">
    <nav class="nav" id="nav"></nav>
    <main class="main">
      <div class="mhead"><span class="ttl" id="mTtl"></span><div class="tm"><b id="tmTxt"></b><div class="pg"><i id="tmBar"></i></div></div></div>
      <div class="mbody" id="mBody"></div>
    </main>
    <aside class="side">
      <div class="cand" id="cand"></div>
      <div class="sbtns" id="sbtns"></div>
    </aside>
  </div>
  <div class="foot">HSK GARDEN · 新版HSK（3.0）模拟考试 · 仅供学习练习使用</div>
</section>
<section class="scr hide" id="sEnd"><div class="clock"></div>${BRAND}
  <div class="wrapC" style="max-width:900px"><div class="panel" style="padding:50px 6% 40px"><span class="ptag">考试结束</span><div class="upl" id="upl"></div></div></div>${FOOT}
</section>
<section class="scr hide" id="sRes">${BRAND}
  <div class="res" style="max-width:1000px"><div class="panel" style="padding:44px 6% 30px"><span class="ptag">作答回顾</span><div id="resBody"></div></div></div>${FOOT}
</section>
<div class="mask hide" id="mask"><div class="dlg"><div class="dh"><b id="dlgT"></b><button type="button" id="dlgX">×</button></div><div class="db" id="dlgB"></div><div class="dbtns"><button class="btn sm g" type="button" id="dlgOk">确定</button></div></div></div>`;

  function cnTime(pi) {
    const p = E.parts[pi]; if (p.time) return p.time.replace(/[（）()]/g, "");
    const prep = E.windows.findIndex(w => w.k === "prep" && w.part === pi);
    let pd = 0; { let wi = 0; E.timeline.forEach(t => { if (t.t === "win") { if (wi === prep) pd = t.d; wi++; } }); }
    const each = p.ask && p.ask[0] ? p.ask[0][2] : "";
    return (pd ? `准备${Math.round(pd / 60)}分钟，` : "") + (each ? `每题${each}` : "");
  }

  /* ---------- tiện ích ---------- */
  const show = id => $$(".scr").forEach(s => s.classList.toggle("hide", s.id !== id));
  setInterval(() => { const d = new Date(), p = n => String(n).padStart(2, "0"); const t = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; $$(".clock").forEach(c => c.textContent = t); }, 1000);
  function dialog(title, html, onOk) { $("#dlgT").textContent = title; $("#dlgB").innerHTML = html; $("#mask").classList.remove("hide"); const close = () => { $("#mask").classList.add("hide"); onOk && onOk(); }; $("#dlgX").onclick = close; $("#dlgOk").onclick = close; }
  async function getMic() {
    if (R.stream) return R.stream;
    if (!navigator.mediaDevices || !window.MediaRecorder) throw new Error("nosupport");
    R.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    R.mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
    startMeter(); return R.stream;
  }
  let LEVEL = 0, AC = null;
  const wake = () => { try { AC && AC.state === "suspended" && AC.resume(); } catch (_) { } };
  document.addEventListener("pointerdown", wake, true);
  function startMeter() {
    try {
      const ac = AC = new (window.AudioContext || window.webkitAudioContext)(), an = ac.createAnalyser();
      ac.createMediaStreamSource(R.stream).connect(an); an.fftSize = 512; const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(buf); let m = 0; for (const v of buf) m = Math.max(m, Math.abs(v - 128)); LEVEL = Math.min(1, m / 60);
        const ml = $("#mLv i"); if (ml && !$("#sMic").classList.contains("hide")) ml.style.width = LEVEL * 100 + "%";
        const bars = $$("#stat .lv i"); if (bars.length) bars.forEach((b, i) => { const k = LEVEL * (0.45 + 0.55 * Math.abs(Math.sin(Date.now() / 140 + i * 1.7))); b.style.height = Math.max(4, Math.round(4 + k * 26)) + "px"; });
        requestAnimationFrame(loop);
      }; loop();
    } catch (_) { }
  }

  /* ---------- 1. đăng nhập ---------- */
  $("#fName").value = URLQ.get("name") || "";
  $("#fMail").value = URLQ.get("email") || "";
  (function subjects() {
    const self = (E.file || location.pathname.split("/").pop().replace(/\.html$/, ""));
    const fill = list => {
      const levels = [...new Set(list.map(e => Number(e.level)))].sort((a, b) => a - b);
      $("#fSubj").innerHTML = levels.map(l => `<option value="${l}" ${l === E.level ? "selected" : ""}>HSK（${CN[l]}级）口语</option>`).join("");
      const papers = lv => list.filter(e => Number(e.level) === lv);
      const fillP = lv => { $("#fPaper").innerHTML = papers(lv).map(e => { const f = e.file.split("/").pop().replace(/\.html$/, ""); return `<option value="${esc(e.file)}" ${f === self ? "selected" : ""}>${esc(e.title.split("·").pop().trim())}</option>`; }).join(""); };
      fillP(E.level);
      const go = file => { if (!file) return; const f = file.split("/").pop().replace(/\.html$/, ""); if (f === self) return; const q = new URLSearchParams(location.search); q.set("name", $("#fName").value.trim()); q.set("email", $("#fMail").value.trim()); location.href = file + "?" + q.toString(); };
      $("#fSubj").onchange = () => { fillP(Number($("#fSubj").value)); go($("#fPaper").value); };
      $("#fPaper").onchange = () => go($("#fPaper").value);
    };
    const own = [{ level: E.level, title: SUBJ + " · " + PAPER, file: location.pathname }];
    fill(own);
    if (/\/hskk-exam\//.test(location.pathname)) fetch("exams.json", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(l => { if (Array.isArray(l) && l.length) fill(l); }).catch(() => { });
  })();
  $("#btnBack") && ($("#btnBack").onclick = () => { if (E.back) location.href = E.back + location.search; else if (history.length > 1) history.back(); else location.href = "/"; });
  $("#btnLogin").onclick = () => {
    const err = m => $("#lErr").textContent = m;
    if (!$("#nRead").checked) return err("请先阅读考场须知并勾选“我已阅读”。· Hãy đọc và tích “我已阅读”.");
    R.name = $("#fName").value.trim(); if (!R.name) return err("请输入姓名。· Hãy nhập họ tên.");
    R.email = $("#fMail").value.trim(); R.gender = $("#fGender").value; R.nat = $("#fNat").value.trim() || "—"; R.practice = $("#fPrac").checked;
    err(""); show("sMic"); micInit();
  };

  /* ---------- 2. thử micro ---------- */
  function micMsg(t, cls) { const m = $("#micMsg"); m.textContent = t; m.className = "micmsg " + (cls || ""); }
  async function micInit() {
    try { await getMic(); wake(); micMsg("麦克风已连接，请点击“录音”。· Micro đã sẵn sàng.", "ok"); }
    catch (e) { micMsg(e.message === "nosupport" ? "浏览器不支持录音。· Trình duyệt không hỗ trợ ghi âm — hãy dùng Chrome/Edge/Safari mới." : "无法使用麦克风。· Chưa được phép dùng micro: bấm biểu tượng 🔒 trên thanh địa chỉ để cho phép, rồi tải lại trang.", "err"); $("#btnNoMic").classList.remove("hide"); }
  }
  let tryT = null;
  const tryPlay = () => { clearTimeout(tryT); A.volume = R.vol; A.currentTime = 0; A.play().catch(() => { }); tryT = setTimeout(() => A.pause(), 5000); };
  $("#bTry").onclick = tryPlay;
  $("#bPlus").onclick = () => { R.vol = Math.min(1, +(R.vol + .1).toFixed(1)); micMsg("音量 " + Math.round(R.vol * 100) + "%"); tryPlay(); };
  $("#bMinus").onclick = () => { R.vol = Math.max(.1, +(R.vol - .1).toFixed(1)); micMsg("音量 " + Math.round(R.vol * 100) + "%"); tryPlay(); };
  let testRec = null, testT = null;
  $("#bRec").onclick = async () => {
    if (testRec && testRec.state === "recording") { testRec.stop(); return; }
    try { await getMic(); } catch (_) { return micInit(); }
    A.pause(); const ch = [];
    testRec = new MediaRecorder(R.stream, R.mime ? { mimeType: R.mime } : {});
    testRec.ondataavailable = e => e.data && e.data.size && ch.push(e.data);
    testRec.onstop = () => { clearTimeout(testT); $("#bRec").classList.remove("on"); $("#lRec").textContent = "录音"; R.testBlob = new Blob(ch, { type: testRec.mimeType || R.mime || "audio/webm" }); micMsg("录音完成，请点击“播放”。· Bấm ▶ 播放 để nghe lại.", "ok"); };
    testRec.start(); $("#bRec").classList.add("on"); $("#lRec").textContent = "录音中…"; micMsg("正在录音，请说话……（6秒）", "err");
    testT = setTimeout(() => testRec.state === "recording" && testRec.stop(), 6000);
  };
  $("#bPb").onclick = () => {
    if (!R.testBlob) return micMsg("请先录音。· Hãy ghi âm thử trước.", "err");
    const a = new Audio(URL.createObjectURL(R.testBlob)); a.volume = R.vol;
    a.play().then(() => { micMsg("正在播放……如果能听清楚，请点击“下一步”。", "ok"); $("#btnMicNext").disabled = false; }).catch(() => micMsg("无法播放。", "err"));
  };
  const startExam = () => { wake(); clearTimeout(tryT); A.pause(); A.volume = R.vol; A.play().then(() => { A.pause(); next(); }).catch(() => next()); R.running = true; };
  $("#btnMicNext").onclick = startExam;
  $("#btnNoMic").onclick = () => { if (confirm("Không dùng được micro nên sẽ KHÔNG ghi âm câu trả lời. Vẫn vào thi?")) startExam(); };

  /* ---------- 3. vẽ phòng thi ---------- */
  function renderCand() {
    $("#cand").innerHTML = `<span class="av"></span><p>考试科目：${SUBJ}</p><p>试卷：${esc(PAPER)}</p><p>姓名：${esc(R.name)}</p>${R.email ? `<p>邮箱：${esc(R.email)}</p>` : ""}<p>性别：${esc(R.gender)}</p><p>国籍：${esc(R.nat)}</p>`;
    $("#sbtns").innerHTML = `<button type="button" id="bNotice">考场须知</button><button type="button" id="bTip">考试提示</button><button type="button" id="bVol">音量</button><button type="button" id="bFont">字体大小</button>` +
      (R.practice ? `<button type="button" class="pr" id="bPause">暂停</button><button type="button" class="pr" id="bReplay">重听</button><button type="button" class="pr" id="bSkip" style="grid-column:1/-1">跳过</button>` : "");
    $("#bNotice").onclick = () => dialog("考场须知", NOTICE);
    $("#bTip").onclick = () => { const s = S[R.i] || {}; const w = s.t === "win" ? s : s.win || {}; const p = E.parts[s.part] || {}; dialog("考试提示", `${p.note ? `<p><b>${esc(p.cn || "")}：</b>${esc(p.note)}</p>` : ""}${w.hint ? `<p><b>Gợi ý:</b> ${esc(w.hint)}</p>` : ""}<p style="color:#888">Đề chạy theo file nghe chuẩn: khi thấy “录音中” hãy nói to, rõ; hết giờ máy tự chuyển câu.</p>`); };
    $("#bVol").onclick = () => { dialog("音量", `<p>调节播放音量 · Âm lượng loa</p><input type="range" min="10" max="100" step="5" value="${Math.round(R.vol * 100)}" id="volR"><p id="volV" style="text-align:center">${Math.round(R.vol * 100)}%</p>`); $("#volR").oninput = e => { R.vol = e.target.value / 100; A.volume = R.vol; $("#volV").textContent = e.target.value + "%"; }; };
    $("#bFont").onclick = () => { R.big = !R.big; document.body.style.setProperty("--fs", R.big ? "17px" : "15px"); document.body.classList.toggle("bigf", R.big); };
    if (R.practice) { $("#bPause").onclick = togglePause; $("#bReplay").onclick = replay; $("#bSkip").onclick = skip; }
  }
  function renderNav(key) {
    const ci = ORDER.indexOf(key);
    const st = k => { const i = ORDER.indexOf(k); return i < ci ? "done" : i === ci ? "cur" : "lk"; };
    let h = `<div class="sh">开场</div><div class="it ${st("intro")}"><span>·</span>考生信息<span class="pen">${st("intro") === "done" ? "✓" : ""}</span></div>`;
    E.parts.forEach((p, pi) => {
      h += `<div class="pt"><span class="arr">▶</span>${esc(p.cn)} ${esc(p.title.split("：").pop())}</div>`;
      ITEMS.filter(x => x.part === pi).forEach(x => { const s = st(x.key); h += `<div class="it ${s}"><span>${x.prep ? "" : x.q}</span>${x.prep ? "准备时间" : `第${x.q}题`}<span class="pen">${s === "done" ? "✓" : ""}</span></div>`; });
    });
    $("#nav").innerHTML = h;
    const cur = $("#nav .it.cur"); if (cur && cur.scrollIntoView) { try { cur.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (_) { } }
  }
  function kindOf(p) { return p.ask ? "ask" : p.imgs ? (p.story ? "story" : "pic") : "listen"; }
  function renderCard(s) {
    const p = E.parts[s.part], kind = kindOf(p), w = s.win || {}, isPrep = w.k === "prep", q = w.q;
    const qs = partQs(s.part);
    const tag = isPrep ? (qs.length > 1 ? `${qs[0]}-${qs[qs.length - 1]}` : qs[0]) : q;
    const qno = isPrep ? "准备时间" : `第 ${q} 题`;
    let ins = "", mid = "";
    if (kind === "listen") { const rep = /复述/.test(p.title); ins = rep ? "请听一段话，然后复述你听到的内容。" : "请听录音，然后重复你听到的句子。"; mid = `<div class="ear">🎧</div>`; }
    else if (kind === "pic") { const idx = (p.qs || []).indexOf(q); ins = "请看图，用一两句话说一说图片的内容。"; mid = idx >= 0 ? `<img class="pic" src="${esc(p.imgs[idx])}" alt="">` : ""; }
    else if (kind === "story") { ins = isPrep ? "请看图片，准备按顺序讲一个完整的故事。可以在草稿区写下要点。" : "请看图片，按顺序讲一个完整的故事。"; mid = `<div class="pics">${p.imgs.map((src, i) => `<figure><span class="no">${CIRC[i] || i + 1}</span><img src="${esc(src)}" alt=""></figure>`).join("")}</div>`; }
    else { ins = isPrep ? "请阅读下面的问题，准备回答。可以在草稿区写下要点。" : `请回答第${q}题。`; mid = `<div class="qtext">${p.ask.map(a => `<div class="${!isPrep && a[0] === q ? "cur" : ""}"><b>${a[0]}.</b>${esc(a[1])} <small>（${esc(a[2])}）</small></div>`).join("")}</div>`; }
    const draft = p.draft && (kind === "ask" || kind === "story") ? `<div class="draftbox" data-dp="${s.part}"><div class="dhead"><b>草稿区</b><span>（不计分 · không chấm điểm）</span><span class="sp"></span><button type="button" data-dt="type" class="on">打字</button><button type="button" data-dt="draw">手写</button><button type="button" class="dclear">清除</button></div><textarea class="draft" placeholder="写下要点、关键词……"></textarea><canvas class="dcan hide"></canvas></div>` : "";
    $("#mBody").innerHTML = `<div class="qcard"><span class="qtag">${tag}</span><div class="oral"><div class="qno">${qno}</div><div class="ins">${ins}</div>${mid}<div class="phase" id="phase"></div><div id="stat"></div><p class="hint" id="hint"></p>${draft}</div></div>`;
    $("#mTtl").textContent = `${p.title.replace("：", "　")}（${cnTime(s.part)}）`.replace("（）", "");
    initDraft();
  }
  function renderPhase(s) {
    const steps = ["听题"]; const hp = partHasPrep(s.part) && kindOf(E.parts[s.part]) !== "pic" && kindOf(E.parts[s.part]) !== "listen"; if (hp) steps.push("准备"); steps.push("录音");
    const w = s.win || {}; let cur = !s.win ? steps.length : s.t === "play" ? 0 : w.k === "prep" ? 1 : steps.length - 1;
    if (s.t === "play" && hp && w.k === "ans" && E.parts[s.part].ask) cur = 0;
    $("#phase").innerHTML = steps.map((t, i) => `<div class="st ${i === steps.length - 1 ? "rec " : ""}${i < cur ? "done" : i === cur ? "on" : ""}">${["①", "②", "③"][i]} ${t}${i < cur ? " ✓" : i === cur && t === "录音" ? "中" : ""}</div>`).join("");
  }
  const WAVE = `<span class="wave"><i style="height:8px"></i><i style="height:18px"></i><i style="height:12px"></i><i style="height:22px"></i><i style="height:10px"></i></span>`;
  function renderStat(s) {
    const w = s.win || {};
    if (s.t === "play" && !s.win) {
      $("#stat").innerHTML = `<div class="listen">${WAVE}考试结束，请听结束语……</div>`;
      $("#hint").textContent = "录音将自动提交 · Bài sẽ tự nộp"; $("#tmTxt").textContent = "考试结束"; $("#tmTxt").className = "";
    } else if (s.t === "play") {
      $("#stat").innerHTML = `<div class="listen">${WAVE}${w.k === "prep" ? "请听说明……" : "正在播放题目……"}</div>`;
      $("#hint").textContent = w.k === "ans" ? "听到“嘀”声后开始回答" : w.k === "prep" ? "说明结束后开始准备" : "";
      $("#tmTxt").textContent = "请听题"; $("#tmTxt").className = "";
    } else if (w.k === "prep") {
      $("#stat").innerHTML = `<div class="recbox prep"><span class="lb">准备中</span><span class="bar"><i id="sBar"></i></span><span class="t" id="sT"></span></div>`;
      $("#hint").textContent = "准备时间结束后自动开始回答";
    } else {
      const on = !!(R.rec && R.rec.state === "recording");
      $("#stat").innerHTML = `<div class="recbox ${on ? "" : "norec"}">${on ? '<span class="dot"></span>' : ""}<span class="lb">${on ? "录音中" : "请回答"}</span>${on ? `<span class="lv">${"<i></i>".repeat(14)}</span>` : ""}<span class="bar"><i id="sBar"></i></span><span class="t" id="sT"></span></div>`;
      $("#hint").textContent = on ? "时间到后自动进入下一题" : "（未开启麦克风，本题不录音）";
    }
  }
  function tick() {
    const s = S[R.i]; if (!s) return;
    let frac, txt;
    if (s.t === "play") { frac = (A.currentTime - s.a) / (s.b - s.a); }
    else { frac = 1 - R.left / s.d; txt = mmss(R.left); }
    frac = Math.max(0, Math.min(1, frac || 0));
    if (s.key === "intro") { const b = $("#iBar"); b && (b.style.width = frac * 100 + "%"); const t = $("#iT"); t && txt && (t.textContent = txt); return; }
    $("#tmBar").style.width = frac * 100 + "%";
    if (s.t === "win") {
      const w = s; $("#tmTxt").textContent = (w.k === "prep" ? "准备时间 " : "本题剩余 ") + txt; $("#tmTxt").className = w.k === "prep" ? "" : "red";
      const b = $("#sBar"), t = $("#sT"); b && (b.style.width = frac * 100 + "%"); t && (t.textContent = txt);
    }
  }
  function renderIntro(s) {
    const first = R.i === 0 || !S.slice(0, R.i).some(x => x.t === "win");
    if (s.t === "play") $("#iStat").innerHTML = `<div class="listen">${WAVE}${first ? "正在播放考试说明……" : "请听考官提问……"}</div><p class="hint" style="text-align:center">说明播放结束后，考试自动开始。</p>`;
    else { const pr = (s.hint || "").split("—"); $("#iStat").innerHTML = `<p style="text-align:center;font-size:20px;margin:6px 0 10px">请回答：<b>${esc(pr[0].trim())}</b></p><div class="recbox intro"><span class="lb">请回答</span><span class="bar"><i id="iBar"></i></span><span class="t" id="iT"></span></div><p class="hint" style="text-align:center">${esc((pr[1] || "").trim())}（不计分）</p>`; }
  }
  let curKey = null;
  function render() {
    const s = S[R.i]; if (!s) return;
    if (s.key === "intro") { show("sIntro"); renderIntro(s); tick(); return; }
    if (curKey !== s.key || $("#sExam").classList.contains("hide")) {
      if ($("#sExam").classList.contains("hide")) { show("sExam"); renderCand(); }
      const oldPart = curKey && curKey !== "intro" ? (S.find(x => x.key === curKey) || {}).part : null;
      curKey = s.key; renderNav(s.key);
      renderCard(s);
      if (oldPart !== s.part) scrollTo(0, 0);
    }
    renderPhase(s); renderStat(s); tick();
    if (R.practice) { $("#bPause").textContent = R.paused ? "继续" : "暂停"; $("#bSkip").disabled = s.t === "play"; }
  }

  /* ---------- nháp ---------- */
  function initDraft() {
    const box = $("#mBody .draftbox"); if (!box) return;
    const k = box.dataset.dp; const d = DR[k] = DR[k] || { text: "", img: null, mode: "type" };
    const ta = $("textarea", box), cv = $("canvas", box), cx = cv.getContext("2d");
    ta.value = d.text; ta.oninput = () => d.text = ta.value;
    const size = () => { const r = window.devicePixelRatio || 1, w = box.clientWidth - 2, h = Math.max(200, Math.min(320, Math.round(w * .42))); cv.style.height = h + "px"; cv.width = w * r; cv.height = h * r; cx.setTransform(r, 0, 0, r, 0, 0); cx.lineCap = "round"; cx.lineJoin = "round"; cx.lineWidth = 3; cx.strokeStyle = "#333"; if (d.img) { const im = new Image(); im.onload = () => cx.drawImage(im, 0, 0, w, h); im.src = d.img; } };
    const mode = m => { d.mode = m; $$("[data-dt]", box).forEach(b => b.classList.toggle("on", b.dataset.dt === m)); ta.classList.toggle("hide", m !== "type"); cv.classList.toggle("hide", m !== "draw"); if (m === "draw") size(); };
    $$("[data-dt]", box).forEach(b => b.onclick = () => mode(b.dataset.dt));
    $(".dclear", box).onclick = () => { if (d.mode === "type") { ta.value = ""; d.text = ""; } else { cx.clearRect(0, 0, cv.width, cv.height); d.img = null; } };
    let down = false, last = null; const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.onpointerdown = e => { down = true; last = pt(e); cv.setPointerCapture(e.pointerId); cx.beginPath(); cx.arc(last[0], last[1], 1.4, 0, 7); cx.fillStyle = "#333"; cx.fill(); };
    cv.onpointermove = e => { if (!down) return; const p = pt(e); cx.beginPath(); cx.moveTo(last[0], last[1]); cx.lineTo(p[0], p[1]); cx.stroke(); last = p; };
    cv.onpointerup = cv.onpointercancel = () => { if (down) { down = false; try { d.img = cv.toDataURL(); } catch (_) { } } };
    mode(d.mode);
  }

  /* ---------- chạy đề ---------- */
  let raf = null;
  function startRec(q) {
    if (!R.stream || !window.MediaRecorder) return;
    try {
      R.chunks = []; R.rec = new MediaRecorder(R.stream, Object.assign({ audioBitsPerSecond: 24000 }, R.mime ? { mimeType: R.mime } : {}));
      R.rec.q = q; R.rec.ondataavailable = e => { e.data && e.data.size && R.chunks.push(e.data); };
      R.rec.onstop = function () { if (this.discard) return; R.recs[this.q] = new Blob(R.chunks, { type: this.mimeType || R.mime || "audio/webm" }); };
      R.rec.start();
    } catch (_) { R.rec = null; }
  }
  function stopRec(discard) { if (R.rec && R.rec.state !== "inactive") { R.rec.discard = !!discard; try { R.rec.stop(); } catch (_) { } } R.rec = null; }
  function next() {
    stopRec(); clearInterval(R.timer); cancelAnimationFrame(raf);
    R.i++; const s = S[R.i];
    if (!s) { A.pause(); R.running = false; setTimeout(finish, 500); return; }
    R.paused = false;
    if (s.t === "play") {
      A.volume = R.vol; A.currentTime = s.a; A.play().catch(() => { }); render();
      let wall = 0, tw = performance.now(); // dự phòng: máy chủ không tua được file nghe thì chạy theo đồng hồ
      const loop = () => { if (S[R.i] !== s) return; const n = performance.now(); if (!R.paused) wall += (n - tw) / 1000; tw = n; if (!R.paused && (A.currentTime >= s.b - .05 || A.ended || wall > s.b - s.a + 4)) { A.pause(); return next(); } tick(); raf = requestAnimationFrame(loop); };
      raf = requestAnimationFrame(loop);
    } else {
      R.left = s.d; if (s.k === "ans") startRec(s.q); render();
      let t0 = performance.now();
      R.timer = setInterval(() => { const n = performance.now(); if (!R.paused) R.left -= (n - t0) / 1000; t0 = n; if (R.left <= 0) { clearInterval(R.timer); return next(); } tick(); }, 200);
    }
  }
  function togglePause() {
    R.paused = !R.paused; const s = S[R.i];
    if (s && s.t === "play") R.paused ? A.pause() : A.play();
    if (R.rec) { try { R.paused ? R.rec.pause() : R.rec.resume(); } catch (_) { } }
    render();
  }
  function replay() { if (!S[R.i]) return; let j = R.i; while (j >= 0 && S[j].t !== "play") j--; if (j < 0) return; stopRec(true); clearInterval(R.timer); R.i = j - 1; next(); }
  function skip() { const s = S[R.i]; if (s && s.t !== "play") { clearInterval(R.timer); next(); } }

  /* ---------- nộp bài ---------- */
  const slug = t => (t || "hoc-sinh").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^\w]+/g, "_").replace(/^_|_$/g, "") || "hoc_sinh";
  const fname = q => `HSK${E.level}_KouYu_${slug(R.name)}_Cau${String(q).padStart(2, "0")}.${/mp4/.test(R.recs[q].type) ? "m4a" : /ogg/.test(R.recs[q].type) ? "ogg" : "webm"}`;
  const recQs = () => E.answerQs.filter(q => R.recs[q]);
  function finish() {
    show("sEnd");
    const qs = recQs();
    if (!EMBED || !qs.length) {
      $("#upl").innerHTML = `<h2 style="margin:0 0 6px">口语考试已结束</h2><p class="msg">${qs.length ? "Bài làm chưa được nộp vì đang mở đề ngoài hệ thống HSK GARDEN. Hãy tải file .zip ở trang sau để gửi giáo viên." : "Không có bản ghi âm nào (micro chưa bật)."}</p><div class="resbtns"><button class="btn" type="button" id="toRes">查看作答 · Xem lại</button></div>`;
      $("#toRes").onclick = review; return;
    }
    submit();
  }
  function submit() {
    if (R.sent) return; R.sent = true;
    const qs = recQs();
    $("#upl").innerHTML = `<h2 style="margin:0 0 6px">口语考试已结束</h2><p class="msg" id="uMsg">正在提交录音，请不要关闭页面……</p><div class="bar"><i id="uBar" style="width:3%"></i></div><p style="color:#4d7f12;font-weight:700" id="uCnt">已上传 0 / ${qs.length}</p>`;
    const abs = u => new URL(u, location.href).href;
    const answers = qs.map(q => { const m = (E.qMeta || {})[q] || {}; return { q, type: m.type, question: m.question, images: (m.images || []).map(abs), blob: R.recs[q], mime: R.recs[q].type }; });
    window.parent.postMessage({ source: "hsk-garden-hskk", type: "HSKK_SUBMIT", level: E.level, title: E.title + " 口语 · " + PAPER, exam: E.examName || "", name: R.name, mode: R.practice ? "Luyện tập" : "Thi thử", answers }, location.origin);
    clearTimeout(window.__subT);
    window.__subT = setTimeout(() => { if (!R.submitted) uploadFail("Không nhận được phản hồi từ máy chủ"); }, 120000);
  }
  function uploadFail(msg) {
    R.sent = false;
    $("#upl").innerHTML = `<h2 style="margin:0 0 6px">提交失败</h2><p class="msg err">⚠ Nộp chưa được: ${esc(msg)}. Kiểm tra mạng rồi bấm nộp lại, hoặc tải file .zip gửi giáo viên.</p><div class="resbtns"><button class="btn" type="button" id="reSub">重新提交 · Nộp lại</button><button class="btn g" type="button" id="toRes">查看作答 · Xem lại</button></div>`;
    $("#reSub").onclick = submit; $("#toRes").onclick = review;
  }
  window.addEventListener("message", e => {
    const d = e.data; if (!d || d.source !== "hsk-garden-dashboard" || e.source !== window.parent) return;
    if (d.type === "HSKK_PROGRESS") { const b = $("#uBar"), c = $("#uCnt"); b && (b.style.width = Math.max(3, d.done / d.total * 100) + "%"); c && (c.textContent = `已上传 ${d.done} / ${d.total}`); }
    else if (d.type === "HSKK_SAVED") { R.submitted = true; clearTimeout(window.__subT); const b = $("#uBar"); b && (b.style.width = "100%"); const m = $("#uMsg"); m && (m.textContent = "提交成功！· Đã nộp bài cho giáo viên."); setTimeout(review, 900); }
    else if (d.type === "HSKK_ERROR") { clearTimeout(window.__subT); uploadFail(d.message || "lỗi không rõ"); }
  });

  /* ---------- xem lại ---------- */
  function refFor(q) {
    const out = [];
    (E.samples || []).forEach(sm => {
      const m = /Câu\s*(\d+)(?:\s*[–-]\s*(\d+))?/.exec(sm[0] || ""); if (!m) return;
      const a = +m[1], b = m[2] ? +m[2] : a; if (q < a || q > b) return;
      if (b > a) { const line = String(sm[1]).split(/<br\s*\/?>/i).find(l => new RegExp("^\\s*" + q + "[.．、]").test(l)); if (line) { out.push({ zh: line.replace(new RegExp("^\\s*" + q + "[.．、]\\s*"), ""), vi: "" }); return; } if (q !== a) return; }
      out.push({ zh: sm[1], vi: sm[2] || "" });
    });
    return out;
  }
  function review() {
    show("sRes"); scrollTo(0, 0);
    const qs = E.answerQs, n = recQs().length;
    const partOf = q => { const w = E.windows.find(w => w.k === "ans" && w.q === q); return w ? E.parts[w.part] : null; };
    const rows = qs.map(q => {
      const p = partOf(q), typ = p ? p.title.split("：").pop() : "", qt = (E.qText || {})[q] || "";
      const refs = refFor(q);
      const ref = `${qt && qt !== typ ? `<div class="qq">${esc(qt)}</div>` : ""}${refs.map(r => `<div class="zh">${r.zh}</div>${r.vi ? `<div class="vi">${esc(r.vi)}</div>` : ""}`).join("")}` || '<span style="color:#aaa">—</span>';
      return `<tr><td>第${q}题<br><small>${esc(typ)}</small></td><td>${R.recs[q] ? `<audio controls preload="none" src="${URL.createObjectURL(R.recs[q])}"></audio>` : '<span style="color:#aaa">— 无录音 —</span>'}</td><td class="ref">${ref}</td></tr>`;
    }).join("");
    const tip = R.submitted ? "录音已提交，老师评分后会通知你。· Đã nộp bài. Kết quả sẽ hiện ở mục thông báo khi giáo viên chấm xong." : EMBED && n ? "录音尚未提交。· Bài chưa nộp được — có thể tải .zip gửi giáo viên." : "Đang mở đề ngoài hệ thống: hãy tải .zip để gửi giáo viên.";
    $("#resBody").innerHTML = `<div class="tip">${tip}</div><p style="margin:0 0 14px;color:#555">${SUBJ} · ${esc(PAPER)} · ${esc(R.name)} · 已录音 ${n} / ${qs.length}</p>
      <table class="rv"><tr><th style="width:96px">题号</th><th style="width:220px">我的录音</th><th>题目 / 参考答案</th></tr>${rows}</table>
      <div class="resbtns">${!R.submitted && EMBED && n ? '<button class="btn" type="button" id="rSub">重新提交 · Nộp lại</button>' : ""}${n ? '<button class="btn sm g" type="button" id="rZip">下载录音（.zip）</button>' : ""}<button class="btn sm" type="button" id="rAgain">重新考试</button>${E.back ? '<button class="btn sm g" type="button" id="rBack">返回复习</button>' : ""}</div>`;
    $("#rSub") && ($("#rSub").onclick = () => { show("sEnd"); submit(); });
    $("#rZip") && ($("#rZip").onclick = async () => { const b = $("#rZip"); b.disabled = true; b.textContent = "正在打包……"; download(await zip(recQs().map(q => ({ name: fname(q), blob: R.recs[q] }))), `HSK${E.level}_KouYu_${slug(R.name)}.zip`); b.disabled = false; b.textContent = "下载录音（.zip）"; });
    $("#rBack") && ($("#rBack").onclick = () => { if (Object.keys(R.recs).length && !R.submitted && !confirm("Bài chưa nộp, bản ghi sẽ mất. Vẫn quay lại?")) return; R.running = false; R.recs = {}; R.submitted = true; location.href = E.back + location.search; });
    $("#rAgain").onclick = () => { if (confirm("Làm lại sẽ xoá các bản ghi âm hiện tại. Tiếp tục?")) { R.running = false; R.recs = {}; location.reload(); } };
  }
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  async function zip(files) {
    const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer()), nm = enc.encode(f.name), c = crc32(data);
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x800, true); lh.setUint32(14, c, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true);
      parts.push(lh.buffer, nm, data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x800, true); ch.setUint32(16, c, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      cen.push(ch.buffer, nm); off += 30 + nm.length + data.length;
    }
    const cs = cen.reduce((a, b) => a + (b.byteLength || b.length), 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cs, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cen, end.buffer], { type: "application/zip" });
  }
  function download(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
  window.addEventListener("beforeunload", e => { if (R.running || (Object.keys(R.recs).length && !R.submitted)) { e.preventDefault(); e.returnValue = ""; } });

  /* chế độ kiểm thử: ?demo=<số bước> nhảy thẳng vào phòng thi */
  window.__HSKK = { R, S, next, render, review, finish, lv: () => [LEVEL, AC && AC.state] };
})();
