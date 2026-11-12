"use client";
// ============================================================
// CON ĐƯỜNG TU LUYỆN 修行之路 · một bài HSK6 thành chuỗi ải kiểu Duolingo
// Bản đồ ải → phiên học: linh lực (mạng), chuỗi đúng, câu sai hỏi lại cuối phiên, tu vi khi qua ải.
// Tiến độ: localStorage cd_<bai> và users/{uid}.conDuong.<bai>.<ải> (Firestore)
// ============================================================
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase";
import GardenNav from "../../GardenNav";
import { useTuVi } from "../../useTuVi";
import { speakZh, stopSpeak, preloadAudio } from "../../amThanh";
import { loadLesson, buildNodes, makeQuestions, tuViOf, norm, strip } from "../engine";

const hl = (s, w) => { const i = w ? s.indexOf(w) : -1; return i < 0 ? s : <>{s.slice(0, i)}<b className="text-[#9E2F22]">{w}</b>{s.slice(i + w.length)}</>; };

const KIND_LABEL = { vocab: "Từ vựng", grammar: "Ngữ pháp", text: "Bài khóa", bt: "Luyện tập", boss: "Thí luyện", write: "Ngộ đạo" };
const OFFSET = [0, 56, 84, 56, 0, -56, -84, -56];
const LABELS = ["甲", "乙", "丙", "丁"];
const ZH = { fontFamily: '"Noto Serif SC","Noto Sans SC",serif' };
const HEARTS = 5;

const readProg = (id) => { try { return JSON.parse(localStorage.getItem(`cd_${id}`) || "{}"); } catch (_) { return {}; } };

export default function ConDuongBai() {
  const { bai } = useParams();
  const { u, userId, isSignedIn, gain } = useTuVi();
  const [L, setL] = useState(null);
  const [err, setErr] = useState("");
  const [local, setLocal] = useState({});
  const [sess, setSess] = useState(null);
  const [writeNode, setWriteNode] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => { preloadAudio(); setLocal(readProg(bai)); loadLesson(bai).then(setL).catch(() => setErr("Không tìm thấy bài này.")); }, [bai]);
  const nodes = useMemo(() => (L ? buildNodes(L) : []), [L]);
  const prog = useMemo(() => ({ ...(u?.conDuong?.[bai] || {}), ...local }), [u, bai, local]);
  const doneCount = nodes.filter((n) => prog[n.key]).length;
  const curIdx = nodes.findIndex((n) => !prog[n.key]);

  const markDone = async (node, tv) => {
    const first = !prog[node.key];
    const next = { ...readProg(bai), [node.key]: 1 };
    try { localStorage.setItem(`cd_${bai}`, JSON.stringify(next)); } catch (_) {}
    setLocal(next);
    if (isSignedIn && userId) {
      await setDoc(doc(db, "users", userId), { conDuong: { [bai]: { [node.key]: 1 } } }, { merge: true }).catch(() => {});
      if (tv > 0) await gain(tv);
    }
    return first;
  };

  const open = (node, i) => {
    if (i > 0 && !prog[nodes[i - 1].key] && !prog[node.key]) { setToast("Qua ải trước để mở ải này."); setTimeout(() => setToast(""), 2200); return; }
    if (node.kind === "write") { setWriteNode(node); window.scrollTo({ top: 0 }); return; }
    const qs = makeQuestions(L, node, { intro: true }).map((q, id) => ({ ...q, id }));
    if (!qs.length) { setToast("Ải này chưa có câu hỏi."); setTimeout(() => setToast(""), 2200); return; }
    setSess({ node, qs, queue: qs.map((q) => q.id), solved: new Set(), missed: new Set(), hearts: node.hearts || HEARTS, streak: 0, best: 0, firstTime: !prog[node.key], t0: Date.now() });
  };

  if (sess) return <Session sess={sess} setSess={setSess} onFinish={markDone} signedIn={isSignedIn} />;
  if (writeNode) return <WriteNode L={L} node={writeNode} done={!!prog[writeNode.key]} onClose={() => { setWriteNode(null); window.scrollTo({ top: 0 }); }} onDone={markDone} signedIn={isSignedIn} />;

  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Con đường tu luyện" />
      <main className="max-w-[560px] mx-auto px-4 pt-5 pb-28 md:pb-16 flex flex-col gap-5">
        {err && <p className="tt-card px-4 py-3">{err} <Link href="/con-duong" className="font-bold text-[#9E2F22] underline">Xem danh sách bài</Link></p>}
        {L && (
          <>
            <section className="rounded-[14px] bg-[#1C1A17] text-[#F3EEE2] p-5 flex flex-col gap-2 shadow-[4px_4px_0_#9E2F22]">
              <div className="flex items-center justify-between gap-2 text-xs font-bold tracking-[0.12em] text-[#CFC3A8]">
                <Link href="/con-duong" className="hover:text-white">‹ HSK 6 · BÀI {L.num}</Link>
                <span>{doneCount}/{nodes.length} ải</span>
              </div>
              <h1 className="text-[30px] leading-tight" style={ZH} lang="zh-CN">{L.title}</h1>
              <p className="font-serif-vn italic text-[#E9DFC8]">{L.vn}</p>
              <div className="h-2 rounded-sm bg-white/15 overflow-hidden" aria-hidden="true"><div className="h-full bg-[#E6B656]" style={{ width: `${(doneCount / Math.max(1, nodes.length)) * 100}%` }} /></div>
              <div className="flex gap-3 text-sm pt-1">
                {L.lecture && <a href={L.lecture} target="_blank" rel="noreferrer" className="font-bold text-[#E6B656] underline underline-offset-2">Mở bài giảng (sách)</a>}
                {!isSignedIn && <span className="text-[#CFC3A8]">Đăng nhập để nhận tu vi.</span>}
              </div>
            </section>

            <ol className="flex flex-col items-center gap-1 py-2" aria-label="Các ải của bài">
              {nodes.map((n, i) => {
                const done = !!prog[n.key]; const cur = i === curIdx; const locked = !done && !cur;
                const head = i === 0 || nodes[i - 1].kind !== n.kind;
                return (
                  <li key={n.key} className="w-full flex flex-col items-center">
                    {head && <div className="w-full flex items-center gap-3 my-3" aria-hidden="true"><span className="flex-1 h-px bg-[#CDBF9F]" /><span className="font-serif-vn text-xs font-bold tracking-[0.14em] text-[#6B6253] uppercase">{KIND_LABEL[n.kind]}</span><span className="flex-1 h-px bg-[#CDBF9F]" /></div>}
                    <button onClick={() => open(n, i)} style={{ transform: `translateX(${OFFSET[i % OFFSET.length]}px)` }}
                      aria-label={`${n.vn} · ${n.sub}${done ? " · đã qua" : cur ? " · ải hiện tại" : " · chưa mở"}`}
                      className="group flex flex-col items-center gap-1.5 py-1">
                      <span className={`relative w-[74px] h-[70px] rounded-full grid place-items-center font-brush text-[34px] transition-transform group-active:translate-y-1 ${done ? "bg-[#E6B656] text-[#1C1A17] shadow-[0_6px_0_#A07A2C]" : cur ? "bg-[#9E2F22] text-[#FBF3E4] shadow-[0_6px_0_#6A1D14]" : "bg-[#D8CBAE] text-[#8C7F68] shadow-[0_6px_0_#B9AD97]"}`}>
                        {cur && <span className="absolute -inset-2 rounded-full border-2 border-[#9E2F22]/50 cd-pulse" aria-hidden="true" />}
                        {locked ? <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h6V8a3 3 0 0 0-6 0v2z" /></svg> : n.zh}
                      </span>
                      <span className="text-center leading-tight"><b className={`block text-[15px] ${locked ? "text-[#8C7F68]" : ""}`}>{n.vn}</b><span className="block text-xs text-[#6B6253] max-w-[200px]">{n.sub}</span></span>
                      {cur && <span className="text-[11px] font-extrabold tracking-wider text-[#9E2F22]">{doneCount ? "TIẾP TỤC" : "BẮT ĐẦU"}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
            {doneCount === nodes.length && nodes.length > 0 && <p className="tt-card px-4 py-3 text-center font-serif-vn font-bold">Đã đi hết con đường của bài này. Mỗi ải có thể luyện lại — đề rút ngẫu nhiên mỗi lần.</p>}
          </>
        )}
        {!L && !err && <p className="text-center text-[#6B6253] py-10">Đang mở con đường…</p>}
      </main>
      {toast && <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50 bg-[#1C1A17] text-[#F3EEE2] px-4 py-2.5 rounded-md text-sm font-bold shadow-lg">{toast}</div>}
      <style>{`@keyframes cdPulse{0%{transform:scale(.95);opacity:.9}70%{transform:scale(1.15);opacity:0}100%{opacity:0}}.cd-pulse{animation:cdPulse 1.8s ease-out infinite}@media (prefers-reduced-motion:reduce){.cd-pulse{animation:none}}`}</style>
    </div>
  );
}

// ---------------- phiên học ----------------
function Session({ sess, setSess, onFinish, signedIn }) {
  const [picked, setPicked] = useState(null);       // choice: index · tiles: [index mảnh]
  const [checked, setChecked] = useState(null);     // { ok }
  const [end, setEnd] = useState(null);
  const q = sess.qs[sess.queue[0]];
  const total = sess.qs.length;

  useEffect(() => { setPicked(q?.k === "tiles" ? [] : null); setChecked(null); }, [q?.id, sess.step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (q?.say && !checked) { const t = setTimeout(() => speakZh(q.say), 350); return () => { clearTimeout(t); stopSpeak(); }; } }, [q?.id, sess.step]); // eslint-disable-line react-hooks/exhaustive-deps

  const canCheck = q && !checked && (q.k === "choice" ? typeof picked === "number" : q.k === "tiles" ? Array.isArray(picked) && picked.length > 0 : false);
  const check = (forceOk) => {
    if (!q || checked) return;
    const ok = forceOk ?? (q.k === "choice" ? picked === q.a : norm((Array.isArray(picked) ? picked : []).map((i) => q.tiles[i]).join("")) === norm(q.ans));
    const missed = new Set(sess.missed); const solved = new Set(sess.solved);
    let hearts = sess.hearts, streak = sess.streak;
    if (ok) { solved.add(q.id); streak += 1; } else { missed.add(q.id); hearts -= 1; streak = 0; }
    setChecked({ ok });
    setSess({ ...sess, missed, solved, hearts, streak, best: Math.max(sess.best, streak) });
    if (!ok && q.word) speakZh(q.word);
  };
  const next = async () => {
    const [head, ...rest] = sess.queue;
    const queue = checked?.ok ? rest : [...rest, head];
    if (sess.hearts <= 0) { setEnd({ failed: true }); return; }
    if (!queue.length) {
      const graded = sess.qs.filter((x) => x.k !== "card");
      const firstTry = graded.filter((x) => !sess.missed.has(x.id)).length;
      const tv = tuViOf(sess.node, firstTry, graded.length, sess.firstTime);
      setEnd({ firstTry, graded: graded.length, tv, secs: Math.round((Date.now() - sess.t0) / 1000) });
      await onFinish(sess.node, tv);
      return;
    }
    setSess({ ...sess, queue, step: (sess.step || 0) + 1 });
  };
  const quit = () => { stopSpeak(); setSess(null); };
  // thẻ học: đọc xong bấm tiếp, không chấm
  const learn = () => { const [, ...rest] = sess.queue; const solved = new Set(sess.solved); solved.add(q.id); stopSpeak(); setSess({ ...sess, queue: rest, solved, step: (sess.step || 0) + 1 }); if (!rest.length) next2(solved); };
  const next2 = async (solved) => {
    const graded = sess.qs.filter((x) => x.k !== "card");
    const firstTry = graded.filter((x) => !sess.missed.has(x.id)).length;
    const tv = tuViOf(sess.node, firstTry, graded.length, sess.firstTime);
    setEnd({ firstTry, graded: graded.length, tv, secs: Math.round((Date.now() - sess.t0) / 1000) });
    await onFinish(sess.node, tv);
  };

  // phím tắt: 1–4 chọn, Enter kiểm tra / tiếp tục
  const ref = useRef({});
  ref.current = { q, checked, canCheck, check, next, end, learn };
  useEffect(() => {
    const h = (e) => {
      const s = ref.current; if (s.end || e.target?.tagName === "TEXTAREA") return;
      if (e.key === "Enter") { e.preventDefault(); if (s.q?.k === "card") s.learn(); else if (s.checked) s.next(); else if (s.canCheck) s.check(); }
      else if (s.q?.k === "choice" && !s.checked && /^[1-4]$/.test(e.key) && +e.key <= s.q.opts.length) setPicked(+e.key - 1);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  if (end) return <EndScreen end={end} sess={sess} total={total} signedIn={signedIn} onBack={quit} onRetry={() => { setEnd(null); setSess({ ...sess, queue: sess.qs.map((x) => x.id), solved: new Set(), missed: new Set(), hearts: sess.node.hearts || HEARTS, streak: 0, best: 0, t0: Date.now(), step: (sess.step || 0) + 1 }); }} />;
  if (!q) return null;
  const pct = (sess.solved.size / total) * 100;
  const retry = sess.missed.has(q.id) && !checked;

  return (
    <div className="fixed inset-0 z-[60] bg-[#EFE7D6] text-[#1C1A17] flex flex-col" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <header className="max-w-[720px] w-full mx-auto px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={quit} aria-label="Thoát ải" className="w-10 h-10 grid place-items-center rounded-md hover:bg-black/5 text-[#6B6253]"><svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        <div className="flex-1 h-4 rounded-full bg-[#D8CBAE] overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Tiến độ ải">
          <div className="h-full rounded-full bg-[#2F6E5A] transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
        <span className="inline-flex items-center gap-1 font-extrabold text-[#9E2F22]" aria-label={`Còn ${sess.hearts} linh lực`}>
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.7 4.5c2.1 0 3.6 1.2 4.4 2.5.4.6 1.4.6 1.8 0 .8-1.3 2.3-2.5 4.4-2.5 3.7 0 5.8 3.7 4.3 7.2C19.5 16.4 12 21 12 21z" /></svg>{sess.hearts}
        </span>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[640px] mx-auto px-4 pt-3 pb-8 flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap min-h-6">
            {q.isNew && <span className="text-[11px] font-extrabold tracking-wider px-2 py-0.5 rounded-[3px] bg-[#E6B656] text-[#1C1A17]">TỪ MỚI</span>}
            {retry && <span className="text-[11px] font-extrabold tracking-wider px-2 py-0.5 rounded-[3px] bg-[#9E2F22] text-white">LÀM LẠI CÂU SAI</span>}
            {sess.streak >= 3 && <span className="text-[11px] font-extrabold tracking-wider px-2 py-0.5 rounded-[3px] bg-[#1C1A17] text-[#E6B656]">{sess.streak} CÂU LIỀN</span>}
          </div>
          {q.ins && <h2 className="font-serif-vn text-[20px] md:text-[22px] font-extrabold leading-snug">{q.ins}</h2>}
          {q.k === "choice" && <Choice q={q} picked={picked} setPicked={setPicked} checked={checked} />}
          {q.k === "tiles" && <Tiles q={q} picked={Array.isArray(picked) ? picked : []} setPicked={setPicked} checked={checked} />}
          {q.k === "card" && <LearnCard q={q} />}
          {q.k === "match" && <Match key={`${q.id}-${sess.step || 0}`} q={q} onDone={(mist) => check(true) || (mist && setSess((s) => ({ ...s, missed: new Set([...s.missed, q.id]) })))} />}
        </div>
      </main>
      <footer className={`border-t-2 ${checked ? (checked.ok ? "bg-[#DCE9DF] border-[#2F6E5A]" : "bg-[#F3DDD6] border-[#9E2F22]") : "bg-[#EFE7D6] border-[#D8CBAE]"}`}>
        <div className="max-w-[720px] mx-auto px-4 py-4 flex flex-col md:flex-row md:items-center gap-3">
          {checked ? (
            <div className="flex-1 min-w-0" role="status" aria-live="polite">
              <div className={`font-serif-vn text-[20px] font-extrabold ${checked.ok ? "text-[#2F6E5A]" : "text-[#9E2F22]"}`}>{checked.ok ? (sess.streak >= 3 ? `Chính xác! ${sess.streak} câu liền` : "Chính xác!") : "Chưa đúng"}</div>
              {!checked.ok && <div className="text-[15px] mt-0.5">Đáp án: <b style={ZH} lang="zh-CN">{q.k === "choice" ? q.opts[q.a] : q.full || q.ans}</b></div>}
              {q.why && <div className="text-sm text-[#3A352C] mt-1 leading-relaxed [&_.zh]:font-[inherit]" dangerouslySetInnerHTML={{ __html: q.k === "tiles" && checked.ok ? q.full : q.why }} />}
              {!q.why && q.k === "tiles" && checked.ok && q.full && <div className="text-sm mt-1" style={ZH} dangerouslySetInnerHTML={{ __html: q.full }} />}
            </div>
          ) : <div className="flex-1 text-sm text-[#6B6253] hidden md:block">{q.k === "choice" ? "Phím 1–4 để chọn · Enter để kiểm tra" : q.k === "tiles" ? "Chạm mảnh để xếp · chạm lại để bỏ" : ""}</div>}
          {q.k === "card" ? (
            <button onClick={learn} className="min-h-[52px] w-full md:w-auto md:min-w-[200px] md:ml-auto px-6 rounded-md font-serif-vn text-[17px] font-extrabold text-[#FBF3E4] bg-[#1C1A17] shadow-[0_4px_0_#9E2F22]">Đã hiểu · tiếp</button>
          ) : q.k !== "match" || checked ? (
            <button onClick={checked ? next : () => check()} disabled={!checked && !canCheck}
              className={`h-13 min-h-[52px] md:min-w-[200px] px-6 rounded-md font-serif-vn text-[17px] font-extrabold text-[#FBF3E4] disabled:bg-[#B9AD97] disabled:shadow-none ${checked && !checked.ok ? "bg-[#9E2F22] shadow-[0_4px_0_#6A1D14]" : checked ? "bg-[#2F6E5A] shadow-[0_4px_0_#1E4A3C]" : "bg-[#1C1A17] shadow-[0_4px_0_#9E2F22]"}`}>
              {checked ? "Tiếp tục" : "Kiểm tra"}
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

// ---------------- thẻ học ----------------
const Lb = ({ children }) => <div className="text-[11px] font-extrabold tracking-[0.12em] uppercase text-[#8C7F68]">{children}</div>;
function LearnCard({ q }) {
  useEffect(() => { if (q.kind === "word") { const t = setTimeout(() => speakZh(q.zh), 300); return () => clearTimeout(t); } }, [q]);
  const box = "rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-4 flex flex-col gap-3";
  if (q.kind === "word") return (
    <article className={box} aria-label={`Thẻ từ ${q.zh}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-extrabold tracking-wider px-2 py-0.5 rounded-[3px] bg-[#E6B656]">TỪ MỚI</span>
        {q.pos && <span className="text-xs font-bold px-2 py-0.5 rounded-[3px] bg-[#1C1A17] text-[#F3EEE2]">{q.pos}</span>}
        {q.style && <span className="text-xs font-bold px-2 py-0.5 rounded-[3px] bg-[#2F6E5A] text-white">{q.style}</span>}
        {!q.use && <span className="text-xs font-bold px-2 py-0.5 rounded-[3px] bg-[#E4DAC4] text-[#6B6253]">chỉ cần nhận biết</span>}
      </div>
      <div className="flex items-center gap-3"><span className="text-[48px] leading-none" style={ZH} lang="zh-CN">{q.zh}</span><SayBtn text={q.zh} /></div>
      <div className="text-[17px]">{q.py}{q.hv && <span className="text-[#8C7F68]"> · {q.hv}</span>}</div>
      <div className="text-[18px] font-bold">{q.vn}</div>
      {q.def && <div><Lb>释义 · giải nghĩa tiếng Trung</Lb><p className="text-[17px] leading-relaxed" style={ZH} lang="zh-CN">{q.def}</p></div>}
      {q.ex && <div><Lb>Ví dụ</Lb><div className="flex items-start gap-2"><p className="flex-1 text-[18px] leading-relaxed" style={ZH} lang="zh-CN">{hl(q.ex, q.zh)}</p><button onClick={() => speakZh(q.ex)} aria-label="Nghe câu ví dụ" className="text-[#9E2F22] p-1"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" /></svg></button></div><p className="text-[15px] text-[#4A4238]">{q.exVn}</p></div>}
      {q.inText && <div><Lb>Trong bài khóa</Lb><p className="text-[16px]" style={ZH} lang="zh-CN">{hl(q.inText, q.zh)}</p></div>}
      {q.col.length > 0 && <div><Lb>Kết hợp thường gặp</Lb><div className="flex flex-wrap gap-1.5 mt-1">{q.col.map((c) => <span key={c} className="px-2 py-1 rounded-[4px] bg-white border border-[#D8CBAE] text-[16px]" style={ZH} lang="zh-CN">{c}</span>)}</div></div>}
      {q.note && <div className="rounded-[8px] bg-[#F3E3D2] border-l-4 border-[#9E2F22] px-3 py-2"><Lb>Phân biệt · lưu ý</Lb><p className="text-[15px] leading-relaxed mt-0.5" dangerouslySetInnerHTML={{ __html: q.note }} /></div>}
    </article>
  );
  if (q.kind === "gram") return (
    <article className={box} aria-label={`Ngữ pháp ${q.zh}`}>
      <div className="flex items-center gap-2 flex-wrap"><span className="text-[11px] font-extrabold tracking-wider px-2 py-0.5 rounded-[3px] bg-[#9E2F22] text-white">CHIÊU THỨC MỚI</span>{q.tag && <span className="text-xs font-bold text-[#6B6253]">{q.tag}</span>}</div>
      <div className="text-[34px] leading-tight" style={ZH} lang="zh-CN">{q.zh}</div>
      {q.py && <div className="text-[16px] text-[#4A4238] -mt-2">{q.py}</div>}
      <p className="text-[16px] leading-relaxed" dangerouslySetInnerHTML={{ __html: q.mean }} />
      {q.forms.length > 0 && <div><Lb>Cấu trúc</Lb><ul className="flex flex-col gap-1 mt-1">{q.forms.map((f) => <li key={f} className="px-3 py-1.5 rounded-[4px] bg-[#1C1A17] text-[#F3EEE2] text-[16px]" style={ZH}>{f}</li>)}</ul></div>}
      {q.ex.length > 0 && <div><Lb>Ví dụ</Lb><ul className="flex flex-col gap-2 mt-1">{q.ex.map(([z, v]) => <li key={z}><div className="flex items-start gap-2"><p className="flex-1 text-[17px] leading-relaxed" style={ZH} lang="zh-CN">{z}</p><button onClick={() => speakZh(z)} aria-label="Nghe câu" className="text-[#9E2F22] p-1"><svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z" /></svg></button></div><p className="text-sm text-[#4A4238]">{v}</p></li>)}</ul></div>}
      {q.tips.length > 0 && <div className="rounded-[8px] bg-[#F3E3D2] border-l-4 border-[#9E2F22] px-3 py-2"><Lb>Lưu ý</Lb><ul className="list-disc pl-5 text-[15px] leading-relaxed">{q.tips.map((t, i) => <li key={i} dangerouslySetInnerHTML={{ __html: t }} />)}</ul></div>}
    </article>
  );
  return (
    <article className={box} aria-label={`Phân biệt ${q.pair}`}>
      <span className="self-start text-[11px] font-extrabold tracking-wider px-2 py-0.5 rounded-[3px] bg-[#2F6E5A] text-white">PHÂN BIỆT</span>
      <div className="text-[30px] leading-tight" style={ZH} lang="zh-CN">{q.pair}</div>
      {q.same.length > 0 && <div><Lb>Giống nhau</Lb><p className="text-[15px] leading-relaxed" dangerouslySetInnerHTML={{ __html: q.same[0] }} />{q.same[1] && <p className="text-[16px] mt-1" style={ZH} dangerouslySetInnerHTML={{ __html: q.same[1] }} />}</div>}
      {q.diff.length > 0 && (
        <div><Lb>Khác nhau</Lb>
          <div className="overflow-x-auto mt-1"><table className="w-full text-[14px] border-collapse">
            <thead><tr>{q.cols.slice(0, 2).map((c) => <th key={c} scope="col" className="text-left px-2 py-1.5 bg-[#1C1A17] text-[#F3EEE2] text-[17px] font-normal" style={ZH}>{c}</th>)}</tr></thead>
            <tbody>{q.diff.map((r, i) => <tr key={i} className="align-top border-b border-[#E4DAC4]"><td className="px-2 py-2"><div dangerouslySetInnerHTML={{ __html: r[0] }} />{r[1] && <div className="mt-1 text-[15px]" style={ZH} dangerouslySetInnerHTML={{ __html: r[1] }} />}</td><td className="px-2 py-2" dangerouslySetInnerHTML={{ __html: r.slice(2).join("<br>") }} /></tr>)}</tbody>
          </table></div>
        </div>
      )}
    </article>
  );
}

function SayBtn({ text, big }) {
  return (
    <button onClick={() => speakZh(text)} aria-label="Nghe lại" className={`${big ? "w-20 h-20" : "w-11 h-11"} rounded-full bg-[#9E2F22] text-white grid place-items-center shrink-0 shadow-[0_4px_0_#6A1D14] active:translate-y-0.5`}>
      <svg viewBox="0 0 24 24" className={big ? "w-9 h-9" : "w-5 h-5"} fill="currentColor" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z" /></svg>
    </button>
  );
}

function Choice({ q, picked, setPicked, checked }) {
  const [showText, setShowText] = useState(false);
  const [fold, setFold] = useState(!!q.fold);
  return (
    <>
      {q.big && (
        <div className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col items-center gap-1">
          <div className="flex items-center gap-3"><span className="text-[46px] leading-none" style={ZH} lang="zh-CN">{q.big}</span><SayBtn text={q.big} /></div>
          {q.py && <div className="text-[17px] text-[#4A4238]">{q.py}{q.hv && <span className="text-[#8C7F68]"> · {q.hv}</span>}</div>}
        </div>
      )}
      {q.say && !q.big && (
        <div className="flex items-center gap-4">
          <SayBtn text={q.say} big />
          {q.hideText && !q.passage && (showText ? <p className="text-[17px] leading-relaxed" style={ZH} lang="zh-CN">{q.say}</p> : <button onClick={() => setShowText(true)} className="text-sm font-semibold text-[#7A2218] underline underline-offset-2">Không nghe được? Hiện chữ</button>)}
        </div>
      )}
      {q.passage && (
        <div className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-4">
          {fold ? <button onClick={() => setFold(false)} className="text-sm font-bold text-[#7A2218] underline underline-offset-2">Hiện bài đọc ({q.passage.length} chữ)</button>
            : <p className="text-[18px] leading-[1.9] whitespace-pre-line" style={ZH} lang="zh-CN">{q.passage}</p>}
        </div>
      )}
      {q.sent && <div className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] px-4 py-4 text-[22px] leading-relaxed" style={ZH} lang="zh-CN">{q.sent}</div>}
      <div role="radiogroup" aria-label="Các đáp án" className={`grid gap-2.5 ${q.zhOpts && !q.long && q.opts.every((o) => o.length <= 6) ? "grid-cols-2" : "grid-cols-1"}`}>
        {q.opts.map((o, i) => {
          const on = picked === i; const right = checked && i === q.a; const wrong = checked && on && i !== q.a;
          return (
            <button key={i} role="radio" aria-checked={on} disabled={!!checked} onClick={() => { setPicked(i); if (q.zhOpts && o.length <= 4) speakZh(o); }}
              className={`min-h-[56px] flex items-center gap-3 px-3 py-2.5 rounded-[8px] text-left border-2 transition-colors shadow-[0_3px_0_rgba(0,0,0,.08)] ${right ? "border-[#2F6E5A] bg-[#DCE9DF]" : wrong ? "border-[#9E2F22] bg-[#F3DDD6]" : on ? "border-[#1C1A17] bg-[#F3E3D2]" : "border-[#D8CBAE] bg-white hover:border-[#8C7F68]"}`}>
              <span className={`w-7 h-7 rounded-[4px] grid place-items-center text-[13px] font-extrabold shrink-0 border ${on ? "bg-[#1C1A17] text-white border-[#1C1A17]" : "border-[#CDBF9F] text-[#6B6253]"}`} aria-hidden="true">{i + 1}</span>
              <span className={q.zhOpts ? "text-[19px] leading-snug" : "text-[16px] leading-snug"} style={q.zhOpts ? ZH : undefined} lang={q.zhOpts ? "zh-CN" : undefined}>{o}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Tiles({ q, picked, setPicked, checked }) {
  const put = (i) => { if (checked) return; setPicked(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]); };
  return (
    <>
      {(q.vn || q.src) && (
        <div className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] px-4 py-3 flex flex-col gap-1">
          {q.src && <p className="text-[19px] leading-relaxed" style={ZH} lang="zh-CN">{q.src}</p>}
          {q.vn && <p className="text-[16px] leading-relaxed text-[#3A352C]">{q.vn}</p>}
          {q.hint && <p className="text-xs text-[#6B6253]">Cấu trúc: <span style={ZH}>{q.hint}</span></p>}
        </div>
      )}
      <div className={`min-h-[120px] rounded-[10px] border-2 border-dashed p-3 flex flex-wrap content-start gap-2 ${checked ? (checked.ok ? "border-[#2F6E5A]" : "border-[#9E2F22]") : "border-[#CDBF9F]"}`} aria-label="Câu đang xếp">
        {picked.length === 0 && <span className="text-sm text-[#8C7F68] self-center">Chạm các mảnh bên dưới theo thứ tự…</span>}
        {picked.map((i) => <button key={i} onClick={() => put(i)} className={`px-3 py-2 rounded-[6px] bg-white border-2 border-[#1C1A17] shadow-[0_3px_0_#1C1A17] ${q.big ? "text-[16px]" : "text-[20px]"}`} style={ZH} lang="zh-CN">{q.tiles[i]}</button>)}
      </div>
      <div className="flex flex-wrap gap-2 justify-center" aria-label="Các mảnh chữ">
        {q.tiles.map((t, i) => {
          const used = picked.includes(i);
          return <button key={i} onClick={() => put(i)} disabled={used || !!checked} aria-hidden={used}
            className={`px-3 py-2 rounded-[6px] border-2 ${q.big ? "text-[16px]" : "text-[20px]"} ${used ? "bg-[#D8CBAE] border-[#D8CBAE] text-transparent" : "bg-white border-[#CDBF9F] shadow-[0_3px_0_#CDBF9F] hover:border-[#8C7F68]"}`} style={ZH} lang="zh-CN">{t}</button>;
        })}
      </div>
    </>
  );
}

function Match({ q, onDone }) {
  const left = useMemo(() => [...q.pairs].sort(() => Math.random() - 0.5).map((p) => p[0]), [q]);
  const right = useMemo(() => [...q.pairs].sort(() => Math.random() - 0.5).map((p) => p[1]), [q]);
  const ans = useMemo(() => Object.fromEntries(q.pairs), [q]);
  const [sel, setSel] = useState(null); // {side, v}
  const [ok, setOk] = useState([]);
  const [bad, setBad] = useState(null);
  const [mist, setMist] = useState(0);
  const tap = (side, v) => {
    if (side === "l") speakZh(v);
    if (!sel || sel.side === side) { setSel({ side, v }); return; }
    const z = side === "l" ? v : sel.v; const m = side === "r" ? v : sel.v;
    if (ans[z] === m) { const n = [...ok, z]; setOk(n); setSel(null); if (n.length === q.pairs.length) setTimeout(() => onDone(mist > 0), 250); }
    else { setBad([z, m]); setMist((x) => x + 1); setSel(null); setTimeout(() => setBad(null), 500); }
  };
  const cls = (on, done, wrong) => `min-h-[56px] w-full px-3 py-2 rounded-[8px] border-2 text-left transition-colors ${done ? "border-[#D8CBAE] bg-[#E4DAC4] text-[#8C7F68]" : wrong ? "border-[#9E2F22] bg-[#F3DDD6]" : on ? "border-[#1C1A17] bg-[#F3E3D2]" : "border-[#D8CBAE] bg-white shadow-[0_3px_0_rgba(0,0,0,.08)]"}`;
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2.5">{left.map((z) => { const done = ok.includes(z); return <button key={z} disabled={done} onClick={() => tap("l", z)} className={cls(sel?.side === "l" && sel.v === z, done, bad?.[0] === z) + " text-[20px] text-center"} style={ZH} lang="zh-CN">{z}</button>; })}</div>
      <div className="flex flex-col gap-2.5">{right.map((m) => { const done = ok.some((z) => ans[z] === m); return <button key={m} disabled={done} onClick={() => tap("r", m)} className={cls(sel?.side === "r" && sel.v === m, done, bad?.[1] === m) + " text-[15px]"}>{m}</button>; })}</div>
    </div>
  );
}

function EndScreen({ end, sess, total, signedIn, onBack, onRetry }) {
  if (end.failed) return (
    <div className="fixed inset-0 z-[60] bg-[#1C1A17] text-[#F3EEE2] grid place-items-center p-6">
      <div className="max-w-[420px] text-center flex flex-col gap-4 items-center">
        <span className="font-brush text-[72px] leading-none text-[#9E2F22]">竭</span>
        <h2 className="font-serif-vn text-[26px] font-extrabold">Linh lực cạn kiệt</h2>
        <p className="text-[#CFC3A8]">Sai quá nhiều câu rồi. Điều tức một chút, mở bài giảng xem lại rồi vào ải lần nữa — đề sẽ được rút lại.</p>
        <button onClick={onRetry} className="h-14 w-full rounded-md bg-[#E6B656] text-[#1C1A17] font-serif-vn text-[17px] font-extrabold">Vào ải lại</button>
        <button onClick={onBack} className="text-sm font-semibold underline underline-offset-2">Về con đường</button>
      </div>
    </div>
  );
  const acc = Math.round((end.firstTry / Math.max(1, end.graded ?? total)) * 100);
  return (
    <div className="fixed inset-0 z-[60] bg-[#EFE7D6] text-[#1C1A17] grid place-items-center p-6">
      <div className="max-w-[440px] w-full text-center flex flex-col gap-5 items-center">
        <span className="font-brush text-[80px] leading-none text-[#9E2F22]">{acc === 100 ? "圆满" : "过关"}</span>
        <h2 className="font-serif-vn text-[26px] font-extrabold">{acc === 100 ? "Viên mãn — không sai câu nào!" : `Qua ải ${sess.node.vn}`}</h2>
        <div className="grid grid-cols-3 gap-2 w-full">
          {[["Tu vi", `+${end.tv}`, "#5C3D00"], ["Đúng ngay", `${acc}%`, "#2F6E5A"], ["Chuỗi dài nhất", sess.best, "#9E2F22"]].map(([k, v, c]) => (
            <div key={k} className="rounded-[10px] border-2 p-3 bg-[#FBF8F1]" style={{ borderColor: c }}><div className="text-[11px] font-extrabold tracking-wider uppercase" style={{ color: c }}>{k}</div><div className="text-[24px] font-extrabold">{v}</div></div>
          ))}
        </div>
        <p className="text-sm text-[#6B6253]">{Math.floor(end.secs / 60)} phút {end.secs % 60} giây · {end.graded ?? total} câu{signedIn ? "" : " · đăng nhập để giữ tu vi"}</p>
        <button onClick={onBack} className="h-14 w-full rounded-md bg-[#1C1A17] text-[#F3EEE2] font-serif-vn text-[17px] font-extrabold shadow-[0_4px_0_#9E2F22]">Tiếp tục con đường</button>
      </div>
    </div>
  );
}

// ---------------- ải Ngộ đạo: viết tóm tắt ----------------
function WriteNode({ L, node, done, onClose, onDone, signedIn }) {
  const W = L.W || {};
  const key = `cd_w_${L.id}`;
  const [text, setText] = useState("");
  const [ticks, setTicks] = useState([]);
  const [model, setModel] = useState(false);
  const [ai, setAi] = useState({ s: "idle", msg: "" });
  const [fin, setFin] = useState(null);
  useEffect(() => { try { setText(localStorage.getItem(key) || ""); } catch (_) {} }, [key]);
  useEffect(() => { try { localStorage.setItem(key, text); } catch (_) {} }, [key, text]);
  const n = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const target = W.target || 300; const enough = n >= Math.round(target * 0.6);
  const ask = async () => {
    setAi({ s: "busy", msg: "" });
    const prompt = `Chấm bài 缩写 HSK6 của học viên (đề: ${strip(W.task)}; yêu cầu khoảng ${target} chữ). Bài viết của học viên:\n${text}\n\nHãy nhận xét bằng tiếng Việt, ngắn gọn: 1) đủ ý chính chưa (so với bài mẫu bên dưới), 2) liệt kê tối đa 5 lỗi ngữ pháp/dùng từ kèm câu sửa, 3) chấm điểm /100 theo thang HSK6 phần viết. Bài mẫu: ${strip(W.model)}`;
    try { const r = await fetch("/api/ask-ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) }); const j = await r.json(); setAi({ s: "done", msg: j.answer || "" }); }
    catch (_) { setAi({ s: "done", msg: "Sư phụ đang bận, thử lại sau nhé." }); }
  };
  const submit = async () => { const tv = done ? 5 : 40; await onDone(node, tv); setFin(tv); };
  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Ngộ đạo" />
      <main className="max-w-[720px] mx-auto px-4 pt-5 pb-28 md:pb-16 flex flex-col gap-4">
        <button onClick={onClose} className="self-start text-sm font-bold text-[#7A2218] underline underline-offset-2">‹ Về con đường</button>
        <div className="flex items-baseline gap-3"><span className="font-brush text-[46px] leading-none text-[#9E2F22]">悟道</span><h1 className="font-serif-vn text-[24px] font-extrabold">Ngộ đạo · viết tóm tắt</h1></div>
        <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-4 flex flex-col gap-3">
          <p className="text-[17px] leading-relaxed" style={ZH} lang="zh-CN">{strip(W.task)}</p>
          <ol className="grid gap-1.5 text-sm">{(W.steps || []).map((s, i) => <li key={i}><b>{i + 1}. {strip(s[0])}</b> — <span dangerouslySetInnerHTML={{ __html: s[1] }} /></li>)}</ol>
        </section>
        <label className="flex flex-col gap-1.5">
          <span className="flex justify-between text-sm font-bold"><span>Bài của bạn</span><span className={enough ? "text-[#2F6E5A]" : "text-[#6B6253]"}>{n}/{target} chữ</span></span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} lang="zh-CN" placeholder="在这里写你的缩写……"
            className="rounded-[10px] border-2 border-[#CDBF9F] focus:border-[#1C1A17] outline-none bg-white p-3 text-[18px] leading-[1.8]" style={ZH} />
        </label>
        {(W.check || []).length > 0 && (
          <fieldset className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-4 flex flex-col gap-2">
            <legend className="font-serif-vn font-bold px-1">Tự soát trước khi nộp</legend>
            {W.check.map((c, i) => <label key={i} className="flex items-start gap-2 text-[15px]"><input type="checkbox" className="mt-1 w-4 h-4 accent-[#2F6E5A]" checked={ticks.includes(i)} onChange={() => setTicks(ticks.includes(i) ? ticks.filter((x) => x !== i) : [...ticks, i])} />{strip(c)}</label>)}
          </fieldset>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={ask} disabled={n < 30 || ai.s === "busy"} className="h-12 px-5 rounded-md border-2 border-[#1C1A17] font-bold disabled:opacity-50">{ai.s === "busy" ? "Sư phụ đang đọc…" : "Nhờ sư phụ nhận xét"}</button>
          <button onClick={() => setModel(!model)} className="h-12 px-5 rounded-md border-2 border-[#CDBF9F] font-bold">{model ? "Ẩn bài mẫu" : "Xem bài mẫu"}</button>
          <button onClick={submit} disabled={!enough || fin != null} className="h-12 px-5 rounded-md bg-[#1C1A17] text-[#F3EEE2] font-extrabold shadow-[0_4px_0_#9E2F22] disabled:bg-[#B9AD97] disabled:shadow-none ml-auto">{fin != null ? `Đã nộp · +${fin} tu vi` : enough ? "Nộp bài · qua ải" : `Viết thêm ${Math.round(target * 0.6) - n} chữ để nộp`}</button>
        </div>
        {!signedIn && <p className="text-sm text-[#6B6253]">Đăng nhập để nhận tu vi khi qua ải.</p>}
        {ai.msg && <section className="rounded-[14px] bg-white border border-[#D8CBAE] p-4 text-[15px] leading-relaxed whitespace-pre-wrap" aria-live="polite"><b className="font-serif-vn block mb-1">Sư phụ nhận xét</b>{ai.msg}</section>}
        {model && <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-4 text-[17px] leading-[1.9] whitespace-pre-line" style={ZH} lang="zh-CN">{String(W.model || "").replace(/<[^>]+>/g, "")}</section>}
      </main>
    </div>
  );
}
