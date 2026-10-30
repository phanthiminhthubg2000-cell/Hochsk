"use client";
// ============================================================
// XẾP GẠCH NGỮ PHÁP — sắp xếp các mảnh thành câu đúng
// Nguồn câu:
//   • Theo bài  : câu ví dụ của từ vựng trong bài giảng (public/games/vocab.json, trường [4] câu · [5] nghĩa)
//   • Theo cấp  : kho câu src/app/sentences.json (có pinyin + nghĩa)
// Sai → các mảnh đã đúng vị trí được tô xanh; gợi ý đặt sẵn từng mảnh đúng.
// XP chỉ ghi một nơi: users/{uid}.xp (+ water) bằng increment.
// ============================================================
import Link from "next/link";
import { useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc, increment } from "firebase/firestore";
import { logUserError } from "../../lib/firebaseUtils";
import sentencesData from "../sentences.json";
import GardenNav from "../GardenNav";

const HSK_LEVELS = ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"];
const COUNTS = [5, 10, 15, 20];
const HEARTS = 5;
const PUNCT = /^[\s.,?!;:。，？！、；：“”"'‘’（）()《》…—-]+$/;

const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const strip = (t) => (t || "").replace(/[\s.,?!;:。，？！、；：“”"'‘’（）()《》…—-]/g, "");
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// Cắt câu thành mảnh: giữ nguyên từ trọng tâm làm 1 mảnh, phần còn lại cắt theo từ (Intl.Segmenter)
function segment(text, keep = "") {
  const seg = (t) => {
    if (!t) return [];
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      const s = new Intl.Segmenter("zh-CN", { granularity: "word" });
      return [...s.segment(t)].map((x) => x.segment);
    }
    return t.split("");
  };
  let parts = [];
  if (keep && text.includes(keep)) {
    text.split(keep).forEach((p, i, arr) => { parts.push(...seg(p)); if (i < arr.length - 1) parts.push(keep); });
  } else parts = seg(text);
  parts = parts.filter((p) => p.trim() && !PUNCT.test(p));
  // gộp mảnh 1 chữ quá vụn khi câu dài (giữ tối đa ~9 mảnh)
  while (parts.length > 9) {
    let best = -1, len = 99;
    for (let i = 0; i < parts.length - 1; i++) {
      if (parts[i] === keep || parts[i + 1] === keep) continue;
      const l = parts[i].length + parts[i + 1].length;
      if (l < len) { len = l; best = i; }
    }
    if (best < 0) break;
    parts.splice(best, 2, parts[best] + parts[best + 1]);
  }
  return parts;
}

function speak(text) {
  try {
    if (!text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = "zh-CN"; u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

export default function ArrangePage() {
  const { userId } = useAuth();

  // ----- chọn đề -----
  const [source, setSource] = useState("lesson"); // lesson | level
  const [vocab, setVocab] = useState(null);
  const [lv, setLv] = useState(0);
  const [upto, setUpto] = useState(1); // ôn từ bài 1 đến bài upto
  const [only, setOnly] = useState(false); // chỉ bài upto
  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [count, setCount] = useState(10);

  // ----- trò chơi -----
  const [phase, setPhase] = useState("start"); // start | playing | result
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [pool, setPool] = useState([]);   // mảnh còn lại
  const [picked, setPicked] = useState([]); // mảnh đã xếp
  const [feedback, setFeedback] = useState(null); // correct | incorrect | reveal | null
  const [hearts, setHearts] = useState(HEARTS);
  const [score, setScore] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [mistakes, setMistakes] = useState([]); // câu đã sai để ôn lại
  const [earned, setEarned] = useState({ xp: 0, water: 0 });
  const ended = useRef(false);

  useEffect(() => {
    fetch("/games/vocab.json", { cache: "force-cache" }).then((r) => r.json()).then((v) => {
      setVocab(v);
      const sl = v.findIndex((x) => x.id === LS.get("hg_arr_lv"));
      if (sl >= 0) setLv(sl);
      const su = +LS.get("hg_arr_upto"); if (su > 0) setUpto(su);
      if (LS.get("hg_arr_src") === "level") setSource("level");
    }).catch(() => setSource("level"));
  }, []);

  const level = vocab ? vocab[lv] : null;
  const lessonSentences = useMemo(() => {
    if (!level) return [];
    const from = only ? upto - 1 : 0, to = Math.min(upto, level.lessons.length);
    const out = [], seen = new Set();
    for (let i = from; i < to; i++) {
      const L = level.lessons[i];
      (L.w || []).forEach((w) => {
        const zh = w[4] || "";
        if (!zh || !zh.includes(w[0]) || seen.has(zh) || strip(zh).length < 4 || strip(zh).length > 28) return;
        seen.add(zh);
        out.push({ chinese: zh, vietnamese: w[5] || "", ipa: "", key: { z: w[0], py: w[1], vn: w[2] }, lesson: L.n });
      });
    }
    return out;
  }, [level, upto, only]);
  const levelSentences = useMemo(() => {
    const t = selectedHsk.replace(/\s+/g, "").toUpperCase();
    return sentencesData.filter((s) => s.level && s.level.replace(/\s+/g, "").toUpperCase() === t && s.chinese);
  }, [selectedHsk]);
  const available = source === "lesson" ? lessonSentences : levelSentences;

  function load(q) {
    const parts = segment(q.chinese, q.key?.z);
    let order = parts.map((text, i) => ({ id: i, text }));
    // tránh trường hợp xáo ra đúng thứ tự
    for (let k = 0; k < 5; k++) { order = shuffle(order); if (order.map((x) => x.text).join("") !== parts.join("") || parts.length < 2) break; }
    setPool(order); setPicked([]); setFeedback(null);
  }

  function start() {
    if (!available.length) return;
    LS.set("hg_arr_src", source);
    if (level) { LS.set("hg_arr_lv", level.id); LS.set("hg_arr_upto", String(upto)); }
    const qs = shuffle(available).slice(0, Math.min(count, available.length));
    setQuestions(qs); setIdx(0); setHearts(HEARTS); setScore(0); setHintsUsed(0); setMistakes([]); ended.current = false;
    setPhase("playing"); load(qs[0]);
  }

  const cur = questions[idx];
  const answerParts = useMemo(() => (cur ? segment(cur.chinese, cur.key?.z) : []), [cur]);
  const done = feedback === "correct" || feedback === "reveal";

  // pinyin tự sinh cho câu chưa có (tải thư viện khi cần)
  const [autoPy, setAutoPy] = useState({});
  useEffect(() => {
    if (!cur || cur.ipa || autoPy[cur.chinese]) return;
    let live = true;
    import("pinyin-pro").then(({ pinyin }) => {
      const py = answerParts.map((t) => pinyin(t, { toneType: "symbol", type: "array" }).join("")).join(" ");
      if (live) setAutoPy((m) => ({ ...m, [cur.chinese]: py }));
    }).catch(() => {});
    return () => { live = false; };
  }, [cur, answerParts]); // eslint-disable-line
  const pyOf = (q) => (q ? q.ipa || autoPy[q.chinese] || "" : "");

  const pick = (w) => { if (done) return; setPool((p) => p.filter((x) => x.id !== w.id)); setPicked((p) => [...p, w]); setFeedback(null); };
  const unpick = (w) => { if (done) return; setPicked((p) => p.filter((x) => x.id !== w.id)); setPool((p) => [...p, w]); setFeedback(null); };
  const clearAll = () => { if (done) return; setPool((p) => [...p, ...picked]); setPicked([]); setFeedback(null); };

  // Gợi ý: đặt sẵn mảnh đúng tiếp theo (giữ các mảnh đầu đã đúng)
  function hint() {
    if (done || !cur) return;
    let ok = 0;
    while (ok < picked.length && picked[ok].text === answerParts[ok]) ok++;
    if (ok >= answerParts.length) return;
    const keepP = picked.slice(0, ok);
    const back = picked.slice(ok);
    const rest = [...pool, ...back];
    const need = answerParts[ok];
    const j = rest.findIndex((x) => x.text === need);
    if (j < 0) return;
    const w = rest[j];
    setPicked([...keepP, w]); setPool(rest.filter((_, i) => i !== j)); setFeedback(null);
    setHintsUsed((h) => h + 1);
  }

  async function check() {
    if (!picked.length || done || !cur) return;
    if (picked.map((w) => w.text).join("") === answerParts.join("")) {
      setFeedback("correct"); setScore((s) => s + 1); speak(cur.chinese);
      return;
    }
    setFeedback("incorrect");
    setMistakes((m) => (m.some((x) => x.chinese === cur.chinese) ? m : [...m, cur]));
    const left = hearts - 1;
    setHearts(left);
    if (userId) logUserError(userId, "arrange_grammar_error").catch(() => {});
    if (left <= 0) { setFeedback("reveal"); speak(cur.chinese); }
  }

  function giveUp() {
    if (done || !cur) return;
    setFeedback("reveal");
    setMistakes((m) => (m.some((x) => x.chinese === cur.chinese) ? m : [...m, cur]));
    speak(cur.chinese);
  }

  function next() {
    if (hearts <= 0 || idx + 1 >= questions.length) { finish(); return; }
    setIdx(idx + 1); load(questions[idx + 1]);
  }

  async function finish() {
    if (ended.current) return; ended.current = true;
    setPhase("result");
    const xp = Math.max(0, score * 15 - hintsUsed * 3);
    const water = Math.floor(score / 2);
    setEarned({ xp, water });
    if (userId && (xp > 0 || water > 0)) {
      try { await setDoc(doc(db, "users", userId), { xp: increment(xp), water: increment(water) }, { merge: true }); }
      catch (e) { console.error("Lỗi cộng XP:", e); }
    }
  }

  // vị trí đúng/sai của từng mảnh sau khi kiểm tra sai
  const posOk = (w, i) => feedback === "incorrect" && answerParts[i] === w.text;

  const progress = questions.length ? ((idx + (done ? 1 : 0)) / questions.length) * 100 : 0;
  const tile = "px-5 py-3 text-2xl font-black rounded-2xl shadow-sm transition-all";

  return (
    <div className="flex flex-col min-h-screen bg-[#F4F7EF] font-sans text-[#1B5E4B]">
      <GardenNav active="practice" />
      <style>{`.zh{font-family:"Noto Sans SC","PingFang SC",sans-serif}@keyframes shk{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}.shk{animation:shk .3s}`}</style>

      <header className="px-4 md:px-8 h-14 md:h-16 border-b border-[#E2E8F0] bg-white/80 backdrop-blur-xl flex items-center gap-4 shrink-0">
        {phase !== "start" && <button onClick={() => setPhase("start")} className="text-slate-500 hover:text-[#2F8F6E] font-bold text-sm bg-white px-4 py-2 rounded-xl border border-slate-200">← <span className="hidden sm:inline">Quay lại</span></button>}
        <h2 className="font-black text-base md:text-lg">🧩 Xếp gạch ngữ pháp</h2>
      </header>

      <div className="flex-1 flex flex-col items-center w-full py-8 px-4 md:px-6">
        {/* ---------- CHỌN ĐỀ ---------- */}
        {phase === "start" && (
          <div className="w-full max-w-xl bg-white p-6 md:p-10 rounded-[32px] border border-[#E2E8F0] shadow-sm">
            <div className="text-5xl text-center">🧩</div>
            <h1 className="text-3xl font-black text-center mt-3">Trò chơi xếp gạch</h1>
            <p className="text-slate-500 font-medium text-center mt-2 mb-6">Chạm các mảnh để ghép thành câu đúng. Mỗi lượt có <b className="text-[#F2765B]">{HEARTS} ❤️</b>.</p>

            <div className="grid grid-cols-2 gap-2 mb-5" role="tablist">
              {[["lesson", "📚 Theo bài học"], ["level", "🎯 Kho câu theo cấp"]].map(([k, l]) => (
                <button key={k} role="tab" aria-selected={source === k} onClick={() => setSource(k)} disabled={k === "lesson" && !vocab}
                  className={`h-12 rounded-2xl font-black text-sm border-2 ${source === k ? "bg-[#2F8F6E] text-white border-[#2F8F6E]" : "bg-white border-[#E2E8F0] text-slate-600"}`}>{l}</button>
              ))}
            </div>

            {source === "lesson" ? (
              !vocab ? <div className="text-slate-500">Đang tải bài học…</div> : (
                <div className="flex flex-col gap-4 bg-[#F4F7F6] p-5 rounded-[24px]">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Giáo trình
                    <select value={lv} onChange={(e) => { setLv(+e.target.value); setUpto(1); }} className="mt-1 w-full bg-white border-2 border-[#E2E8F0] text-[#2F8F6E] font-black py-3 px-4 rounded-2xl normal-case tracking-normal text-base">
                      {vocab.map((v, i) => <option key={v.id} value={i}>{v.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest">{only ? "Bài" : "Ôn từ bài 1 đến bài"}
                    <select value={upto} onChange={(e) => setUpto(+e.target.value)} className="mt-1 w-full bg-white border-2 border-[#E2E8F0] text-[#2F8F6E] font-black py-3 px-4 rounded-2xl normal-case tracking-normal text-base">
                      {level.lessons.map((l, i) => <option key={i} value={i + 1}>Bài {l.n} · {l.t}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                    <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="w-5 h-5 accent-[#2F8F6E]" /> Chỉ luyện riêng bài này
                  </label>
                </div>
              )
            ) : (
              <div className="bg-[#F4F7F6] p-5 rounded-[24px]">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Cấp độ
                  <select value={selectedHsk} onChange={(e) => setSelectedHsk(e.target.value)} className="mt-1 w-full bg-white border-2 border-[#E2E8F0] text-[#2F8F6E] font-black py-3 px-4 rounded-2xl normal-case tracking-normal text-base">
                    {HSK_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
              </div>
            )}

            <div className="mt-5">
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Số câu mỗi lượt</div>
              <div className="flex gap-2">
                {COUNTS.map((n) => <button key={n} onClick={() => setCount(n)} className={`flex-1 h-11 rounded-xl font-black border-2 ${count === n ? "bg-[#2F8F6E] text-white border-[#2F8F6E]" : "bg-white border-[#E2E8F0]"}`}>{n}</button>)}
              </div>
              <p className="text-sm text-slate-500 mt-2">Có <b>{available.length}</b> câu phù hợp{available.length && available.length < count ? ` — lượt này sẽ có ${available.length} câu` : ""}.</p>
            </div>

            <button onClick={start} disabled={!available.length} className="w-full mt-6 py-4 bg-[#2F8F6E] text-white font-black text-lg rounded-[20px] hover:bg-[#1B5E4B] disabled:opacity-40 border-b-[4px] border-[#0F3F31]">Bắt đầu ghép câu ➔</button>
          </div>
        )}

        {/* ---------- ĐANG CHƠI ---------- */}
        {phase === "playing" && cur && (
          <div className="w-full max-w-3xl flex flex-col gap-5">
            <div className="flex items-center gap-4 bg-white p-4 rounded-[20px] border border-[#E2E8F0]">
              <div className="flex gap-0.5 text-lg" aria-label={`Còn ${hearts} tim`}>
                {Array.from({ length: HEARTS }).map((_, i) => <span key={i} className={i < hearts ? "" : "opacity-20 grayscale"}>❤️</span>)}
              </div>
              <div className="flex-1 h-3 bg-[#EEF5E9] rounded-full overflow-hidden"><div className="h-full bg-[#2F8F6E] transition-all" style={{ width: `${progress}%` }} /></div>
              <div className="font-black bg-[#EEF5E9] px-3 py-1 rounded-lg tabular-nums">{idx + 1} / {questions.length}</div>
            </div>

            <div className="bg-white p-5 md:p-8 rounded-[28px] border border-[#E2E8F0]">
              {/* đề */}
              <div className="mb-4">
                {cur.vietnamese ? <div className="text-lg font-bold text-slate-700">🇻🇳 {cur.vietnamese}</div>
                  : <div className="text-sm font-bold text-slate-400">Ghép thành câu hoàn chỉnh</div>}
                {cur.key && <div className="mt-2 inline-flex items-center gap-2 text-sm bg-[#FFF8E8] border border-[#FFD666]/60 rounded-xl px-3 py-1.5"><span className="font-black text-amber-700">Từ trọng tâm</span><span className="zh font-black text-lg">{cur.key.z}</span><span className="text-slate-600">{cur.key.py}{cur.key.vn ? ` · ${cur.key.vn}` : ""}</span>{cur.lesson && <span className="text-slate-400">· Bài {cur.lesson}</span>}</div>}
              </div>

              {/* ô ghép */}
              <div className={`min-h-[96px] rounded-[20px] p-4 flex flex-wrap content-start gap-2.5 mb-5 ${feedback === "correct" ? "border-2 border-[#8FD9A8] bg-[#EEF5E9]" : feedback === "incorrect" ? "border-2 border-[#FECDD3] bg-[#FFF1F2] shk" : feedback === "reveal" ? "border-2 border-[#FFD666] bg-[#FFF8E8]" : "border-2 border-dashed border-[#8FD9A8]/60 bg-[#F4F7F6]"}`}>
                {!picked.length && <span className="text-slate-400 w-full text-center py-3">Chạm mảnh bên dưới để ghép câu</span>}
                {picked.map((w, i) => (
                  <button key={"p" + w.id} onClick={() => unpick(w)} disabled={done}
                    className={`zh ${tile} border-2 ${done ? "bg-[#2F8F6E] text-white border-transparent" : posOk(w, i) ? "bg-[#E7F5EC] border-[#2F8F6E] text-[#1B5E4B]" : feedback === "incorrect" ? "bg-white border-[#FECDD3] text-[#BE123C]" : "bg-white border-[#E2E8F0]"}`}>{w.text}</button>
                ))}
              </div>

              {feedback === "incorrect" && (
                <div className="mb-5 p-4 bg-[#FFF1F2] border border-[#FECDD3] rounded-[18px] text-sm">
                  <b className="text-[#BE123C]">Chưa đúng — mất 1 ❤️.</b> <span className="text-slate-600">Các mảnh <b className="text-[#2F8F6E]">viền xanh</b> đã đúng vị trí; chạm mảnh đỏ để gỡ ra, hoặc bấm 💡 Gợi ý để đặt sẵn mảnh tiếp theo.</span>
                </div>
              )}
              {done && (
                <div className={`mb-5 p-5 rounded-[18px] border ${feedback === "correct" ? "bg-[#EEF5E9] border-[#8FD9A8]" : "bg-[#FFF8E8] border-[#FFD666]"}`}>
                  <div className="font-black">{feedback === "correct" ? "🎉 太棒了！Chính xác!" : hearts <= 0 ? "💔 Hết tim — đáp án đúng:" : "📖 Đáp án đúng:"}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="zh text-2xl font-black">{cur.chinese}</span>
                    <button onClick={() => speak(cur.chinese)} aria-label="Nghe câu" className="w-9 h-9 rounded-full bg-white border border-[#E2E8F0]">🔊</button>
                  </div>
                  {pyOf(cur) && <div className="text-[#2F8F6E] font-semibold mt-1">{pyOf(cur)}</div>}
                  {cur.vietnamese && <div className="text-slate-600 mt-1">{cur.vietnamese}</div>}
                  {cur.key && <div className="text-sm text-slate-600 mt-2"><span className="zh font-black">{cur.key.z}</span> {cur.key.py} — {cur.key.vn}</div>}
                </div>
              )}

              {!done && (
                <div className="flex flex-wrap justify-center gap-2.5 mb-6">
                  {pool.map((w) => <button key={"a" + w.id} onClick={() => pick(w)} className={`zh ${tile} bg-white border-2 border-slate-100 hover:-translate-y-0.5 hover:border-[#8FD9A8]`}>{w.text}</button>)}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                {done ? (
                  <button onClick={next} className="w-full py-4 bg-[#2F8F6E] text-white rounded-2xl font-black hover:bg-[#1B5E4B] border-b-[4px] border-[#0F3F31]">{hearts <= 0 || idx + 1 >= questions.length ? "Xem kết quả 🏁" : "Câu tiếp theo ➔"}</button>
                ) : (
                  <>
                    <button onClick={hint} className="flex-1 py-3.5 bg-[#FFF8E8] border-2 border-[#FFD666]/70 text-amber-700 rounded-2xl font-black text-sm">💡 Gợi ý (−3 XP)</button>
                    <button onClick={clearAll} disabled={!picked.length} className="flex-1 py-3.5 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-sm disabled:opacity-40">↶ Làm lại</button>
                    <button onClick={giveUp} className="flex-1 py-3.5 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-sm">🏳️ Xem đáp án</button>
                    <button onClick={check} disabled={!picked.length} className="flex-[2] py-3.5 bg-[#1B5E4B] text-white rounded-2xl font-black text-sm disabled:opacity-40 border-b-[4px] border-[#0F3F31]">Kiểm tra →</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------- KẾT QUẢ ---------- */}
        {phase === "result" && (
          <div className="w-full max-w-xl bg-white p-8 md:p-12 rounded-[32px] border border-[#E2E8F0] text-center">
            <div className="text-7xl">{hearts > 0 ? "🎉" : "💔"}</div>
            <h2 className="text-3xl font-black mt-3">{hearts > 0 ? "Hoàn thành!" : "Hết tim rồi!"}</h2>
            <div className="mt-6 bg-[#FFF8E8] border border-[#FFD666]/40 rounded-[24px] p-6 flex justify-around">
              <div><div className="text-xs font-bold text-amber-700">Câu đúng</div><div className="text-4xl font-black text-slate-800">{score}<span className="text-lg text-slate-400"> / {questions.length}</span></div></div>
              <div><div className="text-xs font-bold text-amber-700">Phần thưởng</div><div className="text-2xl font-black text-[#E8A20C]">⭐ +{earned.xp}</div><div className="text-2xl font-black text-[#4FB6C7]">💧 +{earned.water}</div></div>
            </div>
            {!userId && <p className="text-sm text-slate-500 mt-3">Đăng nhập để được cộng XP.</p>}
            {mistakes.length > 0 && (
              <div className="mt-6 text-left">
                <div className="font-black mb-2">📌 Câu cần ôn lại</div>
                <ul className="flex flex-col gap-2">
                  {mistakes.map((m) => (
                    <li key={m.chinese} className="p-3 rounded-xl bg-[#FFF1F2]">
                      <div className="flex items-center gap-2"><span className="zh font-black text-lg flex-1">{m.chinese}</span><button onClick={() => speak(m.chinese)} aria-label="Nghe câu" className="w-8 h-8 rounded-full bg-white">🔊</button></div>
                      {pyOf(m) && <div className="text-sm text-[#2F8F6E]">{pyOf(m)}</div>}
                      {m.vietnamese && <div className="text-sm text-slate-600">{m.vietnamese}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3 mt-8">
              <Link href="/?tab=play" className="flex-1 py-4 bg-[#F4F7F6] text-slate-600 font-black rounded-2xl border border-[#E2E8F0] grid place-items-center">Về khu Chơi</Link>
              {mistakes.length > 0 && <button onClick={() => { const qs = shuffle(mistakes); setQuestions(qs); setIdx(0); setHearts(HEARTS); setScore(0); setHintsUsed(0); setMistakes([]); ended.current = false; setPhase("playing"); load(qs[0]); }} className="flex-1 py-4 bg-[#FFF8E8] border-2 border-[#FFD666] font-black rounded-2xl">🔁 Luyện lại câu sai</button>}
              <button onClick={start} className="flex-1 py-4 bg-[#1B5E4B] text-white font-black rounded-2xl border-b-[4px] border-[#0F3F31]">Chơi lượt mới</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
