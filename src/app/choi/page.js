"use client";
// ============================================================
// TRÒ CHƠI CẢ LỚP — MÁY HỌC SINH
// Vào bằng QR: /choi?r=MÃ_PHÒNG → nhập tên → chơi theo trò giáo viên đã mở:
//   tug  (Kéo co)       : tự trả lời liên tục, đúng thì kéo dây cho đội mình
//   race (Đua về đích)  : tự trả lời liên tục, đúng tiến 1 bước
//   quiz (Ai nhanh nhất): cả lớp cùng 1 câu, trả lời càng nhanh càng nhiều điểm
//   bomb (Bom nổ chậm)  : cả lớp cùng thấy câu; người cầm bom trả lời để chuyền bom
// Nếu giáo viên gắn lớp khi tạo phòng, học sinh chọn tên mình trong danh sách lớp
// (players/{pid}.sid = id học sinh) để kết quả vào đúng hồ sơ.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { db } from "../../firebase";
import { doc, setDoc, getDoc, onSnapshot, collection, addDoc, updateDoc, increment, serverTimestamp } from "firebase/firestore";
import { ROOMS, newPid, buildPool, makeQuestion, publicQuestion, loadVocab } from "../bom/game";
import { FONT_CSS } from "./shared";
import QBig from "../bom/QBig";

const OPT = ["bg-[#2E9D5B]", "bg-[#E8A20C]", "bg-[#3B6FD8]", "bg-[#D2457F]"];
const GAME = { tug: ["🪢", "Kéo co"], race: ["🏁", "Đua về đích"], quiz: ["⚡", "Ai nhanh nhất"], bomb: ["💣", "Bom nổ chậm"] };
const TEAM = { red: { n: "Đội Đỏ", c: "#D64545", bg: "#FDE8E8" }, blue: { n: "Đội Xanh", c: "#2F6FD6", bg: "#E8F0FF" } };
const LOCK_MS = 2000;

export default function ClassPlayer() {
  const [code, setCode] = useState("");
  const [codeIn, setCodeIn] = useState("");
  const [name, setName] = useState("");
  const [pid, setPid] = useState("");
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [sid, setSid] = useState("");         // id học sinh trong lớp (nếu phòng gắn lớp)
  const [preview, setPreview] = useState(null); // dữ liệu phòng xem trước khi vào (để lấy danh sách lớp)
  const [other, setOther] = useState(false);  // chọn "tên khác" thay vì danh sách lớp
  const unsub = useRef([]);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("r") || "";
    setCode(r.replace(/\D/g, "").slice(0, 6)); setCodeIn(r);
    try {
      const sn = localStorage.getItem("hskg_bomb_name") || ""; setName((x) => x || sn);
      setSid(localStorage.getItem("hskg_class_sid") || "");
      let p = localStorage.getItem("hskg_bomb_pid");
      if (!p) { p = newPid(); localStorage.setItem("hskg_bomb_pid", p); }
      setPid(p);
      if (r && localStorage.getItem("hskg_class_room") === r) setJoined("auto");
    } catch (e) { setPid(newPid()); }
    return () => unsub.current.forEach((u) => u && u());
  }, []);
  useEffect(() => { if (joined === "auto" && pid && code && name) join(); }, [joined, pid, code, name]); // eslint-disable-line

  // nhập đủ 6 số → xem trước phòng để hiện danh sách lớp
  const typed = (code || codeIn).replace(/\D/g, "");
  useEffect(() => {
    if (typed.length !== 6 || joined === true) { setPreview(null); return; }
    let live = true;
    getDoc(doc(db, ROOMS, typed)).then((s) => { if (live) setPreview(s.exists() ? s.data() : false); }).catch(() => live && setPreview(null));
    return () => { live = false; };
  }, [typed, joined]);
  const roster = preview && preview.cfg && Array.isArray(preview.cfg.roster) && preview.cfg.roster.length ? preview.cfg.roster : null;

  async function join(e) {
    e && e.preventDefault();
    setErr("");
    const c = (code || codeIn).replace(/\D/g, "");
    const n = name.trim().slice(0, 20);
    if (c.length !== 6) { setErr("Mã phòng gồm 6 chữ số."); return; }
    if (!n) { setErr("Hãy nhập tên của bạn."); return; }
    setBusy(true);
    try {
      const s = await getDoc(doc(db, ROOMS, c));
      if (!s.exists()) { setErr("Không tìm thấy phòng " + c + ". Kiểm tra lại mã nhé."); setBusy(false); setJoined(false); return; }
      const d = s.data();
      if (d.status === "end") { setErr("Phòng này đã kết thúc."); setBusy(false); setJoined(false); return; }
      const rs = d.cfg && Array.isArray(d.cfg.roster) ? d.cfg.roster : [];
      const st = rs.find((x) => x.id === sid && x.name === n) || rs.find((x) => x.name === n);
      const mySid = st ? st.id : null;
      const pRef = doc(db, ROOMS, c, "players", pid);
      const ps = await getDoc(pRef);
      if (ps.exists()) await setDoc(pRef, { name: n, sid: mySid }, { merge: true });
      else await setDoc(pRef, { name: n, sid: mySid, score: 0, correct: 0, wrong: 0, pos: 0, booms: 0, joinedAt: serverTimestamp() });
      try { localStorage.setItem("hskg_bomb_name", n); localStorage.setItem("hskg_class_room", c); localStorage.setItem("hskg_class_sid", mySid || ""); } catch (e) {}
      setCode(c); setName(n);
      unsub.current.forEach((u) => u && u());
      unsub.current = [
        onSnapshot(doc(db, ROOMS, c), (x) => setRoom(x.data() || null)),
        onSnapshot(pRef, (x) => setMe(x.exists() ? x.data() : "kicked")),
      ];
      setJoined(true);
    } catch (e2) {
      setErr("Không vào được phòng (" + (e2.code || e2.message) + ").");
      setJoined(false);
    }
    setBusy(false);
  }

  const g = GAME[room?.game] || ["🎮", "Trò chơi cả lớp"];
  const team = me && me !== "kicked" && room?.game === "tug" ? TEAM[me.team] : null;

  const shell = (children, bg = "bg-[#F4F7EF]") => (
    <div className={`cg min-h-[100dvh] ${bg} text-[#13261C] flex flex-col`}>
      <style>{FONT_CSS}</style>
      <header className="h-14 px-4 flex items-center gap-2 border-b border-black/5 bg-white/70">
        <span className="font-extrabold">{g[0]} {g[1]}</span>
        {joined === true && me && me !== "kicked" && <span className="ml-auto text-sm font-bold truncate">{name} · <b className="tabular-nums">{room?.game === "race" ? `${me.pos || 0} bước` : `${me.score || 0} điểm`}</b></span>}
      </header>
      {team && <div className="text-center text-white font-extrabold py-1.5" style={{ background: team.c }}>Bạn ở {team.n}</div>}
      {err && joined === true && <div className="mx-4 mt-3 p-3 rounded-xl bg-[#FDE8E8] text-[#8A1C1C] font-semibold">{err}</div>}
      <main className="flex-1 flex flex-col px-4 py-5 max-w-[560px] w-full mx-auto">{children}</main>
    </div>
  );

  if (joined !== true) {
    return shell(
      <form onSubmit={join} className="flex flex-col gap-4 mt-6">
        <div className="text-7xl text-center" style={{ animation: "bob 1.4s infinite" }}>🎮</div>
        <h1 className="text-3xl font-extrabold text-center">Vào phòng chơi</h1>
        <label className="font-bold text-sm">Mã phòng
          <input inputMode="numeric" value={code || codeIn} onChange={(e) => { setCode(""); setCodeIn(e.target.value.replace(/\D/g, "").slice(0, 6)); }}
            className="mt-1 w-full h-14 rounded-2xl border-2 border-[#C9D6BE] px-4 text-2xl font-extrabold tracking-[0.2em] text-center bg-white" placeholder="000000" />
        </label>
        {preview === false && <div className="p-3 rounded-xl bg-[#FFF4DE] text-[#8A5A00] font-semibold text-sm">Chưa thấy phòng {typed} — kiểm tra lại mã nhé.</div>}
        {roster && !other ? (
          <div>
            <div className="font-bold text-sm">Chọn tên của bạn <span className="text-[#5B7262] font-semibold">· lớp {preview.cfg.className}</span></div>
            <div className="mt-2 grid grid-cols-2 gap-2 max-h-[46vh] overflow-auto">
              {roster.map((st) => (
                <button type="button" key={st.id} onClick={() => { setName(st.name); setSid(st.id); }}
                  className={`min-h-[52px] px-3 rounded-2xl border-2 font-bold text-left ${sid === st.id && name === st.name ? "bg-[#2E9D5B] border-[#2E9D5B] text-white" : "bg-white border-[#C9D6BE]"}`}>{st.name}</button>
              ))}
            </div>
            <button type="button" onClick={() => { setOther(true); setSid(""); setName(""); }} className="mt-2 text-sm font-bold text-[#1E7A45] underline">Không thấy tên mình? Nhập tên khác</button>
          </div>
        ) : (
          <label className="font-bold text-sm">Tên của bạn
            <input value={name} onChange={(e) => { setName(e.target.value); setSid(""); }} maxLength={20} autoFocus
              className="mt-1 w-full h-14 rounded-2xl border-2 border-[#C9D6BE] px-4 text-xl font-bold bg-white" placeholder="VD: Minh Anh" />
          </label>
        )}
        {err && <div className="p-3 rounded-xl bg-[#FDE8E8] text-[#8A1C1C] font-semibold">{err}</div>}
        <button disabled={busy} className="h-14 rounded-2xl bg-[#2E9D5B] text-white text-lg font-extrabold disabled:opacity-50">{busy ? "Đang vào…" : "Vào phòng →"}</button>
      </form>
    );
  }
  if (me === "kicked") return shell(<div className="m-auto text-center"><div className="text-5xl">🚪</div><div className="text-xl font-bold mt-3">Bạn đã được mời ra khỏi phòng.</div><button onClick={() => { setJoined(false); setMe(null); }} className="mt-4 h-12 px-6 rounded-xl bg-[#2E9D5B] text-white font-bold">Vào lại</button></div>);
  if (!room || !me) return shell(<div className="m-auto text-[#5B7262]">Đang kết nối…</div>);

  if (room.status === "lobby") {
    return shell(
      <div className="m-auto text-center">
        <div className="text-6xl" style={{ animation: "bob 1.4s infinite" }}>{g[0]}</div>
        <div className="text-2xl font-extrabold mt-4">Chào {name}!</div>
        {team && <div className="mt-3 inline-block px-5 py-2 rounded-full text-white font-extrabold text-xl" style={{ background: team.c }}>Bạn ở {team.n}</div>}
        <div className="text-[#5B7262] font-semibold mt-3">Đã vào phòng {code}. Nhìn lên màn hình — chờ cô/thầy bắt đầu…</div>
        <div className="mt-5 text-sm text-[#5B7262]">{room.cfg?.level} · {room.cfg?.lessons} · {room.cfg?.mode}</div>
      </div>
    );
  }

  if (room.game === "quiz") return <QuizPlay room={room} me={me} pid={pid} code={code} shell={shell} />;
  if (room.game === "bomb") return <BombPlay room={room} me={me} pid={pid} code={code} shell={shell} />;
  return <SoloPlay room={room} me={me} pid={pid} code={code} shell={shell} team={team} />;
}

// ============================================================
// Kéo co & Đua: mỗi máy tự sinh câu hỏi, tự chấm, ghi điểm lên phòng
// ============================================================
function SoloPlay({ room, me, pid, code, shell, team }) {
  const [pool, setPool] = useState(null);
  const [q, setQ] = useState(null);
  const [lockUntil, setLockUntil] = useState(0);
  const [fb, setFb] = useState(null); // {ok, word, at}
  const [now, setNow] = useState(Date.now());
  const used = useRef(new Set());
  const race = room.game === "race";
  const target = room.target || room.cfg?.target || 15;
  const finished = race && (me.pos || 0) >= target;

  useEffect(() => {
    loadVocab().then((v) => {
      const lvl = v[room.cfg?.lv ?? 0];
      setPool(buildPool(lvl, room.cfg?.les || [0]));
    }).catch(() => setPool([]));
  }, [room.cfg?.lv, JSON.stringify(room.cfg?.les)]); // eslint-disable-line

  const fresh = (p = pool) => {
    if (!p || p.length < 4) return;
    if (used.current.size > p.length - 4) used.current = new Set();
    const x = makeQuestion(p, room.cfg?.modeKey || "mix", used.current);
    used.current.add(x.word[0]);
    setQ({ ...publicQuestion(x), ans: x.ans, word: x.word });
  };
  useEffect(() => { if (pool && !q) fresh(pool); }, [pool]); // eslint-disable-line
  useEffect(() => { if (lockUntil <= Date.now()) return; const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, [lockUntil]);

  const locked = lockUntil > now;
  async function answer(i) {
    if (!q || locked || room.status !== "play" || finished) return;
    const ok = i === q.ans;
    setFb({ ok, word: q.word, at: Date.now(), pick: i, ans: q.ans });
    const ref = doc(db, ROOMS, code, "players", pid);
    // câu vừa trả lời — để màn hình giáo viên hiện trực tiếp
    const last = { w: [q.word[0] || "", q.word[1] || "", q.word[2] || ""], ask: q.ask || "", big: q.big || "", ok, at: Date.now() };
    if (ok) {
      try { navigator.vibrate && navigator.vibrate(40); } catch (e) {}
      updateDoc(ref, race ? { pos: increment(1), correct: increment(1), score: increment(10), last } : { correct: increment(1), score: increment(10), last }).catch(() => {});
      fresh();
    } else {
      try { navigator.vibrate && navigator.vibrate([80, 40, 80]); } catch (e) {}
      const upd = { wrong: increment(1), last };
      if (race && room.cfg?.back !== false && (me.pos || 0) > 0) upd.pos = increment(-1);
      updateDoc(ref, upd).catch(() => {});
      const u = Date.now() + LOCK_MS; setLockUntil(u); setNow(Date.now());
      setTimeout(() => fresh(), LOCK_MS);
    }
  }

  if (room.status === "end") {
    const win = room.game === "tug" ? room.winner : null;
    const rk = race ? (room.finish || []).indexOf(pid) : -1;
    return shell(
      <div className="m-auto text-center">
        <div className="text-6xl">{race ? (rk >= 0 ? ["🥇", "🥈", "🥉"][rk] || "🏁" : "🏁") : win === "draw" ? "🤝" : win === me.team ? "🏆" : "💪"}</div>
        <div className="text-2xl font-extrabold mt-3">
          {race ? (rk >= 0 ? `Bạn về đích thứ ${rk + 1}!` : "Cuộc đua kết thúc!") : win === "draw" ? "Hoà!" : win === me.team ? "Đội bạn thắng!" : "Đội bạn thua rồi — lần sau nhé!"}
        </div>
        <div className="mt-4 text-[#5B7262] font-semibold">✅ {me.correct || 0} câu đúng · ❌ {me.wrong || 0} câu sai</div>
        <div className="mt-4 text-sm text-[#5B7262]">Xem kết quả trên màn hình lớn nhé!</div>
      </div>
    );
  }

  if (finished) {
    const rk = (room.finish || []).indexOf(pid);
    return shell(
      <div className="m-auto text-center" style={{ animation: "pop .4s" }}>
        <div className="text-7xl">{["🥇", "🥈", "🥉"][rk] || "🏁"}</div>
        <div className="text-3xl font-extrabold mt-3">Về đích!</div>
        <div className="mt-2 text-[#5B7262] font-semibold">{rk >= 0 ? `Hạng ${rk + 1}` : "Đang xếp hạng…"} · ✅ {me.correct || 0} đúng</div>
        <div className="mt-4 text-sm text-[#5B7262]">Chờ các bạn khác về đích…</div>
      </div>, "bg-[#FFF8E6]"
    );
  }

  if (!pool) return shell(<div className="m-auto text-[#5B7262]">Đang tải câu hỏi…</div>);

  const showFb = fb && Date.now() - fb.at < 1600;
  return shell(
    <div className="flex-1 flex flex-col">
      {race && (
        <div className="rounded-2xl bg-[#C8915A] p-2 relative h-12">
          <div className="absolute top-0 bottom-0 right-0 w-3 rounded-r-2xl" style={{ background: "repeating-conic-gradient(#111 0 25%, #fff 0 50%) 0 0/10px 10px" }} />
          <div className="absolute top-1/2 -translate-y-1/2 text-3xl transition-all duration-300" style={{ left: `calc(${Math.min(1, (me.pos || 0) / target) * 100}% - ${Math.min(1, (me.pos || 0) / target) * 44}px)`, transform: "translateY(-50%) scaleX(-1)" }}>🏃</div>
          <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white font-extrabold text-sm">{me.pos || 0}/{target}</div>
        </div>
      )}
      {!race && team && <div className="text-center text-sm font-bold text-[#5B7262]">Mỗi câu đúng = kéo dây cho <b style={{ color: team.c }}>{team.n}</b> · bạn đã kéo <b className="tabular-nums">{me.correct || 0}</b> lần</div>}
      {room.status !== "play" && <div className="mt-3 p-3 rounded-xl bg-[#FFF4DE] font-bold text-center">⏸ Chờ cô/thầy…</div>}
      {q && (
        <div className="relative flex-1 flex flex-col">
          <div className="text-center mt-4 font-bold text-[#5B7262]">{q.ask}</div>
          <QBig q={q} auto className="text-center mt-1 mb-4" />
          <div className="grid gap-3 content-start">
            {q.opts.map((o, i) => (
              <button key={q.id + i} disabled={locked || room.status !== "play"} onClick={() => answer(i)}
                className={`${OPT[i]} min-h-[62px] rounded-2xl text-white px-4 py-3 flex items-center gap-3 text-left active:scale-[.97] transition disabled:opacity-50`}>
                <b className="w-8 h-8 rounded-lg bg-white/25 grid place-items-center shrink-0">{"ABCD"[i]}</b>
                <span className={`font-bold ${q.optKind === "hz" ? "zh text-3xl" : q.optKind === "def" ? "zh text-base" : "text-xl"}`}>{o}</span>
              </button>
            ))}
          </div>
          {locked && fb && !fb.ok && (
            <div className="absolute inset-0 rounded-2xl bg-[#8A1C1C]/90 text-white grid place-items-center text-center p-4" style={{ animation: "pop .25s" }}>
              <div>
                <div className="text-5xl">❌</div>
                <div className="text-2xl font-extrabold mt-2">Sai rồi! Chờ {Math.ceil((lockUntil - now) / 1000)}s</div>
                {race && room.cfg?.back !== false && <div className="mt-1 font-bold opacity-90">Lùi 1 bước</div>}
                <div className="mt-3 text-lg"><span className="zh font-bold text-2xl">{fb.word[0]}</span> · {fb.word[1]}{fb.word[2] ? ` · ${fb.word[2]}` : ""}</div>
              </div>
            </div>
          )}
        </div>
      )}
      {showFb && fb.ok && <div key={fb.at} className="fixed left-1/2 -translate-x-1/2 bottom-6 px-5 py-2 rounded-full bg-[#1E7A45] text-white font-extrabold shadow-lg" style={{ animation: "pop .25s" }}>✅ {race ? "+1 bước!" : "Kéo!"}</div>}
    </div>,
    team ? undefined : "bg-[#F4F7EF]"
  );
}

// ============================================================
// Ai nhanh nhất: câu hỏi chung, máy GV chấm & cộng điểm
// ============================================================
function QuizPlay({ room, me, pid, code, shell }) {
  const [sent, setSent] = useState(null);
  const q = room.q;
  // tính thời gian trả lời ngay trên điện thoại (từ lúc câu hiện ra đến lúc bấm) — mạng chậm không bị thiệt
  const shown = useRef({ id: null, t: 0 });
  if (q && shown.current.id !== q.id) shown.current = { id: q.id, t: typeof performance !== "undefined" ? performance.now() : Date.now() };

  async function answer(i) {
    if (!q || room.status !== "q" || sent?.qid === q.id) return;
    setSent({ qid: q.id, choice: i });
    try { navigator.vibrate && navigator.vibrate(30); } catch (e) {}
    try { await addDoc(collection(db, ROOMS, code, "answers"), { pid, qid: q.id, choice: i, at: Date.now(), ms: Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - shown.current.t) }); }
    catch (e) { setSent(null); }
  }

  if (room.status === "end") {
    return shell(
      <div className="m-auto text-center">
        <div className="text-6xl">🏆</div>
        <div className="text-2xl font-extrabold mt-3">Kết thúc!</div>
        <div className="text-5xl font-extrabold mt-4 tabular-nums">{me.score || 0}<span className="text-xl"> điểm</span></div>
        <div className="mt-3 text-[#5B7262] font-semibold">✅ {me.correct || 0} đúng · ❌ {me.wrong || 0} sai</div>
        <div className="mt-4 text-sm text-[#5B7262]">Xem bảng vàng trên màn hình lớn nhé!</div>
      </div>
    );
  }

  if (room.status === "reveal") {
    const l = me.last && me.last.qid === q?.id ? me.last : null;
    const ok = l?.ok;
    return shell(
      <div className="m-auto text-center text-white" style={{ animation: "pop .35s" }}>
        <div className="text-7xl">{ok ? "✅" : l?.answered ? "❌" : "⌛"}</div>
        <div className="text-3xl font-extrabold mt-3">{ok ? `+${l.pts} điểm` : l?.answered ? "Sai rồi!" : "Hết giờ!"}</div>
        {(me.streak || 0) >= 3 && <div className="mt-2 font-bold">🔥 Chuỗi {me.streak} câu đúng</div>}
        {room.reveal?.word && <div className="mt-4 text-lg opacity-95">Đáp án: <span className="zh font-bold text-2xl">{q?.opts?.[room.reveal.ans]}</span></div>}
        {room.reveal?.word && <div className="mt-1 opacity-90"><span className="zh">{room.reveal.word[0]}</span> · {room.reveal.word[1]}{room.reveal.word[2] ? ` · ${room.reveal.word[2]}` : ""}</div>}
        <div className="mt-5 text-sm opacity-80">Tổng: {me.score || 0} điểm</div>
      </div>,
      ok ? "bg-[#1E7A45]" : "bg-[#8A1C1C]"
    );
  }

  if (!q) return shell(<div className="m-auto text-[#5B7262]">Chuẩn bị câu hỏi…</div>);
  const waiting = sent && sent.qid === q.id;
  return shell(
    <div className="flex-1 flex flex-col">
      <div className="text-center text-sm font-bold text-[#5B7262]">Câu {room.idx}/{room.nq}</div>
      <div className="text-center mt-3 font-bold text-[#5B7262]">{q.ask}</div>
      <QBig q={q} className="text-center mt-1 mb-5" />
      <div className="grid gap-3 content-start">
        {q.opts.map((o, i) => (
          <button key={q.id + i} disabled={waiting} onClick={() => answer(i)}
            className={`${OPT[i]} min-h-[64px] rounded-2xl text-white px-4 py-3 flex items-center gap-3 text-left active:scale-[.97] transition ${waiting ? (sent.choice === i ? "ring-4 ring-black/30" : "opacity-40") : ""}`}>
            <b className="w-8 h-8 rounded-lg bg-white/25 grid place-items-center shrink-0">{"ABCD"[i]}</b>
            <span className={`font-bold ${q.optKind === "hz" ? "zh text-3xl" : q.optKind === "def" ? "zh text-base" : "text-xl"}`}>{o}</span>
          </button>
        ))}
      </div>
      {waiting && <div className="text-center mt-4 text-[#5B7262] font-bold">Đã gửi! Chờ hết giờ để xem kết quả…</div>}
    </div>
  );
}

// ============================================================
// Bom nổ chậm: cả lớp cùng thấy câu hỏi
//   cầm bom → trả lời đúng để chuyền bom (+10) · không cầm bom → trả lời phụ (+5)
// ============================================================
function BombPlay({ room, me, pid, code, shell }) {
  const [sent, setSent] = useState(null); // {qid, choice}
  const [sendErr, setSendErr] = useState("");
  const lastHolder = useRef(false);
  const isHolder = room.status === "play" && room.holder === pid;
  const q = room.q;

  // rung khi bom rơi vào tay mình / nổ trong tay mình
  useEffect(() => {
    if (isHolder && !lastHolder.current) { try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) {} }
    if (room.status === "boom" && room.last?.pid === pid) { try { navigator.vibrate && navigator.vibrate(600); } catch (e) {} }
    lastHolder.current = isHolder;
  }, [isHolder, room.status]); // eslint-disable-line

  async function answer(i) {
    if (!q || sent?.qid === q.id || room.paused) return;
    setSent({ qid: q.id, choice: i }); setSendErr("");
    try { await addDoc(collection(db, ROOMS, code, "answers"), { pid, qid: q.id, choice: i, at: Date.now() }); }
    catch (e) { setSendErr("Gửi đáp án lỗi — thử lại."); setSent(null); }
  }

  if (room.status === "end") {
    return shell(
      <div className="m-auto text-center">
        <div className="text-6xl">🏆</div>
        <div className="text-2xl font-extrabold mt-3">Trò chơi kết thúc!</div>
        <div className="text-5xl font-extrabold mt-4 tabular-nums">{me.score || 0}<span className="text-xl"> điểm</span></div>
        <div className="mt-3 text-[#5B7262] font-semibold">✅ {me.correct || 0} đúng · ❌ {me.wrong || 0} sai · 💥 {me.booms || 0} lần nổ</div>
        <div className="mt-4 text-sm text-[#5B7262]">Xem bảng vàng trên màn hình lớn nhé!</div>
      </div>
    );
  }

  if (room.status === "boom") {
    const mine = room.last?.pid === pid;
    const lost = room.last?.lost ?? 15;
    return shell(
      <div className="m-auto text-center text-white" style={{ animation: "pop .4s" }}>
        <div className="text-8xl">💥</div>
        <div className="text-4xl font-extrabold mt-2">{mine ? "Bom nổ trong tay bạn!" : "BÙM!"}</div>
        <div className="text-xl mt-3">{mine ? (lost ? `−${lost} điểm 😭` : "May quá, không còn điểm để trừ 😅") : <>Bom nổ ở chỗ <b className="text-[#FFD25A]">{room.last?.name}</b></>}</div>
        {room.last?.word && <div className="mt-4 text-lg opacity-90"><span className="zh font-bold">{room.last.word[0]}</span> · {room.last.word[1]}{room.last.word[2] ? ` · ${room.last.word[2]}` : ""}</div>}
      </div>,
      mine ? "bg-[#B3261E]" : "bg-[#1F2A24]"
    );
  }

  const waiting = q && sent && sent.qid === q.id;
  const side = me.side && q && me.side.qid === q.id ? me.side : null;
  const badMine = isHolder && room.last?.type === "bad" && room.last?.pid === pid;
  const okMine = !isHolder && room.last?.type === "ok" && room.last?.pid === pid;

  return shell(
    <div className="flex-1 flex flex-col">
      {isHolder ? (
        <div className="rounded-2xl bg-[#C0392B] text-white text-center py-3 font-extrabold text-xl" style={{ animation: "shake .4s infinite" }}>💣 BOM Ở TAY BẠN — TRẢ LỜI NHANH!</div>
      ) : (
        <div className="rounded-2xl bg-white border border-[#DDE6D3] text-center py-2.5 px-3">
          <div className="text-xs font-bold text-[#5B7262]">Ván {room.round}/{room.rounds} · bom đang ở chỗ</div>
          <div className="text-2xl font-extrabold text-[#C0392B] break-words">💣 {room.holderName}</div>
          {room.random ? <div className="text-xs font-bold text-[#5B7262] mt-0.5">🎲 Bom chuyền ngẫu nhiên — có thể đến lượt bạn bất cứ lúc nào!</div>
            : room.next === pid ? <div className="text-sm font-extrabold text-[#8A5A00] mt-0.5">⚠️ Bạn là người tiếp theo — chuẩn bị!</div>
            : <div className="text-xs font-bold text-[#5B7262] mt-0.5">Tiếp theo: {room.nextName}</div>}
        </div>
      )}
      {room.paused && <div className="mt-3 p-3 rounded-xl bg-[#FFF4DE] font-bold text-center">⏸ Cô/thầy đang tạm dừng</div>}
      {okMine && <div className="mt-3 p-3 rounded-xl bg-[#E7F5EC] text-[#1E5C38] font-bold text-center" style={{ animation: "pop .3s" }}>✅ Chính xác! +10 · Bạn đã chuyền bom đi 😮‍💨</div>}
      {badMine && <div key={room.last.at} className="mt-3 p-3 rounded-xl bg-[#FDE8E8] text-[#8A1C1C] font-bold text-center" style={{ animation: "pop .3s" }}>❌ Sai rồi! Câu mới — bom vẫn trong tay bạn</div>}
      {q && (
        <>
          {!isHolder && <div className="text-center mt-3 text-xs font-extrabold text-[#1E7A45] uppercase tracking-wider">Trả lời cùng để ghi điểm phụ +5</div>}
          <div className="text-center mt-2 font-bold text-[#5B7262]">{q.ask}</div>
          <QBig q={q} auto={isHolder} className="text-center mt-1 mb-4" />
          <div className="grid gap-3 content-start">
            {q.opts.map((o, i) => (
              <button key={q.id + i} disabled={waiting || room.paused} onClick={() => answer(i)}
                className={`${OPT[i]} ${isHolder ? "min-h-[64px]" : "min-h-[54px]"} rounded-2xl text-white px-4 py-3 flex items-center gap-3 text-left active:scale-[.98] transition disabled:opacity-60 ${waiting && sent.choice === i ? "ring-4 ring-black/30" : ""}`}>
                <b className="w-8 h-8 rounded-lg bg-white/25 grid place-items-center shrink-0">{"ABCD"[i]}</b>
                <span className={`font-bold ${q.optKind === "hz" ? "zh text-3xl" : q.optKind === "def" ? "zh text-base" : "text-xl"}`}>{o}</span>
              </button>
            ))}
          </div>
          {side && <div className={`mt-3 p-3 rounded-xl text-center font-bold ${side.ok ? "bg-[#E7F5EC] text-[#1E5C38]" : "bg-[#FDE8E8] text-[#8A1C1C]"}`} style={{ animation: "pop .3s" }}>{side.ok ? "✅ Đúng! +5 điểm phụ" : "❌ Chưa đúng — chờ câu sau nhé"}</div>}
          {waiting && !side && <div className="text-center mt-3 text-[#5B7262] font-semibold">{isHolder ? "Đang chấm…" : "Đã gửi!"}</div>}
        </>
      )}
      {sendErr && <div className="mt-3 p-3 rounded-xl bg-[#FDE8E8] text-[#8A1C1C] font-semibold">{sendErr}</div>}
    </div>,
    isHolder ? "bg-[#FFF1EC]" : "bg-[#F4F7EF]"
  );
}
