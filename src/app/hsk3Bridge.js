// ============================================================
// CẦU NỐI ĐỀ THI → HỆ THỐNG CHẤM BÀI
// Các đề HTML cũ (HSK1–4) tự chấm bên trong nhưng không gửi kết quả ra ngoài.
// Trang web chèn đoạn mã này vào iframe đề (cùng origin) lúc đề tải xong.
// Mã nhận diện 3 kiểu đề, chờ học viên nộp bài trong đề, rồi gửi HSK3_SUBMIT
// (cùng định dạng với đề HSK5) để lưu vào hsk3_submissions cho giáo viên chấm.
// ============================================================
export const HSK3_BRIDGE = String.raw`
(function(){
  if (window.__hsk3Bridge) return; window.__hsk3Bridge = true;
  var g = function(name){ try { return (0, eval)("typeof " + name + " !== 'undefined' ? " + name + " : undefined"); } catch (e) { return undefined; } };
  var S = function(v){ return String(v == null ? "" : v).trim(); };
  var nums = function(o){ return Object.keys(o || {}).map(Number).filter(function(n){ return n > 0; }).sort(function(a,b){ return a-b; }); };
  var sec = function(list){
    var c = 0; list.forEach(function(x){ if (x.ok) c++; });
    return { correct: c, total: list.length, score: list.length ? Math.round(c / list.length * 100) : null, detail: list };
  };

  function family(){
    if (g("QREG") && g("DATA") && g("answers") && g("correctLetter")) return "A1";
    var L = g("LISTENING"); if (g("ANSWERS") && L && L.answers) return "B";
    if (g("LISTENING_KEY") && g("READING_KEY") && g("answers")) return "C";
    var D = g("DATA"); if (D && D.listening && D.listening.parts) return "A";
    return null;
  }

  // ---------- Kiểu A: HSK1 / HSK2 (DATA toàn cục; trạng thái nằm trong hàm kín) ----------
  // Đáp án học viên lấy từ bản lưu tự động {a: answers, s: submitted} mà đề ghi vào localStorage.
  var lastSave = null;
  try {
    var _set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(k, v){
      try { var o = JSON.parse(v); if (o && typeof o === "object" && o.a && typeof o.a === "object" && "s" in o) lastSave = o; } catch (e) {}
      return _set.apply(this, arguments);
    };
  } catch (e) {}
  // Chỉ dùng bản lưu do chính đề đang mở ghi ra sau khi cầu nối đã gắn (không đọc bản lưu của đề khác).
  function stateA(){ return lastSave || { a: {}, s: false }; }
  var norm = function(x){ return String(x == null ? "" : x).replace(/[\s，。、？！?!,.；;：:"'‘’“”（）()《》〈〉]/g, "").toLowerCase(); };
  function keyOf(q){
    var c = q.correct;
    if (typeof c === "number") return { ans: String.fromCharCode(65 + c), text: false };
    if (typeof c === "boolean") return { ans: c ? "T" : "F", text: false };
    c = S(c);
    if (/^[A-FTL]$/.test(c)) return { ans: c, text: false };
    return { ans: c, text: true, accept: [c].concat(q.accept || []) };
  }
  function doneA(){ return stateA().s === true; }
  function collectA(){
    var DATA = g("DATA"), A = stateA().a || {};
    var QREG = g("QREG"), answers = g("answers"); if (QREG && answers) A = answers;
    var out = { listening: [], reading: [], writing: [] };
    Object.keys(DATA).forEach(function(key){
      var s = DATA[key]; if (!s || !s.parts) return;
      var bucket = key === "listening" ? out.listening : key === "writing" ? out.writing : out.reading;
      s.parts.forEach(function(p){ (p.questions || []).forEach(function(q){
        if (q.num == null || q.correct == null) return;
        var k = keyOf(q), your = S(A[q.num]);
        var ok = your !== "" && (k.text ? k.accept.some(function(x){ return norm(x) === norm(your); }) : your === k.ans);
        bucket.push({ n: q.num, your: your, ans: k.ans, ok: ok });
      }); });
    });
    ["listening","reading","writing"].forEach(function(k){ out[k].sort(function(a,b){ return a.n-b.n; }); });
    return { listening: sec(out.listening), reading: sec(out.reading), writing: { items: [], auto: out.writing.length ? sec(out.writing) : null } };
  }

  // ---------- Kiểu B: HSK3 3.0 (ANSWERS + LISTENING/READING/WRITING) ----------
  function doneB(){
    if (g("examSubmitted") === true) return true;
    var SS = g("SECTION_SUBMITTED"); return !!(SS && SS.listening && SS.reading && SS.writing);
  }
  function collectB(){
    var A = g("ANSWERS"), L = g("LISTENING"), R = g("READING"), W = g("WRITING") || {};
    var mk = function(key){ return nums(key).map(function(n){ var y = S(A[n]), a = S(key[n]); return { n: n, your: y, ans: a, ok: y !== "" && y === a }; }); };
    var wAuto = (W.part1 || []).map(function(it){ var y = S(A[it.num]), a = S(it.answer); return { n: it.num, your: y, ans: a, ok: y !== "" && y === a }; });
    var items = (W.part2 || []).map(function(it){ return { n: it.num, text: S(A[it.num]), word: S(it.word), img: S(it.img), ref: S(it.sample) }; });
    return { listening: sec(mk(L.answers)), reading: sec(mk(R.answers)), writing: { items: items, auto: wAuto.length ? sec(wAuto) : null } };
  }

  // ---------- Kiểu C: HSK4 (LISTENING_KEY / READING_KEY / WRITING_REF, submitted{}) ----------
  function doneC(){ var s = g("submitted"); return !!(s && typeof s === "object" && s.listening && s.reading && s.writing); }
  function collectC(){
    var LK = g("LISTENING_KEY"), RK = g("READING_KEY"), A = g("answers"), REF = g("WRITING_REF") || {};
    var mk = function(key){ return nums(key).map(function(n){ var y = S(A[n]), a = S(key[n]); return { n: n, your: y, ans: a, ok: y !== "" && y === a }; }); };
    var items = [], seen = {};
    document.querySelectorAll("textarea, input[type=text], input.write-sentence").forEach(function(el){
      var n = Number(el.dataset.q || (String(el.id || "").match(/(\d+)$/) || [])[1]);
      if (!n || seen[n]) return; seen[n] = 1;
      var q = document.getElementById("q" + n) || el.closest("[data-q]");
      var t = q && q.querySelector(".q-title"), im = q && q.querySelector("img"), w = q && q.querySelector(".writing-word");
      items.push({ n: n, text: S(el.value), ref: S(REF[n]), word: w ? S(w.textContent) : "", prompt: t ? S(t.textContent) : "", img: im ? S(im.currentSrc || im.src) : "" });
    });
    items.sort(function(a,b){ return a.n-b.n; });
    return { listening: sec(mk(LK)), reading: sec(mk(RK)), writing: { items: items } };
  }

  var F = null, sent = false, t0 = Date.now();
  function banner(html, ok){
    var b = document.getElementById("__hsk3SendMsg");
    if (!b) { b = document.createElement("div"); b.id = "__hsk3SendMsg";
      b.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:2147483647;padding:10px 16px;border-radius:12px;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.18);max-width:92vw;text-align:center";
      document.body.appendChild(b); }
    b.style.background = ok === false ? "#FDE8E8" : ok ? "#E7F5EC" : "#FFF8E1";
    b.style.color = ok === false ? "#8A1C1C" : ok ? "#1E5C38" : "#7A5600";
    b.innerHTML = html;
    if (ok) setTimeout(function(){ b.remove(); }, 6000);
  }
  function send(){
    if (sent) return; sent = true;
    var r; try { r = F === "A" ? collectA() : F === "B" ? collectB() : collectC(); } catch (e) { sent = false; return; }
    var w = r.writing || { items: [] }, it = w.items || [];
    var payload = { source: "hsk-garden-hsk3", type: "HSK3_SUBMIT", bridge: F,
      listening: r.listening, reading: r.reading,
      writing: { items: it, auto: w.auto || null,
        q71: it.map(function(x){ return x.text ? "【" + x.n + "】" + x.text : ""; }).filter(Boolean).join("\n\n"),
        c71: it.reduce(function(s,x){ return s + (x.text || "").replace(/\s/g, "").length; }, 0) },
      durationMin: Math.round((Date.now() - t0) / 60000) };
    try { window.parent.postMessage(payload, "*"); banner("⏳ Đang gửi bài cho giáo viên…"); } catch (e) {}
  }
  window.addEventListener("message", function(e){
    var d = e.data; if (!d || d.source !== "hsk-garden-dashboard") return;
    if (d.type === "HSK3_SAVED") banner("✅ Đã gửi bài cho giáo viên.", true);
    if (d.type === "HSK3_ERROR") { sent = false; banner("⚠ Chưa gửi được bài: " + (d.message || "") + " — bấm “Nộp bài & thoát” ở thanh trên.", false); }
  });
  function tick(){
    if (!F) F = family();
    if (F === "A1") F = "A";
    if (!F) return;
    var done = F === "A" ? doneA() : F === "B" ? doneB() : doneC();
    if (done) send();
  }
  setInterval(tick, 1000);
  window.__hsk3BridgeCollect = function(){ if (!F) F = family(); if (F === "A1") F = "A"; if (!F) return null; try { return F === "A" ? collectA() : F === "B" ? collectB() : collectC(); } catch (e) { return null; } };
})();
`;

// ============================================================
// CHẾ ĐỘ HỌC VIÊN: ẩn mọi thứ dành cho giáo viên trong đề cũ
// (nút trình chiếu hiện đáp án, đáp án tham khảo phần viết, ô chấm điểm tay,
//  lời nhắc "chụp màn hình gửi giáo viên" — bài viết đã tự gửi cho giáo viên).
// ============================================================
export const HSK3_STUDENT_MODE = String.raw`
(function(){
  if (window.__hsk3Student) return; window.__hsk3Student = true;
  var css = [
    "#btnPresent,#presentBtn,#presenter,#presentStage,#teacherToolbar,#teacherIndicator,.teacher-answer-panel,.presentation-exit{display:none!important}",
    ".teacher-note,.student-manual-note,.manual-reference-answer,.manual-grade-side,.manual-grade-footer,.manual-review,#btnFinalizeManual,#btnFinalizeManualSection{display:none!important}",
    ".manual-grade-card{grid-template-columns:auto 1fr!important}",
    ".review-ref,.review-score,.pending-note,#writingReview .snapshot-head .meta{display:none!important}",
    ".__hsk3Note{grid-column:1/-1;margin:0 0 12px;padding:12px 14px;border-radius:12px;background:#E7F5EC;color:#1E5C38;font:600 14px/1.5 system-ui,sans-serif}"
  ].join("\n");
  var st = document.createElement("style"); st.id = "__hsk3StudentCss"; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
  var MSG = "✉️ Bài viết đã được gửi cho giáo viên chấm. Điểm và nhận xét sẽ hiện ở trang chủ khi giáo viên chấm xong.";
  function note(){
    document.querySelectorAll(".manual-grading-list, .writing-review-grid").forEach(function(box){
      if (box.querySelector(".__hsk3Note")) return;
      var d = document.createElement("div"); d.className = "__hsk3Note"; d.textContent = MSG; box.insertBefore(d, box.firstChild);
    });
  }
  note();
  try { new MutationObserver(note).observe(document.body, { childList: true, subtree: true }); } catch (e) {}
})();
`;
