"use client";
// ============================================================
// BOM NỔ CHẬM 传炸弹 — MÀN HÌNH GIÁO VIÊN (phát trực tiếp)
// Giáo viên chọn đề → tạo phòng + mã QR → học sinh vào bằng điện thoại.
// Máy giáo viên là "trọng tài": ra câu hỏi, chấm đáp án, chuyền bom, đếm ngược ngòi nổ.
// Cả lớp cùng thấy câu hỏi: người cầm bom trả lời để chuyền bom (+10),
// các bạn khác trả lời cùng để ghi điểm phụ (+5). Bom nổ: −15 (không xuống dưới 0).
// ============================================================
import { useEffect, useRef, useState } from "react";
import { db } from "../../../firebase";
import { doc, updateDoc, onSnapshot, collection, deleteDoc, increment } from "firebase/firestore";
import { makeQuestion, publicQuestion, pickOne } from "../game";
import QBig from "../QBig";
import { ROOMS, OPT_COLORS, useDeck, useTone, useHostRoom, HostShell, SetupScreen, LobbyQR, QrModal, Label, Choice, Podium, EndButtons, ResultSaver } from "../../choi/shared";

const FUSES = [["short", "Ngắn", "20–35 giây"], ["mid", "Vừa", "30–50 giây"], ["long", "Dài", "45–75 giây"]];
const FUSE_RANGE = { short: [20, 35], mid: [30, 50], long: [45, 75] };
const ROUNDS = [[3, "3 ván"], [5, "5 ván"], [8, "8 ván"]];
const PASS = [["random", "🎲 Ngẫu nhiên", "không ai đoán được"], ["order", "🔢 Lần lượt", "theo thứ tự vào phòng"]];
const BOOM = 15, OK_PTS = 10, SIDE_PTS = 5;

export default function BombHost() {
  const deck = useDeck();
  const tone = useTone();
  const R = useHostRoom();
  const [fuse, setFuse] = useState("mid");
  const [rounds, setRounds] = useState(5);
  const [pass, setPass] = useState("random");
  const [phase, setPhase] = useState("setup"); // setup | lobby | play | boom | end
  const [err, setErr] = useState("");
  const [fuseP, setFuseP] = useState(0);
  const [showQr, setShowQr] = useState(false);
  const G = useRef({ pool: [], q: null, holder: null, prev: null, fuseEnd: 0, fuseTotal: 1, round: 0, used: new Set(), done: new Set(), side: new Set(), paused: false, pauseLeft: 0, lastTick: 0, pos: -1, ended: false, miss: {}, saved: false, code: "" });

  // ---------- tạo phòng ----------
  async function createRoom() {
    setErr("");
    if (deck.pool.length < 4) { setErr("Hãy chọn bài có ít nhất 4 từ."); return; }
    try {
      const c = await R.create({ game: "bomb", cfg: { ...deck.cfg(), pass, rounds }, round: 0, rounds, holder: null, holderName: "", q: null, last: null, random: pass === "random" });
      Object.assign(G.current, { pool: deck.pool, used: new Set(), done: new Set(), round: 0, code: c, miss: {}, saved: false, ended: false });
      R.listen(onSnapshot(collection(db, ROOMS, c, "answers"), (snap) => {
        snap.docChanges().forEach((ch) => { if (ch.type === "added") handleAnswer(c, ch.doc.id, ch.doc.data()); });
      }));
      setPhase("lobby");
    } catch (e) {
      setErr("Không tạo được phòng — Firestore từ chối quyền ghi (" + (e.code || e.message) + ").");
    }
  }

  // ---------- luật chơi ----------
  function nextQuestion() {
    const g = G.current;
    if (g.used.size > g.pool.length - 4) g.used = new Set();
    const q = makeQuestion(g.pool, deck.mode, g.used);
    g.used.add(q.word[0]); g.q = q; g.side = new Set();
    return q;
  }
  const order = () => R.playersRef.current; // thứ tự vào phòng
  const nameOf = (pid) => order().find((p) => p.id === pid)?.name || "?";
  const posOf = (pid) => order().findIndex((p) => p.id === pid);
  // người nhận bom tiếp theo
  function nextOf(pid) {
    const ord = order(), g = G.current;
    if (!ord.length) return null;
    if (ord.length === 1) return ord[0].id;
    if (pass === "random") {
      // ngẫu nhiên, tránh trả lại ngay cho người vừa chuyền (nếu có từ 3 bạn)
      let cand = ord.filter((p) => p.id !== pid && (ord.length < 3 || p.id !== g.prev));
      if (!cand.length) cand = ord.filter((p) => p.id !== pid);
      return pickOne(cand).id;
    }
    let i = ord.findIndex((p) => p.id === pid);
    if (i < 0) i = g.pos ?? -1; else g.pos = i;
    return ord[(i + 1) % ord.length].id;
  }
  const nextInfo = (to) => {
    if (pass === "random") return { next: null, nextName: "" };
    const nx = nextOf(to); return { next: nx, nextName: nameOf(nx) };
  };

  async function startRound() {
    const g = G.current, c = g.code;
    if (!order().length) { setErr("Chưa có học sinh nào vào phòng."); return; }
    if (g.round === 0) await R.resetPlayers({ score: 0, booms: 0, correct: 0, wrong: 0, side: null });
    g.round += 1;
    // ván đầu: ngẫu nhiên / bạn số 1 · ván sau: chuyền tiếp từ người vừa bị nổ
    g.holder = g.holder ? nextOf(g.holder) : pass === "random" ? pickOne(order()).id : order()[0].id;
    g.pos = posOf(g.holder); g.prev = null;
    const [mn, mx] = FUSE_RANGE[fuse];
    g.fuseTotal = (mn + Math.random() * (mx - mn)) * 1000;
    g.fuseEnd = Date.now() + g.fuseTotal; g.paused = false;
    const q = nextQuestion();
    setPhase("play");
    await updateDoc(doc(db, ROOMS, c), { status: "play", round: g.round, holder: g.holder, holderName: nameOf(g.holder), ...nextInfo(g.holder), q: publicQuestion(q), last: null, passes: 0, sideOk: 0, paused: false });
    tone.tone(523, 0, 0.15, "triangle"); tone.tone(784, 0.12, 0.2, "triangle");
  }

  const noteMiss = (w) => { const m = G.current.miss; m[w[0]] = { w: [w[0], w[1], w[2] || ""], n: ((m[w[0]] && m[w[0]].n) || 0) + 1 }; };

  async function handleAnswer(c, id, a) {
    const g = G.current;
    if (g.done.has(id)) return; g.done.add(id);
    deleteDoc(doc(db, ROOMS, c, "answers", id)).catch(() => {});
    if (!g.q || a.qid !== g.q.id || g.paused || Date.now() > g.fuseEnd) return;
    const ok = a.choice === g.q.ans;
    const w = g.q.word;
    const pRef = doc(db, ROOMS, c, "players", a.pid);

    // --- bạn KHÔNG cầm bom: trả lời phụ, mỗi câu một lần ---
    if (a.pid !== g.holder) {
      if (g.side.has(a.pid)) return; g.side.add(a.pid);
      if (!ok) noteMiss(w);
      updateDoc(pRef, { ...(ok ? { score: increment(SIDE_PTS), correct: increment(1) } : { wrong: increment(1) }), side: { qid: a.qid, ok } }).catch(() => {});
      if (ok) updateDoc(doc(db, ROOMS, c), { sideOk: increment(1) }).catch(() => {});
      return;
    }

    // --- người cầm bom ---
    if (ok) {
      updateDoc(pRef, { score: increment(OK_PTS), correct: increment(1), side: null }).catch(() => {});
      const to = nextOf(a.pid) || a.pid;
      g.prev = a.pid; g.holder = to; g.pos = posOf(to);
      const q = nextQuestion();
      tone.tone(660, 0, 0.1, "triangle"); tone.tone(990, 0.08, 0.15, "triangle");
      await updateDoc(doc(db, ROOMS, c), { holder: to, holderName: nameOf(to), ...nextInfo(to), q: publicQuestion(q), sideOk: 0, last: { type: "ok", pid: a.pid, name: nameOf(a.pid), word: w, at: Date.now() }, passes: increment(1) });
    } else {
      noteMiss(w);
      updateDoc(pRef, { wrong: increment(1) }).catch(() => {});
      const q = nextQuestion();
      tone.tone(200, 0, 0.25, "sawtooth", 0.12);
      await updateDoc(doc(db, ROOMS, c), { q: publicQuestion(q), sideOk: 0, last: { type: "bad", pid: a.pid, name: nameOf(a.pid), word: w, at: Date.now() } });
    }
  }

  async function finishGame() {
    const g = G.current;
    g.ended = true; g.q = null; setPhase("end"); tone.fanfare();
    await updateDoc(doc(db, ROOMS, g.code), { status: "end", q: null }).catch(() => {});
  }

  async function explode() {
    const g = G.current, c = g.code;
    if (phase !== "play") return;
    setPhase("boom");
    tone.boom();
    const pid = g.holder;
    const p = order().find((x) => x.id === pid);
    const lost = Math.min(BOOM, (p && p.score) || 0); // không để điểm âm
    updateDoc(doc(db, ROOMS, c, "players", pid), { booms: increment(1), score: increment(-lost) }).catch(() => {});
    if (g.q) noteMiss(g.q.word);
    await updateDoc(doc(db, ROOMS, c), { status: "boom", last: { type: "boom", pid, name: nameOf(pid), word: g.q?.word || null, lost, at: Date.now() } });
    g.q = null;
    setTimeout(() => {
      if (g.ended) return;
      if (g.round >= rounds) finishGame();
      else startRound();
    }, 5000);
  }

  // ---------- ngòi nổ ----------
  useEffect(() => {
    if (phase !== "play") return;
    const iv = setInterval(() => {
      const g = G.current;
      if (g.paused) return;
      const left = g.fuseEnd - Date.now();
      const p = Math.min(1, 1 - left / g.fuseTotal);
      setFuseP(p);
      const gap = 900 - 700 * p; // tích tắc nhanh dần
      if (Date.now() - g.lastTick > gap) { g.lastTick = Date.now(); tone.tone(p > 0.75 ? 1400 : 1000, 0, 0.04, "square", 0.05); }
      if (left <= 0) { clearInterval(iv); explode(); }
    }, 100);
    return () => clearInterval(iv);
  }, [phase]); // eslint-disable-line

  function togglePause() {
    const g = G.current;
    if (phase !== "play") return;
    if (!g.paused) { g.paused = true; g.pauseLeft = g.fuseEnd - Date.now(); }
    else { g.paused = false; g.fuseEnd = Date.now() + g.pauseLeft; }
    updateDoc(doc(db, ROOMS, g.code), { paused: g.paused }).catch(() => {});
  }

  // ============================================================
  // GIAO DIỆN
  // ============================================================
  const room = R.room;
  const q = room?.q;
  const last = room?.last;
  const ranked = R.players.slice().sort((a, b) => (b.score || 0) - (a.score || 0) || (a.booms || 0) - (b.booms || 0));
  const missed = Object.values(G.current.miss).sort((a, b) => b.n - a.n);

  return (
    <HostShell icon="💣" title="Bom nổ chậm" zh="传炸弹" code={R.code} onQr={phase !== "setup" && phase !== "lobby" ? () => setShowQr(true) : null} tone={tone} err={err || deck.err}>
      {phase === "setup" && (
        <SetupScreen emoji="💣" title="Bom nổ chậm" zh="传炸弹" deck={deck} onCreate={createRoom}
          rules={["📱 Học sinh quét mã QR, nhập tên, chơi trên điện thoại.",
            "💣 Bom rơi vào tay ai, người đó phải trả lời đúng để chuyền bom đi (+10).",
            "👥 Cả lớp cùng thấy câu hỏi — các bạn khác trả lời cùng để ghi điểm phụ (+5).",
            "🎲 Bom chuyền ngẫu nhiên, không ai biết mình là người tiếp theo.",
            "💥 Ngòi nổ ngẫu nhiên — bom nổ ở tay ai, người đó bị trừ 15 điểm (không xuống dưới 0)."]}>
          <div className="grid sm:grid-cols-2 gap-5">
            <div><Label>Ngòi nổ mỗi ván</Label><Choice items={FUSES} value={fuse} onChange={setFuse} /></div>
            <div><Label>Số ván (số lần bom nổ)</Label><Choice items={ROUNDS} value={rounds} onChange={setRounds} /></div>
          </div>
          <div><Label>Cách chuyền bom</Label><Choice items={PASS} value={pass} onChange={setPass} /></div>
        </SetupScreen>
      )}

      {phase === "lobby" && (
        <main className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 grid gap-8 lg:grid-cols-[auto_1fr] items-start">
          <LobbyQR qr={R.qr} code={R.code} joinUrl={R.joinUrl} />
          <section className="flex flex-col gap-5">
            <div className="rounded-[22px] bg-[#1E5C38] text-white p-6">
              <div className="text-sm font-bold opacity-80">{room?.cfg?.level} · {room?.cfg?.lessons} · {room?.cfg?.mode} · {rounds} ván · {pass === "random" ? "chuyền ngẫu nhiên" : "chuyền lần lượt"}</div>
              <div className="text-3xl font-extrabold mt-1">Đã có {R.players.length} bạn vào phòng</div>
            </div>
            <div className="flex flex-wrap gap-2.5 min-h-[120px] content-start">
              {R.players.length === 0 && <div className="text-[#5B7262]">Đang chờ học sinh quét mã…</div>}
              {R.players.map((p, i) => (
                <span key={p.id} className="inline-flex items-center gap-2 pl-2 pr-2 py-2 rounded-full bg-white border border-[#C9D6BE] font-bold text-lg" style={{ animation: "pop .3s" }}>
                  {pass === "order" && <b className="w-7 h-7 rounded-full bg-[#E8590C] text-white text-sm grid place-items-center">{i + 1}</b>}
                  {p.name}
                  <button onClick={() => R.kick(p.id)} aria-label={`Mời ${p.name} ra khỏi phòng`} className="w-7 h-7 rounded-full hover:bg-[#FDE8E8] text-[#9AAB9E] hover:text-[#C0392B]">×</button>
                </span>
              ))}
            </div>
            <button disabled={R.players.length < 1} onClick={startRound} className="h-16 rounded-2xl bg-[#E8590C] hover:bg-[#C94A08] disabled:opacity-40 text-white text-xl font-extrabold">💣 Châm ngòi — bắt đầu!</button>
            <p className="text-sm text-[#5B7262]">Nên có từ 3 bạn trở lên. Bạn vào muộn vẫn được nhận bom.</p>
          </section>
        </main>
      )}

      {(phase === "play" || phase === "boom") && (
        <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="flex flex-col gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-extrabold bg-white border border-[#DDE6D3] rounded-full px-4 py-2">Ván {room?.round || 0}/{rounds}</span>
              <span className="text-sm font-bold text-[#5B7262]">Đã chuyền {room?.passes || 0} lần</span>
              <span className="ml-auto" />
              <button onClick={togglePause} className="h-10 px-4 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">{room?.paused ? "▶ Tiếp tục" : "⏸ Tạm dừng"}</button>
              <button onClick={finishGame} className="h-10 px-4 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">Kết thúc</button>
            </div>

            <div className="rounded-[26px] bg-white border border-[#DDE6D3] p-6 grid md:grid-cols-[220px_1fr] gap-6 items-center">
              <div className="flex flex-col items-center">
                <Bomb p={fuseP} danger={fuseP > 0.7} />
                <div className="text-sm font-bold text-[#5B7262] mt-2">Bom đang ở tay</div>
                <div className="text-3xl md:text-4xl font-extrabold text-[#C0392B] text-center break-words">{room?.holderName || ""}</div>
                {room?.nextName ? <div className="mt-2 text-sm font-bold text-[#5B7262] text-center">Tiếp theo ➜ <span className="text-[#13261C]">{room.nextName}</span></div>
                  : <div className="mt-2 text-sm font-bold text-[#5B7262] text-center">Tiếp theo ➜ 🎲 ???</div>}
              </div>
              <div>
                {q ? (
                  <>
                    <div className="text-lg font-bold text-[#5B7262]">{q.ask}</div>
                    <QBig q={q} host auto className="my-2" />
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {q.opts.map((o, i) => (
                        <div key={i} className={`rounded-2xl border-2 px-4 py-3 flex items-center gap-3 ${OPT_COLORS[i]}`}>
                          <b className="text-lg">{"ABCD"[i]}</b>
                          <span className={`font-bold ${q.optKind === "hz" ? "zh text-3xl" : q.optKind === "def" ? "zh text-base" : "text-xl"}`}>{o}</span>
                        </div>
                      ))}
                    </div>
                    {(room?.sideOk || 0) > 0 && <div className="mt-3 text-sm font-bold text-[#1E5C38]">👥 {room.sideOk} bạn khác đã trả lời đúng câu này (+{SIDE_PTS})</div>}
                  </>
                ) : <div className="text-[#5B7262]">…</div>}
                {last && last.type !== "boom" && (
                  <div key={last.at} className={`mt-4 px-4 py-2 rounded-xl font-bold ${last.type === "ok" ? "bg-[#E7F5EC] text-[#1E5C38]" : "bg-[#FDE8E8] text-[#8A1C1C]"}`} style={{ animation: "pop .3s" }}>
                    {last.type === "ok" ? `✅ ${last.name} trả lời đúng — chuyền bom!` : `❌ ${last.name} trả lời sai — câu mới!`}
                    {last.word && <span className="font-semibold"> · <span className="zh">{last.word[0]}</span> {last.word[1]}{last.word[2] ? ` · ${last.word[2]}` : ""}</span>}
                  </div>
                )}
              </div>
            </div>
          </section>
          <Board players={ranked} holder={room?.holder} />

          {phase === "boom" && last?.type === "boom" && (
            <div className="fixed inset-0 z-40 grid place-items-center text-white text-center" style={{ animation: "flashBoom .6s forwards" }}>
              <style>{`@keyframes flashBoom{0%{background:#fff}100%{background:rgba(19,38,28,.92)}}@keyframes boomA{0%{transform:scale(.2);opacity:0}30%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:1}}`}</style>
              <div style={{ animation: "boomA .6s forwards" }}>
                <div className="text-[160px] leading-none">💥</div>
                <div className="text-6xl md:text-7xl font-extrabold mt-2">BÙM!</div>
                <div className="text-3xl md:text-4xl font-extrabold mt-4">Bom nổ trong tay <span className="text-[#FFD25A]">{last.name}</span></div>
                <div className="text-xl mt-2 opacity-90">{last.lost ? `−${last.lost} điểm` : "Không còn điểm để trừ 😅"}</div>
                {last.word && <div className="mt-4 text-2xl"><span className="zh font-bold">{last.word[0]}</span> · {last.word[1]}{last.word[2] ? ` · ${last.word[2]}` : ""}</div>}
                <div className="mt-6 text-lg opacity-80">{(room?.round || 0) >= rounds ? "Sắp công bố kết quả…" : "Ván tiếp theo bắt đầu sau vài giây…"}</div>
              </div>
            </div>
          )}
        </main>
      )}

      {phase === "end" && (
        <main className="max-w-[900px] mx-auto px-4 md:px-8 py-10 text-center">
          <div className="text-7xl">🏆</div>
          <h1 className="text-4xl font-extrabold mt-2">Bảng vàng</h1>
          <Podium list={ranked} valueOf={(p) => p.score || 0} />
          <div className="mt-8 text-left"><Board players={ranked} full /></div>
          {missed.length > 0 && (
            <div className="mt-8 rounded-[22px] bg-white border border-[#DDE6D3] p-5 text-left">
              <div className="font-extrabold text-xl mb-3">📌 Từ cả lớp hay sai — nên ôn lại</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {missed.slice(0, 12).map((m) => (
                  <div key={m.w[0]} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#FDF3F3]">
                    <span className="zh text-2xl font-extrabold">{m.w[0]}</span>
                    <span className="flex-1 text-sm"><b>{m.w[1]}</b>{m.w[2] ? ` · ${m.w[2]}` : ""}</span>
                    <span className="text-sm font-extrabold text-[#C0392B]">sai {m.n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <ResultSaver game="bomb" cfg={room?.cfg} players={R.players} metric={(p) => p.score || 0} missed={missed} />
          <EndButtons />
        </main>
      )}

      {showQr && <QrModal qr={R.qr} code={R.code} onClose={() => setShowQr(false)} />}
    </HostShell>
  );
}

// ---------- quả bom + ngòi cháy ----------
function Bomb({ p, danger }) {
  const fuseLen = 70 * (1 - p);
  return (
    <svg viewBox="0 0 200 200" className="w-[190px] h-[190px]" style={{ animation: danger ? "shake .25s infinite" : "shake 1.4s infinite" }} aria-hidden="true">
      <style>{`@keyframes spark{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.6}}`}</style>
      <circle cx="92" cy="118" r="66" fill="#1F2A24" />
      <circle cx="72" cy="96" r="16" fill="#3D4C44" />
      <rect x="112" y="46" width="26" height="22" rx="5" transform="rotate(40 125 57)" fill="#3D4C44" />
      <path d={`M138 44 q ${fuseLen * 0.3} -${fuseLen * 0.5} ${fuseLen * 0.55} -${fuseLen * 0.7}`} stroke="#B98A4E" strokeWidth="6" fill="none" strokeLinecap="round" />
      <g transform={`translate(${138 + fuseLen * 0.55} ${44 - fuseLen * 0.7})`}>
        <g style={{ animation: "spark .25s infinite" }}><circle r="11" fill="#FFB627" /><circle r="6" fill="#FFF3C4" /></g>
      </g>
    </svg>
  );
}

// ---------- bảng điểm ----------
function Board({ players, holder, full }) {
  return (
    <aside className="rounded-[22px] bg-white border border-[#DDE6D3] p-4 self-start">
      <div className="font-extrabold text-lg mb-3">Bảng điểm · {players.length} bạn</div>
      <ol className={`flex flex-col gap-1.5 ${full ? "" : "max-h-[70vh] overflow-auto"}`}>
        {players.map((p, i) => (
          <li key={p.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${p.id === holder ? "bg-[#FDE8E8] border border-[#F2B8B8]" : "bg-[#F6F9F2]"}`}>
            <span className="w-6 text-center font-extrabold text-[#5B7262]">{i + 1}</span>
            <span className="flex-1 font-bold truncate">{p.id === holder ? "💣 " : ""}{p.name}</span>
            {(p.booms || 0) > 0 && <span className="text-sm" title="Số lần bị nổ">💥{p.booms}</span>}
            <span className="font-extrabold tabular-nums">{p.score || 0}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
