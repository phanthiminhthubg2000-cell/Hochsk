"use client";
// ============================================================
// AI NHANH NHẤT 抢答 — MÀN HÌNH GIÁO VIÊN
// Cả lớp cùng thấy một câu hỏi, ai cũng trả lời trên điện thoại.
// Đúng càng nhanh càng nhiều điểm (500–1000), có thưởng chuỗi đúng liên tiếp.
// Sau mỗi câu: hiện đáp án, số người chọn mỗi phương án và bảng xếp hạng.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { db } from "../../../firebase";
import { doc, updateDoc, onSnapshot, collection, deleteDoc, increment } from "firebase/firestore";
import { makeQuestion, publicQuestion } from "../../bom/game";
import { ROOMS, useDeck, useTone, useHostRoom, HostShell, SetupScreen, LobbyQR, QrModal, Label, Choice, Podium, EndButtons, BigQuestion, MissedWords, ResultSaver } from "../shared";

const NQ = [[10, "10 câu"], [15, "15 câu"], [20, "20 câu"], [30, "30 câu"]];
const SECS = [[10, "10 giây"], [15, "15 giây"], [20, "20 giây"], [30, "30 giây"]];

export default function QuizHost() {
  const deck = useDeck();
  const tone = useTone();
  const R = useHostRoom();
  const [nq, setNq] = useState(15);
  const [secs, setSecs] = useState(15);
  const [auto, setAuto] = useState(true);
  const [phase, setPhase] = useState("setup"); // setup | lobby | q | reveal | end
  const [err, setErr] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [left, setLeft] = useState(0);
  const [nAns, setNAns] = useState(0);
  const [reveal, setReveal] = useState(null);
  const [pq, setPq] = useState(null); // câu hỏi hiện tại — hiển thị ngay, không chờ Firestore
  const G = useRef({ pool: [], used: new Set(), q: null, idx: 0, t0: 0, ans: {}, done: new Set(), streak: {}, revealed: false, miss: {} });

  async function createRoom() {
    setErr("");
    if (deck.pool.length < 4) { setErr("Hãy chọn bài có ít nhất 4 từ."); return; }
    try {
      const c = await R.create({ game: "quiz", cfg: { ...deck.cfg(), nq, secs }, nq, idx: 0, q: null, reveal: null });
      G.current.pool = deck.pool; G.current.code = c;
      R.listen(onSnapshot(collection(db, ROOMS, c, "answers"), (snap) => {
        snap.docChanges().forEach((ch) => { if (ch.type === "added") onAnswer(c, ch.doc.id, ch.doc.data()); });
      }));
      setPhase("lobby");
    } catch (e) { setErr("Không tạo được phòng (" + (e.code || e.message) + ")."); }
  }

  function onAnswer(c, id, a) {
    const g = G.current;
    if (g.done.has(id)) return; g.done.add(id);
    deleteDoc(doc(db, ROOMS, c, "answers", id)).catch(() => {});
    if (!g.q || g.revealed || a.qid !== g.q.id || g.ans[a.pid]) return;
    // ưu tiên thời gian đo trên điện thoại; giới hạn trong [0, thời gian câu]
    const dur = secs * 1000, own = Date.now() - g.t0;
    const ms = typeof a.ms === "number" && isFinite(a.ms) ? Math.max(0, Math.min(dur, a.ms, own)) : Math.min(dur, own);
    g.ans[a.pid] = { choice: a.choice, ms };
    setNAns(Object.keys(g.ans).length);
    tone.tone(880, 0, 0.04, "triangle", 0.05);
    if (Object.keys(g.ans).length >= R.playersRef.current.length) setTimeout(doReveal, 400);
  }

  async function start() {
    if (!R.players.length) { setErr("Chưa có học sinh nào vào phòng."); return; }
    await R.resetPlayers({ score: 0, correct: 0, wrong: 0, streak: 0, last: null });
    const g = G.current; g.idx = 0; g.used = new Set(); g.streak = {}; g.miss = {};
    nextQ();
  }

  async function nextQ() {
    const g = G.current;
    if (g.idx >= nq) { setPhase("end"); tone.fanfare(); await updateDoc(doc(db, ROOMS, G.current.code), { status: "end", q: null }).catch(() => {}); return; }
    if (g.used.size > g.pool.length - 4) g.used = new Set();
    const q = makeQuestion(g.pool, deck.mode, g.used);
    g.used.add(q.word[0]); g.q = q; g.idx += 1; g.ans = {}; g.revealed = false; g.t0 = Date.now();
    const pub = publicQuestion(q);
    setPq(pub); setNAns(0); setReveal(null); setPhase("q");
    try {
      await updateDoc(doc(db, ROOMS, G.current.code), { status: "q", idx: g.idx, q: pub, dur: secs * 1000, reveal: null });
    } catch (e) { setErr("Không gửi được câu hỏi tới điện thoại học sinh (" + (e.code || e.message) + "). Bấm “Câu tiếp →” để thử lại."); }
    tone.tone(660, 0, 0.12, "triangle"); tone.tone(880, 0.1, 0.18, "triangle");
  }

  async function doReveal() {
    const g = G.current;
    if (!g.q || g.revealed) return; g.revealed = true;
    const q = g.q, dur = secs * 1000;
    const counts = [0, 0, 0, 0];
    const results = [];
    R.playersRef.current.forEach((p) => {
      const a = g.ans[p.id];
      if (a) counts[a.choice] = (counts[a.choice] || 0) + 1;
      const ok = !!a && a.choice === q.ans;
      const st = ok ? (g.streak[p.id] || 0) + 1 : 0;
      g.streak[p.id] = st;
      const pts = ok ? Math.round(1000 - 500 * Math.min(1, a.ms / dur)) + (st >= 3 ? 100 : 0) : 0;
      results.push({ p, ok, pts, a, st });
    });
    // thống kê từ hay sai (chỉ tính bạn đã trả lời)
    const nAnsd = results.filter((r) => r.a).length, nBad = results.filter((r) => r.a && !r.ok).length;
    if (nBad) g.miss[q.word[0]] = { w: [q.word[0], q.word[1], q.word[2] || ""], n: nBad, tot: nAnsd };
    const fastest = results.filter((r) => r.ok).sort((x, y) => x.a.ms - y.a.ms)[0];
    const rv = { ans: q.ans, counts, word: q.word, fastest: fastest ? { name: fastest.p.name, s: (fastest.a.ms / 1000).toFixed(1) } : null, nOk: results.filter((r) => r.ok).length };
    setReveal(rv); setPhase("reveal");
    if (rv.nOk) { tone.tone(784, 0, 0.12, "triangle"); tone.tone(1046, 0.1, 0.2, "triangle"); } else tone.tone(220, 0, 0.3, "sawtooth", 0.1);
    await Promise.all(results.map((r) => updateDoc(doc(db, ROOMS, G.current.code, "players", r.p.id), {
      score: increment(r.pts), correct: increment(r.ok ? 1 : 0), wrong: increment(r.ok || !r.a ? 0 : 1), streak: r.st,
      last: { qid: q.id, ok: r.ok, pts: r.pts, answered: !!r.a, choice: r.a ? r.a.choice : null },
    }).catch(() => {})));
    await updateDoc(doc(db, ROOMS, G.current.code), { status: "reveal", reveal: rv }).catch(() => {});
  }

  // đồng hồ mỗi câu
  useEffect(() => {
    if (phase !== "q") return;
    const iv = setInterval(() => {
      const l = Math.max(0, secs * 1000 - (Date.now() - G.current.t0));
      setLeft(l);
      if (l <= 3000 && l > 0 && Math.floor(l / 1000) !== Math.floor((l + 100) / 1000)) tone.tone(1200, 0, 0.05, "square", 0.05);
      // hết giờ: chờ thêm 1,2 giây cho câu trả lời đang trên đường truyền
      if (l <= 0) { clearInterval(iv); setTimeout(doReveal, 1200); }
    }, 100);
    return () => clearInterval(iv);
  }, [phase]); // eslint-disable-line

  // tự sang câu sau khi xem đáp án
  useEffect(() => {
    if (phase !== "reveal" || !auto) return;
    const t = setTimeout(nextQ, 7000);
    return () => clearTimeout(t);
  }, [phase, auto]); // eslint-disable-line

  const room = R.room;
  const ranked = R.players.slice().sort((a, b) => (b.score || 0) - (a.score || 0));
  const g = G.current;

  return (
    <HostShell icon="⚡" title="Ai nhanh nhất" zh="抢答" code={R.code} onQr={phase !== "setup" && phase !== "lobby" ? () => setShowQr(true) : null} tone={tone} err={err || deck.err}>
      {phase === "setup" && (
        <SetupScreen emoji="⚡" title="Ai nhanh nhất" zh="抢答比赛" deck={deck} onCreate={createRoom}
          rules={["📱 Học sinh quét QR, nhập tên, chơi trên điện thoại.",
            "📺 Cả lớp cùng thấy một câu hỏi trên màn hình lớn, ai cũng được trả lời.",
            "⚡ Đúng càng nhanh càng nhiều điểm (500–1000) · đúng 3 câu liên tiếp được thưởng +100.",
            "📊 Hết giờ: hiện đáp án, số bạn chọn mỗi phương án và bảng xếp hạng.",
            "🏆 Hết câu hỏi: công bố bảng vàng."]}>
          <div className="grid sm:grid-cols-2 gap-5">
            <div><Label>Số câu hỏi</Label><Choice items={NQ} value={nq} onChange={setNq} /></div>
            <div><Label>Thời gian mỗi câu</Label><Choice items={SECS} value={secs} onChange={setSecs} /></div>
          </div>
          <label className="flex items-center gap-2 font-bold text-sm">
            <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} className="w-5 h-5 accent-[#2E9D5B]" />
            Tự chuyển câu sau 7 giây xem đáp án
          </label>
        </SetupScreen>
      )}

      {phase === "lobby" && (
        <main className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 grid gap-8 lg:grid-cols-[auto_1fr] items-start">
          <LobbyQR qr={R.qr} code={R.code} joinUrl={R.joinUrl} />
          <section className="flex flex-col gap-5">
            <div className="rounded-[22px] bg-[#1E5C38] text-white p-6">
              <div className="text-sm font-bold opacity-80">{room?.cfg?.level} · {room?.cfg?.lessons} · {room?.cfg?.mode} · {nq} câu × {secs}s</div>
              <div className="text-3xl font-extrabold mt-1">Đã có {R.players.length} bạn vào phòng</div>
            </div>
            <div className="flex flex-wrap gap-2.5 min-h-[120px] content-start">
              {R.players.length === 0 && <div className="text-[#5B7262]">Đang chờ học sinh quét mã…</div>}
              {R.players.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2 pl-4 pr-2 py-2 rounded-full bg-white border border-[#C9D6BE] font-bold text-lg" style={{ animation: "pop .3s" }}>
                  {p.name}
                  <button onClick={() => R.kick(p.id)} aria-label={`Mời ${p.name} ra khỏi phòng`} className="w-7 h-7 rounded-full hover:bg-[#FDE8E8] text-[#9AAB9E] hover:text-[#C0392B]">×</button>
                </span>
              ))}
            </div>
            <button disabled={R.players.length < 1} onClick={start} className="h-16 rounded-2xl bg-[#E8590C] hover:bg-[#C94A08] disabled:opacity-40 text-white text-xl font-extrabold">⚡ Bắt đầu!</button>
          </section>
        </main>
      )}

      {(phase === "q" || phase === "reveal") && (
        <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="flex flex-col gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-extrabold bg-white border border-[#DDE6D3] rounded-full px-4 py-2">Câu {g.idx}/{nq}</span>
              <span className="text-sm font-bold text-[#5B7262]">Đã trả lời: <b className="text-[#13261C] tabular-nums">{nAns}/{R.players.length}</b></span>
              <span className="ml-auto" />
              {phase === "q" && <button onClick={doReveal} className="h-10 px-4 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">Hiện đáp án</button>}
              {phase === "reveal" && <button onClick={nextQ} className="h-10 px-5 rounded-xl bg-[#2E9D5B] text-white text-sm font-extrabold">{g.idx >= nq ? "Xem kết quả 🏆" : "Câu tiếp →"}</button>}
              <button onClick={async () => { setPhase("end"); await updateDoc(doc(db, ROOMS, G.current.code), { status: "end", q: null }).catch(() => {}); }} className="h-10 px-4 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">Kết thúc</button>
            </div>
            {phase === "q" && (
              <div className="h-3 rounded-full bg-[#E3EADB] overflow-hidden">
                <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${(left / (secs * 1000)) * 100}%`, background: left < 4000 ? "#D64545" : "#2E9D5B" }} />
              </div>
            )}
            <div className="rounded-[26px] bg-white border border-[#DDE6D3] p-6 relative">
              {phase === "q" && <div className="absolute top-5 right-6 text-5xl font-extrabold tabular-nums text-[#C0392B]">{Math.ceil(left / 1000)}</div>}
              <BigQuestion q={pq || room?.q}reveal={phase === "reveal" ? reveal : null} counts={phase === "reveal" ? reveal?.counts : null} />
              {phase === "reveal" && reveal && (
                <div className="mt-5 flex flex-wrap gap-3 items-center" style={{ animation: "pop .3s" }}>
                  <span className="px-4 py-2 rounded-xl bg-[#E7F5EC] text-[#1E5C38] font-extrabold">✅ {reveal.nOk}/{R.players.length} bạn đúng</span>
                  {reveal.fastest && <span className="px-4 py-2 rounded-xl bg-[#FFF4DE] text-[#8A5A00] font-extrabold">⚡ Nhanh nhất: {reveal.fastest.name} ({reveal.fastest.s}s)</span>}
                  <span className="px-4 py-2 rounded-xl bg-[#F6F9F2] font-bold"><span className="zh text-xl">{reveal.word[0]}</span> · {reveal.word[1]}{reveal.word[2] ? ` · ${reveal.word[2]}` : ""}</span>
                </div>
              )}
            </div>
          </section>
          <aside className="rounded-[22px] bg-white border border-[#DDE6D3] p-4 self-start">
            <div className="font-extrabold text-lg mb-3">Bảng xếp hạng</div>
            <ol className="flex flex-col gap-1.5 max-h-[72vh] overflow-auto">
              {ranked.map((p, i) => (
                <li key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl transition ${phase === "q" && g.ans[p.id] ? "bg-[#E7F5EC]" : "bg-[#F6F9F2]"}`}>
                  <span className="w-6 text-center font-extrabold text-[#5B7262]">{i + 1}</span>
                  <span className="flex-1 font-bold truncate">{p.name}{(p.streak || 0) >= 3 ? " 🔥" : ""}</span>
                  {phase === "reveal" && p.last?.qid === g.q?.id && <span className={`text-sm font-extrabold ${p.last.ok ? "text-[#1E7A45]" : "text-[#C0392B]"}`}>{p.last.ok ? `+${p.last.pts}` : p.last.answered ? "✗" : "–"}</span>}
                  {phase === "q" && g.ans[p.id] && <span className="text-sm">✔</span>}
                  <span className="font-extrabold tabular-nums w-14 text-right">{p.score || 0}</span>
                </li>
              ))}
            </ol>
          </aside>
        </main>
      )}

      {phase === "end" && (
        <main className="max-w-[900px] mx-auto px-4 md:px-8 py-10 text-center">
          <div className="text-7xl">🏆</div>
          <h1 className="text-4xl font-extrabold mt-2">Bảng vàng</h1>
          <Podium list={ranked} valueOf={(p) => p.score || 0} />
          <ol className="mt-8 text-left flex flex-col gap-1.5 rounded-[22px] bg-white border border-[#DDE6D3] p-4">
            {ranked.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#F6F9F2]">
                <span className="w-6 text-center font-extrabold text-[#5B7262]">{i + 1}</span>
                <span className="flex-1 font-bold truncate">{p.name}</span>
                <span className="text-sm text-[#5B7262]">✅ {p.correct || 0}</span>
                <span className="font-extrabold tabular-nums w-16 text-right">{p.score || 0}</span>
              </li>
            ))}
          </ol>
          <MissedWords missed={Object.values(g.miss).sort((a, b) => b.n / b.tot - a.n / a.tot)} />
          <ResultSaver game="quiz" cfg={room?.cfg} players={R.players} metric={(p) => p.score || 0} missed={Object.values(g.miss)} />
          <EndButtons />
        </main>
      )}

      {showQr && <QrModal qr={R.qr} code={R.code} onClose={() => setShowQr(false)} />}
    </HostShell>
  );
}
