"use client";
// ============================================================
// TRÒ CHƠI CẢ LỚP (nhiều điện thoại) — phần dùng chung cho màn hình giáo viên
// Kéo co 拔河 · Đua về đích 赛跑 · Ai nhanh nhất 抢答
// Phòng lưu ở Firestore game_rooms/{code} (cùng collection với Bom nổ chậm)
//   ├─ players/{pid}  : tên, đội, điểm, số câu đúng/sai, vị trí
//   └─ answers/{auto} : (chỉ trò Ai nhanh nhất) câu trả lời gửi lên để máy GV chấm
// ============================================================
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { db } from "../../firebase";
import { doc, setDoc, getDoc, getDocs, onSnapshot, collection, deleteDoc, serverTimestamp, writeBatch, query, where, limit, Timestamp } from "firebase/firestore";
import { ROOMS, MODES, buildPool, modeAllowed, newCode, loadVocab, upTo } from "../bom/game";
import { loadClasses, saveGameResult, missedToTest } from "./results";
import QBig from "../bom/QBig";

export { ROOMS, MODES };
export const RACERS = ["🐎", "🐇", "🐢", "🐕", "🐈", "🐖", "🐄", "🐓", "🦊", "🐼", "🐨", "🐯", "🦁", "🐸", "🐧", "🦆", "🐘", "🦒", "🐿️", "🦔"];


export const FONT_CSS = `@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;700;800;900&family=Noto+Sans+SC:wght@500;700;900&display=swap");
.cg{font-family:"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif}
.cg .zh{font-family:"Noto Sans SC","Be Vietnam Pro",sans-serif}
@keyframes pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
@keyframes flashIn{0%{opacity:0;transform:scale(.8)}100%{opacity:1;transform:scale(1)}}`;

export const OPT_COLORS = ["bg-[#E8F7EE] border-[#7BCB9A]", "bg-[#FFF4DE] border-[#F2C46B]", "bg-[#E8F0FF] border-[#8FB0F0]", "bg-[#FDE8F1] border-[#EBA0C2]"];

// ---------- âm thanh đơn giản (WebAudio) ----------
export function useTone() {
  const [sound, setSound] = useState(true);
  const on = useRef(true);
  const AC = useRef(null);
  useEffect(() => { on.current = sound; }, [sound]);
  const tone = (f, t0 = 0, d = 0.15, type = "sine", vol = 0.2) => {
    if (!on.current) return;
    try {
      AC.current = AC.current || new (window.AudioContext || window.webkitAudioContext)();
      const ac = AC.current, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      const t = ac.currentTime + t0;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.start(t); o.stop(t + d + 0.05);
    } catch (e) {}
  };
  const fanfare = () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.12, 0.25, "triangle", 0.22)); };
  const boom = () => {
    if (!on.current) return;
    try {
      const ac = AC.current || new (window.AudioContext || window.webkitAudioContext)(); AC.current = ac;
      const len = ac.sampleRate * 1.2, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = 900; src.buffer = buf; src.connect(f); f.connect(g); g.connect(ac.destination); g.gain.value = 0.9; src.start();
    } catch (e) {}
  };
  return { sound, setSound, tone, fanfare, boom };
}

// ---------- kho từ + chọn đề + chọn lớp ----------
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
export function useDeck() {
  const [vocab, setVocab] = useState(null);
  const [err, setErr] = useState("");
  const [lv, setLvRaw] = useState(0);
  const [les, setLes] = useState([0]);
  const [mode, setMode] = useState("mix");
  const [classes, setClasses] = useState(null); // null = đang tải · [] = không có / lỗi
  const [clsId, setClsIdRaw] = useState("");
  useEffect(() => {
    loadVocab().then((v) => {
      setVocab(v);
      const saved = v.findIndex((x) => x.id === LS.get("hg_game_lv"));
      if (saved >= 0) setLvRaw(saved);
    }).catch(() => setErr("Không tải được kho từ vựng."));
    loadClasses().then((c) => { setClasses(c); const s = LS.get("hg_game_cls"); if (s && c.some((x) => x.id === s)) setClsIdRaw(s); }).catch(() => setClasses([]));
  }, []);
  const setLv = (i) => { setLvRaw(i); if (vocab && vocab[i]) LS.set("hg_game_lv", vocab[i].id); };
  const setClsId = (id) => { setClsIdRaw(id); LS.set("hg_game_cls", id); };
  const level = vocab ? vocab[lv] : null;
  const pool = level ? buildPool(level, les) : [];
  const cls = (classes || []).find((c) => c.id === clsId) || null;
  const cfg = () => ({
    lv, les, modeKey: mode,
    level: level.name, levelId: level.id,
    lessonNums: les.map((i) => level.lessons[i].n),
    lessons: les.length === level.lessons.length ? `Tất cả ${les.length} bài` : les.length > 3 && les.every((x, i) => x === i) ? `Bài ${level.lessons[0].n}–${level.lessons[les.length - 1].n}` : `Bài ${les.map((i) => level.lessons[i].n).join(", ")}`,
    mode: MODES.find((m) => m[0] === mode)[1],
    ...(cls ? { classId: cls.id, className: cls.className, classLevel: cls.level, roster: cls.students } : {}),
  });
  return { vocab, err, setErr, lv, setLv, les, setLes, mode, setMode, level, pool, cfg, classes, clsId, setClsId, cls };
}

export function DeckPicker({ deck }) {
  const { vocab, lv, setLv, les, setLes, mode, setMode, level, pool, classes, clsId, setClsId, cls } = deck;
  if (!vocab) return <div className="text-[#5B7262]">Đang tải kho từ vựng…</div>;
  return (
    <>
      <div>
        <Label>Lớp <span className="normal-case tracking-normal text-[#5B7262] font-semibold">· để lưu kết quả vào hồ sơ học sinh</span></Label>
        <select aria-label="Lớp" value={clsId} onChange={(e) => setClsId(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-[#C9D6BE] bg-white font-bold">
          <option value="">— Không gắn lớp (học sinh tự nhập tên) —</option>
          {(classes || []).map((c) => <option key={c.id} value={c.id}>{c.className}{c.level ? ` · ${c.level}` : ""} · {c.students.length} HS</option>)}
        </select>
        {classes === null && <div className="text-xs text-[#5B7262] mt-1">Đang tải danh sách lớp…</div>}
        {cls && <div className="text-xs text-[#1E5C38] mt-1 font-semibold">Học sinh sẽ chọn tên mình trong danh sách lớp · kết quả lưu vào lớp {cls.className}</div>}
      </div>
      <div>
        <Label>Cấp độ</Label>
        <div className="flex flex-wrap gap-2">
          {vocab.map((v, i) => (
            <button key={v.id} onClick={() => { setLv(i); setLes([0]); if (!modeAllowed(v, mode)) setMode("mix"); }}
              className={`h-11 px-5 rounded-xl font-bold border ${lv === i ? "bg-[#2E9D5B] text-white border-[#2E9D5B]" : "bg-white border-[#C9D6BE]"}`}>{v.name}</button>
          ))}
        </div>
      </div>
      <div>
        <Label>Chọn bài <span className="normal-case tracking-normal text-[#1E7A45]">· {pool.length} từ</span></Label>
        <div className="flex items-center gap-2 mb-2 text-sm font-bold text-[#3F5546]">
          <span>⚡ Ôn từ bài 1 đến</span>
          <select aria-label="Ôn đến bài" value={les.length && les.every((x, i) => x === i) ? les.length : ""} onChange={(e) => e.target.value && setLes(upTo(+e.target.value))}
            className="h-9 px-2 rounded-lg border border-[#C9D6BE] bg-white font-bold">
            <option value="">— chọn —</option>
            {level.lessons.map((l, i) => <option key={i} value={i + 1}>Bài {l.n} · {l.t}</option>)}
          </select>
        </div>
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
        <Label>Dạng câu hỏi</Label>
        <div className="flex flex-wrap gap-2">
          {MODES.filter((m) => modeAllowed(level, m[0])).map((m) => (
            <button key={m[0]} onClick={() => setMode(m[0])} className={`h-10 px-4 rounded-xl text-sm font-bold border ${mode === m[0] ? "bg-[#2E9D5B] text-white border-[#2E9D5B]" : "bg-white border-[#C9D6BE]"}`}>{m[1]}</button>
          ))}
        </div>
      </div>
    </>
  );
}

export const Label = ({ children }) => <div className="text-xs font-extrabold tracking-widest text-[#5B7262] uppercase mb-2">{children}</div>;

export function Choice({ items, value, onChange, accent = "#2E9D5B" }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(([v, label, sub]) => (
        <button key={v} onClick={() => onChange(v)} style={value === v ? { background: accent, borderColor: accent } : {}}
          className={`px-4 py-2 rounded-xl text-sm font-bold border text-left ${value === v ? "text-white" : "bg-white border-[#C9D6BE]"}`}>
          {label}{sub && <div className="text-[11px] font-semibold opacity-80">{sub}</div>}
        </button>
      ))}
    </div>
  );
}

// ---------- dọn phòng cũ ----------
// Mỗi lần giáo viên tạo phòng: xoá tối đa 15 phòng tạo cách đây hơn 12 giờ (kèm players/answers).
// Chạy ngầm, lỗi thì bỏ qua — không ảnh hưởng trò chơi.
export async function cleanupOldRooms(keep = "") {
  try {
    const cutoff = Timestamp.fromMillis(Date.now() - 12 * 3600 * 1000);
    const snap = await getDocs(query(collection(db, ROOMS), where("createdAt", "<", cutoff), limit(15)));
    for (const r of snap.docs) {
      if (r.id === keep) continue;
      for (const sub of ["players", "answers"]) {
        const ss = await getDocs(collection(db, ROOMS, r.id, sub));
        for (let i = 0; i < ss.docs.length; i += 400) {
          const b = writeBatch(db); ss.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit();
        }
      }
      await deleteDoc(r.ref);
    }
    return snap.size;
  } catch (e) { return 0; }
}

// ---------- phòng chơi (máy giáo viên) ----------
export function useHostRoom() {
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const [players, setPlayers] = useState([]); // theo thứ tự vào phòng
  const [room, setRoom] = useState(null);
  const playersRef = useRef([]);
  const unsub = useRef([]);
  useEffect(() => () => unsub.current.forEach((u) => u && u()), []);

  async function create(data, onPlayers) {
    let c = newCode();
    for (let i = 0; i < 5; i++) { const s = await getDoc(doc(db, ROOMS, c)); if (!s.exists() || s.data().status === "end") break; c = newCode(); }
    await setDoc(doc(db, ROOMS, c), { createdAt: serverTimestamp(), status: "lobby", ...data });
    setCode(c);
    const url = `${window.location.origin}/choi?r=${c}`;
    QRCode.toDataURL(url, { width: 520, margin: 1, color: { dark: "#13261C", light: "#FFFFFF" } }).then(setQr);
    unsub.current.push(onSnapshot(collection(db, ROOMS, c, "players"), (snap) => {
      const ms = (p) => (p.joinedAt && p.joinedAt.toMillis ? p.joinedAt.toMillis() : Number.MAX_SAFE_INTEGER);
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(a) - ms(b) || a.id.localeCompare(b.id));
      playersRef.current = list; setPlayers(list);
      onPlayers && onPlayers(list, c);
    }));
    unsub.current.push(onSnapshot(doc(db, ROOMS, c), (s) => setRoom(s.data() || null)));
    setTimeout(() => cleanupOldRooms(c), 4000);
    return c;
  }
  const listen = (fn) => unsub.current.push(fn);
  async function kick(pid) { if (code) await deleteDoc(doc(db, ROOMS, code, "players", pid)).catch(() => {}); }
  async function resetPlayers(fields) {
    const b = writeBatch(db);
    playersRef.current.forEach((p) => b.set(doc(db, ROOMS, code, "players", p.id), fields, { merge: true }));
    await b.commit();
  }
  const joinUrl = typeof window !== "undefined" && code ? `${window.location.origin}/choi` : "";
  return { code, qr, players, playersRef, room, create, kick, listen, resetPlayers, joinUrl };
}

export const fullscreen = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {} };

// ---------- khung trang giáo viên ----------
export function HostShell({ icon, title, zh, code, onQr, tone, children, err }) {
  return (
    <div className="cg min-h-screen bg-[#F4F7EF] text-[#13261C]">
      <style>{FONT_CSS}</style>
      <header className="h-16 px-4 md:px-8 flex items-center gap-3 border-b border-[#DDE6D3] bg-white/80">
        <a href="/?tab=play" className="font-extrabold text-lg">HSK Garden</a>
        <span className="text-[#9AAB9E]">/</span>
        <span className="font-extrabold">{icon} {title} <span className="zh text-[#5B7262] font-bold">{zh}</span></span>
        <span className="ml-auto" />
        {code && <span className="hidden md:inline text-sm font-bold bg-[#FFF4DE] border border-[#F6D99A] rounded-full px-3 py-1.5">Mã phòng <b className="tracking-widest text-base">{code}</b></span>}
        {onQr && <button onClick={onQr} className="h-10 px-3 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">QR</button>}
        {tone && <button onClick={() => tone.setSound(!tone.sound)} className="h-10 px-3 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold">{tone.sound ? "🔊" : "🔇"}</button>}
        <button onClick={fullscreen} className="h-10 px-3 rounded-xl border border-[#C9D6BE] bg-white text-sm font-bold" aria-label="Toàn màn hình">⛶</button>
      </header>
      {err && <div className="max-w-[1100px] mx-auto mt-4 px-4"><div className="p-4 rounded-2xl bg-[#FDE8E8] border border-[#F2B8B8] text-[#8A1C1C] font-semibold">{err}</div></div>}
      {children}
    </div>
  );
}

// ---------- màn chọn đề ----------
export function SetupScreen({ emoji, title, zh, rules, deck, children, onCreate, cta = "Tạo phòng & mã QR →" }) {
  return (
    <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 grid gap-8 lg:grid-cols-[1fr_1.1fr] items-start">
      <section className="text-center lg:text-left pt-4">
        <div className="text-[100px] leading-none select-none" style={{ animation: "bob 1.6s infinite" }}>{emoji}</div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-4">{title}</h1>
        <p className="zh text-xl text-[#5B7262] font-bold mt-1">{zh}</p>
        <ul className="mt-6 space-y-2 text-[17px] text-[#3F5546] text-left inline-block">{rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </section>
      <section className="rounded-[22px] bg-white border border-[#DDE6D3] p-6 flex flex-col gap-5">
        <DeckPicker deck={deck} />
        {deck.vocab && children}
        {deck.vocab && <button onClick={onCreate} className="h-14 rounded-2xl bg-[#2E9D5B] hover:bg-[#1E7A45] text-white text-lg font-extrabold">{cta}</button>}
      </section>
    </main>
  );
}

// ---------- phòng chờ ----------
export function LobbyQR({ qr, code, joinUrl }) {
  return (
    <section className="rounded-[26px] bg-white border border-[#DDE6D3] p-6 text-center mx-auto">
      <div className="font-extrabold text-xl mb-3">📱 Quét mã để vào phòng</div>
      {qr ? <img src={qr} alt={`Mã QR vào phòng ${code}`} className="w-[280px] h-[280px] md:w-[340px] md:h-[340px] mx-auto" /> : <div className="w-[280px] h-[280px] bg-[#F1F5EC] rounded-xl" />}
      <div className="mt-3 text-[#5B7262] font-semibold">hoặc vào <b className="text-[#13261C]">{joinUrl.replace(/^https?:\/\//, "")}</b> và nhập mã</div>
      <div className="text-6xl font-extrabold tracking-[0.18em] mt-2">{code}</div>
    </section>
  );
}

export function QrModal({ qr, code, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl p-6 text-center">
        {qr && <img src={qr} alt="Mã QR vào phòng" className="w-[320px] h-[320px]" />}
        <div className="text-5xl font-extrabold tracking-[0.18em] mt-2">{code}</div>
        <div className="text-sm text-[#5B7262] mt-2">Bấm ra ngoài để đóng</div>
      </div>
    </div>
  );
}

export function Podium({ list, valueOf, unit = "điểm" }) {
  return (
    <div className="flex justify-center items-end gap-4 mt-8">
      {[1, 0, 2].map((i) => list[i] && (
        <div key={list[i].id} className="flex flex-col items-center">
          <div className="text-4xl">{["🥇", "🥈", "🥉"][i]}</div>
          <div className="font-extrabold text-xl mt-1 max-w-[140px] truncate">{list[i].name}</div>
          <div className="text-[#5B7262] font-bold">{valueOf(list[i])} {unit}</div>
          <div className={`w-28 mt-2 rounded-t-2xl ${i === 0 ? "h-40 bg-[#F2C46B]" : i === 1 ? "h-28 bg-[#C9D6BE]" : "h-20 bg-[#E8B48A]"}`} />
        </div>
      ))}
    </div>
  );
}

// ---------- Kéo co / Đua: theo dõi câu học sinh vừa trả lời ----------
// Mỗi học sinh có câu riêng trên điện thoại; máy HS ghi players/{pid}.last = { w, ask, big, ok, at }.
export function useAnswerFeed(players, active) {
  const S = useRef({ seen: {}, feed: [], miss: {}, tot: {} });
  const [, bump] = useState(0);
  const reset = () => { S.current = { seen: {}, feed: [], miss: {}, tot: {} }; bump((x) => x + 1); };
  useEffect(() => {
    const s = S.current;
    let changed = false;
    players.forEach((p) => {
      const l = p.last;
      if (!l || !l.at || s.seen[p.id] === l.at) return;
      s.seen[p.id] = l.at;
      if (!active) return;
      changed = true;
      s.feed = [{ id: p.id + l.at, name: p.name, team: p.team, ...l }, ...s.feed].slice(0, 14);
      const k = l.w[0];
      s.tot[k] = (s.tot[k] || 0) + 1;
      if (!l.ok) s.miss[k] = { w: l.w, n: ((s.miss[k] && s.miss[k].n) || 0) + 1 };
    });
    if (changed) bump((x) => x + 1);
  }, [players, active]);
  // gọi sau khi đã xoá players.last (resetPlayers) — bỏ lịch sử trận trước
  const start = () => reset();
  const missed = Object.values(S.current.miss).map((m) => ({ ...m, tot: S.current.tot[m.w[0]] || m.n })).sort((a, b) => b.n - a.n);
  return { feed: S.current.feed, missed, start };
}

export function LiveFeed({ feed, color }) {
  const latest = feed[0];
  return (
    <aside className="rounded-[22px] bg-white border border-[#DDE6D3] p-4 self-start">
      <div className="font-extrabold text-lg mb-3">📋 Câu đang trả lời</div>
      {!latest && <div className="text-[#5B7262] text-sm">Chưa có câu trả lời nào…</div>}
      {latest && (
        <div key={latest.id} className="rounded-2xl bg-[#F6F9F2] border border-[#DDE6D3] p-4 mb-3" style={{ animation: "pop .25s" }}>
          <div className="text-sm font-bold text-[#5B7262]">{latest.name} · {latest.ask}</div>
          <div className="zh text-5xl font-extrabold my-1">{latest.w[0]}</div>
          <div className="font-bold">{latest.w[1]}{latest.w[2] ? ` · ${latest.w[2]}` : ""}</div>
          <div className={`mt-2 inline-block px-3 py-1 rounded-lg text-sm font-extrabold ${latest.ok ? "bg-[#E7F5EC] text-[#1E5C38]" : "bg-[#FDE8E8] text-[#8A1C1C]"}`}>{latest.ok ? "✅ Đúng" : "❌ Sai"}</div>
        </div>
      )}
      <ol className="flex flex-col gap-1 max-h-[46vh] overflow-auto">
        {feed.slice(1).map((f) => (
          <li key={f.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#F6F9F2] text-sm">
            <span>{f.ok ? "✅" : "❌"}</span>
            <span className="zh font-extrabold text-lg">{f.w[0]}</span>
            <span className="text-[#5B7262] truncate flex-1">{f.w[2] || f.w[1]}</span>
            <span className="font-bold truncate max-w-[90px]" style={color ? { color: color(f) } : {}}>{f.name}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function MissedWords({ missed }) {
  if (!missed.length) return <div className="mt-6 text-[#5B7262] font-semibold">🎉 Không có từ nào bị trả lời sai!</div>;
  return (
    <div className="mt-8 rounded-[22px] bg-white border border-[#DDE6D3] p-5 text-left max-w-[900px] mx-auto">
      <div className="font-extrabold text-xl mb-3">📌 Từ cả lớp hay sai — nên ôn lại</div>
      <div className="grid sm:grid-cols-2 gap-2">
        {missed.slice(0, 12).map((m) => (
          <div key={m.w[0]} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-[#FDF3F3]">
            <span className="zh text-2xl font-extrabold">{m.w[0]}</span>
            <span className="flex-1 text-sm"><b>{m.w[1]}</b>{m.w[2] ? ` · ${m.w[2]}` : ""}</span>
            <span className="text-sm font-extrabold text-[#C0392B] tabular-nums">sai {m.n}/{m.tot}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- cuối trận: tự lưu kết quả + tạo bài ôn từ sai ----------
export function ResultSaver({ game, cfg, players, metric, missed = [] }) {
  const [st, setSt] = useState("saving"); // saving | saved | fail
  const [mk, setMk] = useState({ s: "idle", msg: "" });
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return; once.current = true;
    saveGameResult({ game, cfg: cfg || {}, players: players || [], metric, missed }).then((id) => setSt(id ? "saved" : "fail"));
  }, []); // eslint-disable-line
  async function makeTest() {
    setMk({ s: "busy", msg: "" });
    try { const r = await missedToTest({ game, cfg: cfg || {}, missed }); setMk({ s: "done", msg: `Đã tạo “${r.testName}” trong kho Kiểm tra bài cũ.` }); }
    catch (e) { setMk({ s: "err", msg: "Không tạo được bài: " + (e.message || e) }); }
  }
  const linked = (players || []).filter((p) => p.sid).length;
  return (
    <div className="mt-6 flex flex-col items-center gap-2 text-sm">
      <div className={`px-4 py-2 rounded-xl font-bold ${st === "saved" ? "bg-[#E7F5EC] text-[#1E5C38]" : st === "fail" ? "bg-[#FDE8E8] text-[#8A1C1C]" : "bg-[#F6F9F2] text-[#5B7262]"}`}>
        {st === "saving" ? "Đang lưu kết quả…" : st === "fail" ? "⚠️ Không lưu được kết quả (kiểm tra quyền Firestore “game_results”)."
          : cfg && cfg.classId ? `✔ Đã lưu kết quả vào lớp ${cfg.className} · ${linked}/${(players || []).length} bạn khớp hồ sơ` : "✔ Đã lưu kết quả trận (chưa gắn lớp)"}
      </div>
      {missed.length > 0 && (mk.s === "done" ? <div className="px-4 py-2 rounded-xl bg-[#FFF4DE] text-[#8A5A00] font-bold">{mk.msg}</div> : (
        <button onClick={makeTest} disabled={mk.s === "busy"} className="h-11 px-5 rounded-xl border-2 border-[#F2C46B] bg-[#FFF4DE] font-extrabold disabled:opacity-50">
          {mk.s === "busy" ? "Đang tạo…" : `📝 Tạo bài Kiểm tra bài cũ từ ${Math.min(30, missed.length)} từ hay sai`}
        </button>
      ))}
      {mk.s === "err" && <div className="text-[#8A1C1C] font-semibold">{mk.msg}</div>}
    </div>
  );
}

export function EndButtons() {
  return (
    <div className="flex gap-3 justify-center mt-8 flex-wrap">
      <button onClick={() => window.location.reload()} className="h-12 px-6 rounded-xl bg-[#2E9D5B] text-white font-extrabold">Tạo phòng mới</button>
      <a href="/?tab=play" className="h-12 px-6 rounded-xl border border-[#C9D6BE] bg-white font-bold grid place-items-center">Về khu Chơi</a>
    </div>
  );
}

// hiển thị 1 câu hỏi công khai (màn hình lớn)
export function BigQuestion({ q, reveal, counts }) {
  if (!q) return null;
  return (
    <>
      <div className="text-lg font-bold text-[#5B7262]">{q.ask}</div>
      <QBig q={q} host auto className="my-2" />
      <div className="grid grid-cols-2 gap-3 mt-4">
        {q.opts.map((o, i) => {
          const isAns = reveal && reveal.ans === i;
          const dim = reveal && !isAns;
          return (
            <div key={i} className={`relative rounded-2xl border-2 px-4 py-3 flex items-center gap-3 transition ${isAns ? "bg-[#2E9D5B] border-[#1E7A45] text-white" : OPT_COLORS[i]} ${dim ? "opacity-45" : ""}`}>
              <b className="text-lg">{"ABCD"[i]}</b>
              <span className={`font-bold ${q.optKind === "hz" ? "zh text-3xl" : q.optKind === "def" ? "zh text-base" : "text-xl"}`}>{o}</span>
              {counts && <span className="ml-auto text-lg font-extrabold tabular-nums">{counts[i] || 0} 👤</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
