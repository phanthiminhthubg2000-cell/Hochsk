"use client";
// ============================================================
// BOM NỔ CHẬM 传炸弹 — MÀN HÌNH GIÁO VIÊN (phát trực tiếp)
// Giáo viên chọn đề & chế độ → tạo phòng + mã QR → học sinh vào bằng điện thoại.
// Máy giáo viên là "trọng tài": ra câu hỏi, chấm đáp án, chuyền bom, đếm ngược ngòi nổ.
// ============================================================
import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { db } from "../../../firebase";
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection, deleteDoc, increment, serverTimestamp } from "firebase/firestore";
import { ROOMS, MODES, buildPool, makeQuestion, publicQuestion, modeAllowed, newCode, pickOne, loadVocab } from "../game";

const FUSES = [
  { k: "short", label: "Ngắn", sub: "20–35 giây", min: 20, max: 35 },
  { k: "mid", label: "Vừa", sub: "30–50 giây", min: 30, max: 50 },
  { k: "long", label: "Dài", sub: "45–75 giây", min: 45, max: 75 },
];
const ROUNDS = [3, 5, 8];
const OPT_COLORS = ["bg-[#E8F7EE] border-[#7BCB9A]", "bg-[#FFF4DE] border-[#F2C46B]", "bg-[#E8F0FF] border-[#8FB0F0]", "bg-[#FDE8F1] border-[#EBA0C2]"];

export default function BombHost() {
  const [vocab, setVocab] = useState(null);
  const [lv, setLv] = useState(0);
  const [les, setLes] = useState([0]);
  const [mode, setMode] = useState("mix");
  const [fuse, setFuse] = useState("mid");
  const [rounds, setRounds] = useState(5);
  const [phase, setPhase] = useState("setup"); // setup | lobby | play | boom | end
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const [players, setPlayers] = useState([]);
  const [room, setRoom] = useState(null);
  const [err, setErr] = useState("");
  const [fuseP, setFuseP] = useState(0);
  const [sound, setSound] = useState(true);
  const [showQr, setShowQr] = useState(false);

  const G = useRef({ pool: [], q: null, holder: null, fuseEnd: 0, fuseTotal: 1, round: 0, used: new Set(), done: new Set(), paused: false, pauseLeft: 0, lastTick: 0 });
  const playersRef = useRef([]);
  const unsub = useRef([]);
  const AC = useRef(null);

  useEffect(() => { loadVocab().then(setVocab).catch(() => setErr("Không tải được kho từ vựng.")); }, []);
  useEffect(() => () => unsub.current.forEach((u) => u && u()), []);

  const level = vocab ? vocab[lv] : null;
  const pool = useMemo(() => (level ? buildPool(level, les) : []), [level, les]);
  const joinUrl = typeof window !== "undefined" && code ? `${window.location.origin}/bom?r=${code}` : "";
  const roomRef = code ? doc(db, ROOMS, code) : null;

  // ---------- âm thanh ----------
  const tone = (f, t0, d, type = "sine", vol = 0.2) => {
    if (!sound) return;
    try {
      AC.current = AC.current || new (window.AudioContext || window.webkitAudioContext)();
      const ac = AC.current, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      const t = ac.currentTime + t0;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t); o.stop(t + d + 0.05);
    } catch (e) {}
  };
  const boomSound = () => {
    if (!sound) return;
    try {
      const ac = AC.current || new (window.AudioContext || window.webkitAudioContext)(); AC.current = ac;
      const len = ac.sampleRate * 1.2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 900; src.buffer = buf; src.connect(f); f.connect(g); g.connect(ac.destination); g.gain.value = 0.9; src.start();
    } catch (e) {}
  };

  // ---------- tạo phòng ----------
  async function createRoom() {
    setErr("");
    if (pool.length < 4) { setErr("Hãy chọn bài có ít nhất 4 từ."); return; }
    let c = newCode();
    try {
      for (let i = 0; i < 5; i++) { const s = await getDoc(doc(db, ROOMS, c)); if (!s.exists() || s.data().status === "end") break; c = newCode(); }
      const lessonsLabel = les.length === level.lessons.length ? `Tất cả ${les.length} bài` : `Bài ${les.map((i) => level.lessons[i].n).join(", ")}`;
      await setDoc(doc(db, ROOMS, c), {
        game: "bomb", status: "lobby", createdAt: serverTimestamp(), round: 0, rounds,
        cfg: { level: level.name, lessons: lessonsLabel, mode: MODES.find((m) => m[0] === mode)[1] },
        holder: null, holderName: "", q: null, last: null,
      });
    } catch (e) {
      setErr("Không tạo được phòng — Firestore từ chối quyền ghi (" + (e.code || e.message) + "). Cần mở quyền đọc/ghi cho collection “game_rooms”.");
      return;
    }
    setCode(c);
    G.current = { ...G.current, pool, used: new Set(), done: new Set(), round: 0 };
    const url = `${window.location.origin}/bom?r=${c}`;
    QRCode.toDataURL(url, { width: 520, margin: 1, color: { dark: "#13261C", light: "#FFFFFF" } }).then(setQr);
    // nghe danh sách người chơi
    unsub.current.push(onSnapshot(collection(db, ROOMS, c, "players"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.score || 0) - (a.score || 0) || (a.booms || 0) - (b.booms || 0));
      playersRef.current = list; setPlayers(list);
    }));
    unsub.current.push(onSnapshot(doc(db, ROOMS, c), (s) => setRoom(s.data() || null)));
    // nghe câu trả lời
    unsub.current.push(onSnapshot(collection(db, ROOMS, c, "answers"), (snap) => {
      snap.docChanges().forEach((ch) => { if (ch.type === "added") handleAnswer(c, ch.doc.id, ch.doc.data()); });
    }));
    setPhase("lobby");
  }

  // ---------- luật chơi ----------
  function nextQuestion() {
    const g = G.current;
    if (g.used.size > g.pool.length - 4) g.used = new Set();
    const q = makeQuestion(g.pool, mode, g.used);
    g.used.add(q.word[0]); g.q = q;
    return q;
  }
  const nameOf = (pid) => playersRef.current.find((p) => p.id === pid)?.name || "?";

  async function startRound(c = code) {
    const g = G.current, list = playersRef.current;
    if (!list.length) { setErr("Chưa có học sinh nào vào phòng."); return; }
    g.round += 1;
    const others = list.filter((p) => p.id !== g.holder);
    g.holder = pickOne(others.length ? others : list).id;
    const f = FUSES.find((x) => x.k === fuse);
    g.fuseTotal = (f.min + Math.random() * (f.max - f.min)) * 1000;
    g.fuseEnd = Date.now() + g.fuseTotal; g.paused = false;
    const q = nextQuestion();
    setPhase("play");
    await updateDoc(doc(db, ROOMS, c), { status: "play", round: g.round, holder: g.holder, holderName: nameOf(g.holder), q: publicQuestion(q), last: null, passes: 0 });
    tone(523, 0, 0.15, "triangle"); tone(784, 0.12, 0.2, "triangle");
  }

  async function handleAnswer(c, id, a) {
    const g = G.current;
    if (g.done.has(id)) return; g.done.add(id);
    deleteDoc(doc(db, ROOMS, c, "answers", id)).catch(() => {});
    if (!g.q || a.qid !== g.q.id || a.pid !== g.holder || g.paused || Date.now() > g.fuseEnd) return;
    const ok = a.choice === g.q.ans;
    const w = g.q.word;
    const pRef = doc(db, ROOMS, c, "players", a.pid);
    if (ok) {
      updateDoc(pRef, { score: increment(10), correct: increment(1) }).catch(() => {});
      const others = playersRef.current.filter((p) => p.id !== a.pid);
      const to = others.length ? pickOne(others).id : a.pid;
      g.holder = to;
      const q = nextQuestion();
      tone(660, 0, 0.1, "triangle"); tone(990, 0.08, 0.15, "triangle");
      await updateDoc(doc(db, ROOMS, c), { holder: to, holderName: nameOf(to), q: publicQuestion(q), last: { type: "ok", pid: a.pid, name: nameOf(a.pid), word: w, at: Date.now() }, passes: increment(1) });
    } else {
      updateDoc(pRef, { wrong: increment(1) }).catch(() => {});
      const q = nextQuestion();
      tone(200, 0, 0.25, "sawtooth", 0.12);
      await updateDoc(doc(db, ROOMS, c), { q: publicQuestion(q), last: { type: "bad", pid: a.pid, name: nameOf(a.pid), word: w, at: Date.now() } });
    }
  }

  async function explode() {
    const g = G.current;
    if (phase !== "play") return;
    setPhase("boom"); boomSound();
    const pid = g.holder;
    updateDoc(doc(db, ROOMS, code, "players", pid), { booms: increment(1), score: increment(-15) }).catch(() => {});
    await updateDoc(doc(db, ROOMS, code), { status: "boom", last: { type: "boom", pid, name: nameOf(pid), word: g.q?.word || null, at: Date.now() } });
    g.q = null;
    setTimeout(async () => {
      if (g.ended) return;
      if (g.round >= rounds) { setPhase("end"); await updateDoc(doc(db, ROOMS, code), { status: "end", q: null }); }
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
      // tiếng tích tắc nhanh dần
      const gap = 900 - 700 * p;
      if (Date.now() - g.lastTick > gap) { g.lastTick = Date.now(); tone(p > 0.75 ? 1400 : 1000, 0, 0.04, "square", 0.05); }
      if (left <= 0) { clearInterval(iv); explode(); }
    }, 100);
    return () => clearInterval(iv);
  }, [phase]); // eslint-disable-line

  function togglePause() {
    const g = G.current;
    if (phase !== "play") return;
    if (!g.paused) { g.paused = true; g.pauseLeft = g.fuseEnd - Date.now(); updateDoc(roomRef, { paused: true }).catch(() => {}); }
    else { g.paused = false; g.fuseEnd = Date.now() + g.pauseLeft; updateDoc(roomRef, { paused: false }).catch(() => {}); }
    setRoom((r) => ({ ...r, paused: g.paused }));
  }
  async function endGame() { G.current.ended = true; G.current.q = null; setPhase("end"); if (roomRef) await updateDoc(roomRef, { status: "end", q: null }).catch(() => {}); }
  async function kick(pid) { if (code) await deleteDoc(doc(db, ROOMS, code, "players", pid)).catch(() => {}); }
  function fs() { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {} }

  // ============================================================
  // GIAO DIỆN
  // ============================================================
  const q = room?.q;
  const last = room?.last;
  const holderName = room?.holderName || "";

  return (
    <div className="bomb-host min-h-screen bg-[#F4F7EF] text-[#13261C]">
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;700;800;900&family=Noto+Sans+SC:wght@500;700;900&display=swap");
.bomb-host{font-family:"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif}
.bomb-host .zh{font-family:"Noto Sans SC","Be Vietnam Pro",sans-serif}
@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
@keyframes spark{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:.6}}
@keyframes boomA{0%{transform:scale(.2);opacity:0}30%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes flash{0%{background:#fff}100%{background:rgba(19,38,28,.92)}}
@keyframes pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>

      {/* ---------- THANH TRÊN ---------- */}
      <header className="h-16 px-4 md:px-8 flex items-center gap-3 border-b border-[#DDE6D3] bg-white/80">
        <a href="/" className="font-extrabold text-lg">HSK Garden</a>
        <span className="text-[#9AAB9E]">/</span>
        <span className="font-extrabold">💣 Bom nổ chậm <span className="zh text-[#5B7262] font-bold">传炸弹</span></span>
        <span className="ml-auto" />
        {code && <span className="hidden md:inline text-sm font-bold bg-[#FFF4DE] border border-[#F6D99A] rounded-full px-3 py-1.5">Mã phòng <b className="tracking-widest text-base">{code}</b></span>}
        {phase !== "setup" && phase !== "lobby" && <button onClick={() => setShowQr(true)} className="h-10 px-3 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">QR</button>}
        <button onClick={() => setSound(!sound)} className="h-10 px-3 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">{sound ? "🔊" : "🔇"}</button>
        <button onClick={fs} className="h-10 px-3 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">⛶</button>
      </header>

      {err && <div className="max-w-[1100px] mx-auto mt-4 px-4"><div className="p-4 rounded-2xl bg-[#FDE8E8] border border-[#F2B8B8] text-[#8A1C1C] font-semibold">{err}</div></div>}

      {/* ---------- 1. CHỌN ĐỀ ---------- */}
      {phase === "setup" && (
        <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 grid gap-8 lg:grid-cols-[1fr_1.1fr] items-start">
          <section className="text-center lg:text-left pt-4">
            <div className="text-[110px] leading-none select-none" style={{ animation: "shake 1.2s infinite" }}>💣</div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-4">Bom nổ chậm</h1>
            <p className="zh text-xl text-[#5B7262] font-bold mt-1">传炸弹</p>
            <ul className="mt-6 space-y-2 text-[17px] text-[#3F5546] text-left inline-block">
              <li>📱 Học sinh quét mã QR, nhập tên, chơi trên điện thoại.</li>
              <li>💣 Bom rơi vào tay ai, người đó phải trả lời câu hỏi.</li>
              <li>✅ Đúng → bom chuyền sang bạn khác · ❌ Sai → câu mới, bom vẫn trong tay.</li>
              <li>💥 Ngòi nổ ngẫu nhiên — bom nổ ở tay ai, người đó bị trừ điểm.</li>
              <li>📺 Màn hình này phát trực tiếp cho cả lớp xem.</li>
            </ul>
          </section>
          <section className="rounded-[22px] bg-white border border-[#DDE6D3] p-6 flex flex-col gap-5">
            {!vocab ? <div className="text-[#5B7262]">Đang tải kho từ vựng…</div> : (<>
              <div>
                <div className="text-xs font-extrabold tracking-widest text-[#5B7262] uppercase mb-2">Cấp độ</div>
                <div className="flex flex-wrap gap-2">
                  {vocab.map((v, i) => (
                    <button key={v.id} onClick={() => { setLv(i); setLes([0]); if (!modeAllowed(v, mode)) setMode("mix"); }}
                      className={`h-11 px-5 rounded-xl font-bold border ${lv === i ? "bg-[#2E9D5B] text-white border-[#2E9D5B]" : "bg-white border-[#C9D6BE]"}`}>{v.name}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-extrabold tracking-widest text-[#5B7262] uppercase mb-2">Chọn bài <span className="normal-case tracking-normal text-[#1E7A45]">· {pool.length} từ</span></div>
                <div className="flex flex-wrap gap-1.5 max-h-48 overflow-auto">
                  <button onClick={() => setLes(les.length === level.lessons.length ? [0] : level.lessons.map((_, i) => i))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${les.length === level.lessons.length ? "bg-[#FFF4DE] border-[#F2C46B]" : "bg-white border-[#DDE6D3]"}`}>✔ Tất cả</button>
                  {level.lessons.map((l, i) => (
                    <button key={i} onClick={() => setLes(les.includes(i) ? (les.length > 1 ? les.filter((x) => x !== i) : les) : [...les, i].sort((a, b) => a - b))}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border ${les.includes(i) ? "bg-[#E7F5EC] border-[#2E9D5B]" : "bg-white border-[#DDE6D3]"}`}>
                      <b className="text-[#C97A00] mr-1">{l.n}</b><span className="zh">{l.t}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-extrabold tracking-widest text-[#5B7262] uppercase mb-2">Dạng câu hỏi</div>
                <div className="flex flex-wrap gap-2">
                  {MODES.filter((m) => modeAllowed(level, m[0])).map((m) => (
                    <button key={m[0]} onClick={() => setMode(m[0])} className={`h-10 px-4 rounded-xl text-sm font-bold border ${mode === m[0] ? "bg-[#2E9D5B] text-white border-[#2E9D5B]" : "bg-white border-[#C9D6BE]"}`}>{m[1]}</button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <div className="text-xs font-extrabold tracking-widest text-[#5B7262] uppercase mb-2">Ngòi nổ mỗi ván</div>
                  <div className="flex flex-wrap gap-2">
                    {FUSES.map((f) => (
                      <button key={f.k} onClick={() => setFuse(f.k)} className={`px-3 py-2 rounded-xl text-sm font-bold border text-left ${fuse === f.k ? "bg-[#2E9D5B] text-white border-[#2E9D5B]" : "bg-white border-[#C9D6BE]"}`}>{f.label}<div className="text-[11px] font-semibold opacity-80">{f.sub}</div></button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-extrabold tracking-widest text-[#5B7262] uppercase mb-2">Số ván (số lần bom nổ)</div>
                  <div className="flex gap-2">
                    {ROUNDS.map((r) => (
                      <button key={r} onClick={() => setRounds(r)} className={`h-12 w-14 rounded-xl font-extrabold border ${rounds === r ? "bg-[#2E9D5B] text-white border-[#2E9D5B]" : "bg-white border-[#C9D6BE]"}`}>{r}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={createRoom} className="h-14 rounded-2xl bg-[#2E9D5B] hover:bg-[#1E7A45] text-white text-lg font-extrabold">Tạo phòng & mã QR →</button>
            </>)}
          </section>
        </main>
      )}

      {/* ---------- 2. PHÒNG CHỜ ---------- */}
      {phase === "lobby" && (
        <main className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 grid gap-8 lg:grid-cols-[auto_1fr] items-start">
          <section className="rounded-[26px] bg-white border border-[#DDE6D3] p-6 text-center mx-auto">
            <div className="font-extrabold text-xl mb-3">📱 Quét mã để vào phòng</div>
            {qr ? <img src={qr} alt={`Mã QR vào phòng ${code}`} className="w-[300px] h-[300px] md:w-[360px] md:h-[360px] mx-auto" /> : <div className="w-[300px] h-[300px] bg-[#F1F5EC] rounded-xl" />}
            <div className="mt-3 text-[#5B7262] font-semibold">hoặc vào <b className="text-[#13261C]">{joinUrl.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}</b> và nhập mã</div>
            <div className="text-6xl font-extrabold tracking-[0.18em] mt-2">{code}</div>
          </section>
          <section className="flex flex-col gap-5">
            <div className="rounded-[22px] bg-[#1E5C38] text-white p-6">
              <div className="text-sm font-bold opacity-80">{room?.cfg?.level} · {room?.cfg?.lessons} · {room?.cfg?.mode} · {rounds} ván</div>
              <div className="text-3xl font-extrabold mt-1">Đã có {players.length} bạn vào phòng</div>
            </div>
            <div className="flex flex-wrap gap-2.5 min-h-[120px] content-start">
              {players.length === 0 && <div className="text-[#5B7262]">Đang chờ học sinh quét mã…</div>}
              {players.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-2 pl-4 pr-2 py-2 rounded-full bg-white border border-[#C9D6BE] font-bold text-lg" style={{ animation: "pop .3s" }}>
                  {p.name}
                  <button onClick={() => kick(p.id)} aria-label={`Mời ${p.name} ra khỏi phòng`} className="w-7 h-7 rounded-full hover:bg-[#FDE8E8] text-[#9AAB9E] hover:text-[#C0392B]">×</button>
                </span>
              ))}
            </div>
            <button disabled={players.length < 1} onClick={() => startRound()} className="h-16 rounded-2xl bg-[#E8590C] hover:bg-[#C94A08] disabled:opacity-40 text-white text-xl font-extrabold">💣 Châm ngòi — bắt đầu!</button>
            <p className="text-sm text-[#5B7262]">Nên có từ 3 bạn trở lên. Học sinh vào muộn vẫn được tham gia giữa chừng.</p>
          </section>
        </main>
      )}

      {/* ---------- 3. ĐANG CHƠI ---------- */}
      {(phase === "play" || phase === "boom") && (
        <main className="max-w-[1400px] mx-auto px-4 md:px-8 py-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <section className="flex flex-col gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-extrabold bg-white border border-[#DDE6D3] rounded-full px-4 py-2">Ván {room?.round || 0}/{rounds}</span>
              <span className="text-sm font-bold text-[#5B7262]">Đã chuyền {room?.passes || 0} lần</span>
              <span className="ml-auto" />
              <button onClick={togglePause} className="h-10 px-4 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">{room?.paused ? "▶ Tiếp tục" : "⏸ Tạm dừng"}</button>
              <button onClick={endGame} className="h-10 px-4 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">Kết thúc</button>
            </div>

            <div className="rounded-[26px] bg-white border border-[#DDE6D3] p-6 grid md:grid-cols-[220px_1fr] gap-6 items-center">
              <div className="flex flex-col items-center">
                <Bomb p={fuseP} danger={fuseP > 0.7} />
                <div className="text-sm font-bold text-[#5B7262] mt-2">Bom đang ở tay</div>
                <div className="text-3xl md:text-4xl font-extrabold text-[#C0392B] text-center break-words">{holderName}</div>
              </div>
              <div>
                {q ? (
                  <>
                    <div className="text-lg font-bold text-[#5B7262]">{q.ask}</div>
                    <div className={`font-extrabold leading-tight my-2 ${q.kind === "hz" ? "zh text-6xl md:text-7xl" : q.kind === "def" ? "zh text-2xl md:text-3xl" : "text-4xl md:text-5xl text-[#1E7A45]"}`}>{q.big}</div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {q.opts.map((o, i) => (
                        <div key={i} className={`rounded-2xl border-2 px-4 py-3 flex items-center gap-3 ${OPT_COLORS[i]}`}>
                          <b className="text-lg">{"ABCD"[i]}</b>
                          <span className={`font-bold ${q.optKind === "hz" ? "zh text-3xl" : q.optKind === "def" ? "zh text-base" : "text-xl"}`}>{o}</span>
                        </div>
                      ))}
                    </div>
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
          <Board players={players} holder={room?.holder} />

          {phase === "boom" && last?.type === "boom" && (
            <div className="fixed inset-0 z-40 grid place-items-center text-white text-center" style={{ animation: "flash .6s forwards" }}>
              <div style={{ animation: "boomA .6s forwards" }}>
                <div className="text-[160px] leading-none">💥</div>
                <div className="text-6xl md:text-7xl font-extrabold mt-2">BÙM!</div>
                <div className="text-3xl md:text-4xl font-extrabold mt-4">Bom nổ trong tay <span className="text-[#FFD25A]">{last.name}</span></div>
                <div className="text-xl mt-2 opacity-90">−15 điểm</div>
                {last.word && <div className="mt-4 text-2xl"><span className="zh font-bold">{last.word[0]}</span> · {last.word[1]}{last.word[2] ? ` · ${last.word[2]}` : ""}</div>}
                <div className="mt-6 text-lg opacity-80">{(room?.round || 0) >= rounds ? "Sắp công bố kết quả…" : "Ván tiếp theo bắt đầu sau vài giây…"}</div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ---------- 4. KẾT QUẢ ---------- */}
      {phase === "end" && (
        <main className="max-w-[900px] mx-auto px-4 md:px-8 py-10 text-center">
          <div className="text-7xl">🏆</div>
          <h1 className="text-4xl font-extrabold mt-2">Bảng vàng</h1>
          <div className="flex justify-center items-end gap-4 mt-8">
            {[1, 0, 2].map((i) => players[i] && (
              <div key={players[i].id} className="flex flex-col items-center">
                <div className="text-4xl">{["🥇", "🥈", "🥉"][i]}</div>
                <div className="font-extrabold text-xl mt-1">{players[i].name}</div>
                <div className="text-[#5B7262] font-bold">{players[i].score || 0} điểm</div>
                <div className={`w-28 mt-2 rounded-t-2xl ${i === 0 ? "h-40 bg-[#F2C46B]" : i === 1 ? "h-28 bg-[#C9D6BE]" : "h-20 bg-[#E8B48A]"}`} />
              </div>
            ))}
          </div>
          <div className="mt-8 text-left"><Board players={players} full /></div>
          <div className="flex gap-3 justify-center mt-8 flex-wrap">
            <button onClick={() => window.location.reload()} className="h-12 px-6 rounded-xl bg-[#2E9D5B] text-white font-extrabold">Tạo phòng mới</button>
            <a href="/" className="h-12 px-6 rounded-xl border border-[#C9D6BE] bg-white font-bold grid place-items-center">Về HSK Garden</a>
          </div>
        </main>
      )}

      {/* QR khi đang chơi */}
      {showQr && (
        <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white rounded-3xl p-6 text-center">
            {qr && <img src={qr} alt="Mã QR vào phòng" className="w-[320px] h-[320px]" />}
            <div className="text-5xl font-extrabold tracking-[0.18em] mt-2">{code}</div>
            <div className="text-sm text-[#5B7262] mt-2">Bấm ra ngoài để đóng</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- quả bom + ngòi cháy ----------
function Bomb({ p, danger }) {
  const fuseLen = 70 * (1 - p);
  return (
    <svg viewBox="0 0 200 200" className="w-[190px] h-[190px]" style={{ animation: danger ? "shake .25s infinite" : "shake 1.4s infinite" }} aria-hidden="true">
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
