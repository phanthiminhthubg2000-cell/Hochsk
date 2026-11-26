"use client";
// SHADOWING — luyện nói nhại theo từng câu ngắn của bài khoá (HSK 3.0 quyển 1–3).
// 4 bước: ① Nghe (có chữ + pinyin) ② Nghe che chữ ③ Nói đè cùng giọng mẫu ④ Tự nói → AI chấm từng chữ.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import GardenNav from "../GardenNav";
import { useTuVi } from "../useTuVi";
import dictationData from "../dictation.json";

const zhF = { fontFamily: '"Noto Serif SC","Noto Sans SC",serif' };
const LEVELS = ["HSK 1 (3.0)", "HSK 2 (3.0)", "HSK 3 (3.0)"];
const STEPS = [["1", "Nghe", "Nghe câu mẫu, nhìn chữ và pinyin"], ["2", "Che chữ", "Nghe không nhìn chữ, nhẩm theo"], ["3", "Nói đè", "Nói cùng lúc với giọng mẫu (nên đeo tai nghe)"], ["4", "Tự nói", "Tự nói lại cả câu, AI chấm từng chữ"]];
const ST = { ok: ["#2F6E5A", "Đúng"], tone: ["#B7791F", "Sai thanh"], wrong: ["#BE123C", "Sai âm"], miss: ["#94A3B8", "Thiếu"] };
const lessonNo = (it) => +(String(it.lesson).match(/Bài\s*(\d+)/)?.[1] || 0);
const paraNo = (it) => +(String(it.lesson).match(/Câu\s*(\d+)/)?.[1] || 0);
// số thứ tự đoạn trong bài (dữ liệu đánh số Câu 1, 3, 5… → hiện Đoạn 1, 2, 3…)
const paraIdx = (it) => dictationData.filter((x) => x.level === it.level && lessonNo(x) === lessonNo(it) && paraNo(x) <= paraNo(it)).length;
const keyOf = (id, i) => `${id}#${i}`.replace(/[.\/]/g, "_");
const tone = (v) => (v >= 80 ? "#2F6E5A" : v >= 60 ? "#B7791F" : "#BE123C");

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"]) if (MediaRecorder.isTypeSupported?.(m)) return m;
  return "";
}

export default function Shadowing() {
  const { u, userId, isSignedIn, gain } = useTuVi();
  const [segs, setSegs] = useState(null);
  const [lv, setLv] = useState(LEVELS[0]);
  const [cur, setCur] = useState(null); // { id } đoạn đang luyện
  const [py, setPy] = useState(null);
  useEffect(() => {
    fetch("/shadowing/segments.json").then((r) => r.json()).then(setSegs).catch(() => setSegs({}));
    import("pinyin-pro").then((m) => setPy(() => m.pinyin)).catch(() => {});
    const q = new URLSearchParams(location.search); const id = q.get("id"); const l = q.get("lv");
    if (l && LEVELS.includes(l)) setLv(l);
    if (id) setCur(id);
  }, []);
  const best = u?.shadow || {};
  const items = useMemo(() => dictationData.filter((x) => x.level === lv && segs?.[x.id]).sort((a, b) => lessonNo(a) - lessonNo(b) || paraNo(a) - paraNo(b)), [lv, segs]);
  const lessons = useMemo(() => { const m = new Map(); items.forEach((x) => { const k = lessonNo(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return [...m.entries()]; }, [items]);
  const item = cur && dictationData.find((x) => x.id === cur);

  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="practice" title="Shadowing · Nói nhại" />
      <main className="max-w-[1100px] mx-auto px-3 md:px-6 pt-5 pb-28 md:pb-14">
        {item && segs ? (
          <Practice key={item.id} item={item} segs={segs[item.id] || []} py={py} best={best} userId={userId} gain={gain}
            onBack={() => { setCur(null); try { history.replaceState(null, "", "/shadowing?lv=" + encodeURIComponent(item.level)); } catch {} }}
            onNext={() => { const all = dictationData.filter((x) => x.level === item.level && segs[x.id]).sort((a, b) => lessonNo(a) - lessonNo(b) || paraNo(a) - paraNo(b)); const i = all.findIndex((x) => x.id === item.id); const n = all[i + 1]; if (n) { setCur(n.id); try { history.replaceState(null, "", "/shadowing?id=" + n.id); } catch {} } else setCur(null); }} />
        ) : (
          <>
            <header className="mb-4">
              <div className="text-[12px] tracking-[0.2em] font-bold text-[#8C7550] uppercase">跟读 · Thiên Âm Cốc</div>
              <h1 className="font-serif-vn text-[28px] md:text-[34px] font-extrabold">Shadowing · Nói nhại</h1>
              <p className="text-[14px] text-[#6B6253] max-w-2xl">Luyện từng câu ngắn của bài khoá qua 4 bước: nghe – nghe che chữ – nói đè cùng giọng mẫu – tự nói. AI nghe giọng bạn và chỉ ra chữ nào sai âm, sai thanh. Mỗi câu lần đầu đạt từ 80 điểm được +5 tu vi.</p>
            </header>
            {!isSignedIn && <p className="mb-4 rounded-[8px] bg-white border border-[#D8CBAE] p-3 text-[14px]">Đăng nhập để AI chấm và lưu tiến độ.</p>}
            <div className="flex gap-2 mb-4 flex-wrap">{LEVELS.map((l) => <button key={l} onClick={() => setLv(l)} className={`h-10 px-4 rounded-full border text-[14px] font-bold ${lv === l ? "bg-[#1C1A17] text-[#F3EEE2] border-[#1C1A17]" : "bg-white border-[#D8CBAE]"}`}>{l}</button>)}</div>
            {!segs ? <p className="text-[#6B6253]">Đang tải…</p> : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {lessons.map(([no, list]) => {
                  const keys = list.flatMap((x) => (segs[x.id] || []).map((_, i) => keyOf(x.id, i)));
                  const done = keys.filter((k) => (best[k] || 0) >= 80).length;
                  return (
                    <div key={no} className="rounded-[10px] bg-white border border-[#D8CBAE] p-3">
                      <div className="flex items-baseline justify-between"><b className="font-serif-vn text-[17px]">Bài {no}</b><span className="text-[12px] text-[#6B6253]">{done}/{keys.length} câu đạt</span></div>
                      <div className="h-1.5 rounded bg-[#EFE7D6] mt-1.5 overflow-hidden"><div className="h-full bg-[#2F6E5A]" style={{ width: `${(done / Math.max(1, keys.length)) * 100}%` }} /></div>
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {list.map((x) => { const ks = (segs[x.id] || []).map((_, i) => keyOf(x.id, i)); const ok = ks.every((k) => (best[k] || 0) >= 80); return (
                          <button key={x.id} onClick={() => { setCur(x.id); try { history.replaceState(null, "", "/shadowing?id=" + x.id); } catch {} }} className={`h-9 px-3 rounded-[6px] border text-[13px] font-bold ${ok ? "bg-[#E6F2EC] border-[#9CC7B2] text-[#2F6E5A]" : "bg-[#FAF6EC] border-[#D8CBAE]"}`} title={x.fullText}>Đoạn {paraIdx(x)} · {ks.length} câu</button>
                        ); })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function Practice({ item, segs, py, best, userId, gain, onBack, onNext }) {
  const audio = useRef(null), stopAt = useRef(0), loopLeft = useRef(0), onDone = useRef(null);
  const rec = useRef(null), chunks = useRef([]), stream = useRef(null), autoStop = useRef(null);
  const [i, setI] = useState(0); const [step, setStep] = useState(0); const [rate, setRate] = useState(1); const [loop, setLoop] = useState(false);
  const [playing, setPlaying] = useState(false); const [recording, setRecording] = useState(false);
  const [mine, setMine] = useState(null); const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState(""); const [peek, setPeek] = useState(false);
  const seg = segs[i] || { t: "", s: 0, e: 0 };
  const key = keyOf(item.id, i);
  const pys = useMemo(() => (py ? py(seg.t, { type: "array" }) : []), [py, seg.t]);
  const chars = [...seg.t];

  useEffect(() => { setRes(null); setMine(null); setErr(""); setPeek(false); stopAudio(); }, [i, step]); // eslint-disable-line
  useEffect(() => () => { stopAudio(); try { stream.current?.getTracks().forEach((t) => t.stop()); } catch {} }, []); // eslint-disable-line

  const stopAudio = () => { const a = audio.current; if (a) a.pause(); setPlaying(false); loopLeft.current = 0; };
  const play = useCallback((times = loop ? 3 : 1, done) => {
    const a = audio.current; if (!a) return;
    loopLeft.current = times; onDone.current = done || null;
    a.playbackRate = rate; a.currentTime = seg.s; stopAt.current = seg.e; a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [seg.s, seg.e, rate, loop]);
  const onTime = () => {
    const a = audio.current; if (!a || !stopAt.current) return;
    if (a.currentTime >= stopAt.current) {
      if (--loopLeft.current > 0) { a.currentTime = seg.s; return; }
      a.pause(); setPlaying(false); stopAt.current = 0; const d = onDone.current; onDone.current = null; d?.();
    }
  };

  const startRec = async (withModel) => {
    setErr(""); setRes(null); setMine(null);
    try {
      if (!stream.current) stream.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const mt = pickMime();
      const r = mt ? new MediaRecorder(stream.current, { mimeType: mt }) : new MediaRecorder(stream.current);
      chunks.current = []; r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      r.onstop = () => finish(r.mimeType || mt || "audio/webm");
      r.start(); rec.current = r; setRecording(true);
      const dur = Math.max(1.5, (seg.e - seg.s) / rate);
      if (withModel) play(1, () => { clearTimeout(autoStop.current); autoStop.current = setTimeout(stopRec, 900); });
      clearTimeout(autoStop.current); autoStop.current = setTimeout(stopRec, (withModel ? dur + 1.2 : dur * 2 + 3) * 1000);
    } catch { setErr("Chưa dùng được micro — hãy cho phép trình duyệt truy cập micro."); }
  };
  const stopRec = () => { clearTimeout(autoStop.current); const r = rec.current; if (r && r.state !== "inactive") r.stop(); rec.current = null; setRecording(false); stopAudio(); };
  const finish = async (mt) => {
    const blob = new Blob(chunks.current, { type: mt.split(";")[0] });
    if (blob.size < 1500) { setErr("Chưa nghe thấy tiếng — thử lại và nói to hơn nhé."); return; }
    setMine(URL.createObjectURL(blob));
    if (!userId) { setErr("Đăng nhập để AI chấm điểm."); return; }
    setBusy(true);
    try {
      const b64 = await new Promise((ok) => { const fr = new FileReader(); fr.onloadend = () => ok(fr.result); fr.readAsDataURL(blob); });
      let d = null, last = "";
      for (let k = 0; k < 2 && !d; k++) {
        const r = await fetch("/api/shadowing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetText: seg.t, audioBase64: b64, mimeType: mt.split(";")[0], pinyin: pys.filter((p, j) => /[㐀-鿿]/.test(chars[j])).join(" ") }) }).catch(() => null);
        const j = r ? await r.json().catch(() => ({})) : {};
        if (r?.ok && !j.error) d = j; else { last = j.error || "Mất kết nối"; if (r && ![429, 500, 502, 503, 504].includes(r.status)) break; }
      }
      if (!d) throw new Error(last);
      setRes(d);
      const prev = best[key] || 0;
      if (d.score > prev) {
        await setDoc(doc(db, "users", userId), { shadow: { [key]: d.score } }, { merge: true }).catch(() => {});
        if (prev < 80 && d.score >= 80) gain?.(5);
      }
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };

  const hideText = step === 1 || (step === 3 && !res && !peek);
  const next = () => { if (i + 1 < segs.length) { setI(i + 1); setStep(0); } else onNext(); };

  return (
    <div className="grid lg:grid-cols-[1fr_300px] gap-4">
      <audio ref={audio} src={item.audioUrl} preload="auto" onTimeUpdate={onTime} onEnded={() => setPlaying(false)} />
      <section className="rounded-[12px] bg-white border border-[#D8CBAE] p-4 md:p-6">
        <div className="flex items-center gap-2 flex-wrap text-[13px] mb-3">
          <button onClick={onBack} className="h-9 px-3 rounded-[6px] border border-[#D8CBAE] font-bold">‹ Danh sách</button>
          <b>{item.level} · Bài {lessonNo(item)} · Đoạn {paraIdx(item)}</b>
          <span className="text-[#6B6253]">Câu {i + 1}/{segs.length}</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5 mb-4" role="tablist">
          {STEPS.map(([n, t], k) => (
            <button key={n} role="tab" aria-selected={step === k} onClick={() => setStep(k)} className={`rounded-[8px] border py-2 text-[13px] font-bold leading-tight ${step === k ? "bg-[#1C1A17] text-[#F3EEE2] border-[#1C1A17]" : "bg-[#FAF6EC] border-[#D8CBAE] text-[#6B6253]"}`}>
              <span className="block text-[11px] opacity-70">Bước {n}</span>{t}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-[#6B6253] mb-3">{STEPS[step][2]}</p>

        {/* câu */}
        <div className="rounded-[10px] bg-[#FAF6EC] border border-[#E4D9C3] px-3 py-5 min-h-[120px] grid place-items-center">
          {hideText ? (
            <div className="text-center">
              <div className="text-[34px] tracking-[0.3em] text-[#CDBF9F]" aria-label="Câu đang được che">{chars.map((c) => (/[㐀-鿿]/.test(c) ? "▢" : c)).join("")}</div>
              {step === 3 && <button onClick={() => setPeek(true)} className="mt-1 text-[12px] underline text-[#6B6253]">Hiện chữ</button>}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-x-1 gap-y-2" style={zhF}>
              {chars.map((c, j) => {
                const isZh = /[㐀-鿿]/.test(c);
                const zi = isZh ? chars.slice(0, j).filter((x) => /[㐀-鿿]/.test(x)).length : -1;
                const r = res && isZh ? res.chars?.[zi] : null;
                const col = r ? ST[r.st]?.[0] : "#1C1A17";
                return (
                  <ruby key={j} className="text-center" style={{ rubyPosition: "over" }}>
                    <span className="text-[28px] md:text-[34px] font-bold" style={{ color: col, textDecoration: r && r.st !== "ok" ? "underline wavy" : "none", textUnderlineOffset: 6 }}>{c}</span>
                    <rt className="text-[12px] md:text-[13px] font-normal" style={{ color: r && r.st !== "ok" ? col : "#8C7550", fontFamily: "system-ui" }}>{isZh ? pys[j] : ""}</rt>
                  </ruby>
                );
              })}
            </div>
          )}
        </div>

        {/* điều khiển nghe */}
        <div className="flex items-center gap-2 flex-wrap mt-4">
          <button onClick={() => (playing ? stopAudio() : play())} className="h-11 px-5 rounded-[8px] bg-[#1C1A17] text-[#F3EEE2] font-bold">{playing ? "■ Dừng" : "▶ Nghe mẫu"}</button>
          <div className="flex rounded-[8px] border border-[#D8CBAE] overflow-hidden text-[13px] font-bold">{[0.75, 1].map((r) => <button key={r} onClick={() => setRate(r)} className={`h-11 px-3 ${rate === r ? "bg-[#EFE7D6]" : "bg-white"}`}>{r === 1 ? "1×" : "0.75×"}</button>)}</div>
          <button onClick={() => setLoop((x) => !x)} className={`h-11 px-3 rounded-[8px] border text-[13px] font-bold ${loop ? "bg-[#EFE7D6] border-[#8C7550]" : "bg-white border-[#D8CBAE]"}`} aria-pressed={loop}>🔁 Lặp 3 lần</button>
          {step < 2 && <button onClick={() => setStep(step + 1)} className="h-11 px-4 rounded-[8px] border border-[#D8CBAE] text-[13px] font-bold ml-auto">Bước tiếp →</button>}
        </div>

        {/* thu âm */}
        {step >= 2 && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <button onClick={() => (recording ? stopRec() : startRec(step === 2))} disabled={busy}
              className={`w-24 h-24 rounded-full grid place-items-center text-[34px] border-4 transition-all disabled:opacity-50 ${recording ? "bg-[#BE123C] border-[#FECDD3] text-white animate-pulse" : "bg-white border-[#D8CBAE] hover:border-[#9E2F22]"}`} aria-label={recording ? "Dừng ghi âm" : "Bắt đầu ghi âm"}>{recording ? "■" : "🎙️"}</button>
            <p className="text-[13px] font-bold text-[#6B6253]">{busy ? "AI đang nghe và chấm… (5–15 giây)" : recording ? (step === 2 ? "Đang nói đè cùng giọng mẫu… tự dừng khi hết câu" : "Đang ghi âm… bấm ■ khi nói xong") : step === 2 ? "Bấm để phát mẫu và nói đè cùng lúc" : "Bấm để ghi âm, nói xong bấm lại"}</p>
          </div>
        )}
        {err && <p className="mt-3 text-center text-[14px] text-[#BE123C]">{err}</p>}

        {/* kết quả */}
        {res && (
          <div className="mt-5 rounded-[10px] border border-[#E4D9C3] p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-20 h-20 rounded-full grid place-items-center border-[6px]" style={{ borderColor: tone(res.score) }}><b className="text-[24px]" style={{ color: tone(res.score) }}>{res.score}</b></div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[13px]">
                {[["Chính xác", res.accuracy], ["Thanh điệu", res.tone], ["Trôi chảy", res.fluency], ["Ngữ điệu", res.intonation]].map(([l, v]) => <span key={l}>{l}: <b style={{ color: tone(v) }}>{v}</b></span>)}
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] ml-auto">{Object.entries(ST).map(([k, [c, l]]) => <span key={k} className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: c }} />{l}</span>)}</div>
            </div>
            {res.chars?.some((x) => x.st !== "ok") && (
              <ul className="mt-3 text-[14px] grid gap-1">
                {res.chars.filter((x) => x.st !== "ok").slice(0, 6).map((x, k) => <li key={k}><b style={{ ...zhF, color: ST[x.st][0] }}>{x.c}</b> <span className="text-[#6B6253]">{x.py}</span>{x.heard ? <> — bạn đọc <b>{x.heard}</b></> : null} <span className="text-[12px]" style={{ color: ST[x.st][0] }}>({ST[x.st][1]})</span></li>)}
              </ul>
            )}
            {res.feedback && <p className="mt-3 text-[14px] leading-6">{res.feedback}</p>}
            {res.score >= 80 && (best[key] || 0) < 80 && <p className="mt-2 text-[12px] font-bold text-[#9E2F22]">+5 tu vi</p>}
            <div className="flex gap-2 flex-wrap mt-4">
              {mine && <button onClick={() => { stopAudio(); new Audio(mine).play(); }} className="h-10 px-4 rounded-[8px] border border-[#D8CBAE] text-[13px] font-bold">▶ Giọng mình</button>}
              <button onClick={() => play(1)} className="h-10 px-4 rounded-[8px] border border-[#D8CBAE] text-[13px] font-bold">▶ Giọng mẫu</button>
              <button onClick={() => { setRes(null); setMine(null); }} className="h-10 px-4 rounded-[8px] border border-[#D8CBAE] text-[13px] font-bold">↻ Thử lại</button>
              <button onClick={next} className="h-10 px-4 rounded-[8px] bg-[#2F6E5A] text-white text-[13px] font-bold ml-auto">{i + 1 < segs.length ? "Câu tiếp →" : "Đoạn tiếp →"}</button>
            </div>
          </div>
        )}
        {!res && mine && !busy && <div className="mt-3 text-center"><button onClick={() => new Audio(mine).play()} className="h-10 px-4 rounded-[8px] border border-[#D8CBAE] text-[13px] font-bold">▶ Nghe lại giọng mình</button></div>}
      </section>

      {/* danh sách câu */}
      <aside className="rounded-[12px] bg-white border border-[#D8CBAE] p-3 h-fit lg:sticky lg:top-24">
        <div className="flex items-center justify-between mb-2"><b className="text-[14px]">Các câu trong đoạn</b><button onClick={() => { stopAudio(); const a = audio.current; if (a) { a.playbackRate = rate; a.currentTime = segs[0]?.s || 0; stopAt.current = segs[segs.length - 1]?.e || 0; loopLeft.current = 1; a.play(); setPlaying(true); } }} className="text-[12px] underline text-[#6B6253]">▶ Nghe cả đoạn</button></div>
        <ol className="grid gap-1">
          {segs.map((s, k) => { const b = best[keyOf(item.id, k)]; return (
            <li key={k}><button onClick={() => { setI(k); setStep(0); }} className={`w-full text-left rounded-[6px] px-2 py-1.5 text-[14px] flex items-start gap-2 ${k === i ? "bg-[#EFE7D6]" : "hover:bg-[#FAF6EC]"}`}>
              <span className="text-[11px] text-[#8C7550] mt-1 w-4">{k + 1}</span><span className="flex-1" style={zhF}>{s.t}</span>
              {b != null && <b className="text-[12px] mt-0.5" style={{ color: tone(b) }}>{b}</b>}
            </button></li>
          ); })}
        </ol>
      </aside>
    </div>
  );
}
