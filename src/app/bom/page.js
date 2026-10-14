"use client";
// ============================================================
// BOM NỔ CHẬM 传炸弹 — MÁY HỌC SINH
// Vào bằng QR: /bom?r=MÃ_PHÒNG → nhập tên → chờ → khi bom ở tay mình thì trả lời.
// ============================================================
import { useEffect, useRef, useState } from "react";
import { db } from "../../firebase";
import { doc, setDoc, getDoc, onSnapshot, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ROOMS, newPid } from "./game";

const OPT = ["bg-[#2E9D5B]", "bg-[#E8A20C]", "bg-[#3B6FD8]", "bg-[#D2457F]"];

export default function BombPlayer() {
  const [code, setCode] = useState("");
  const [codeIn, setCodeIn] = useState("");
  const [name, setName] = useState("");
  const [pid, setPid] = useState("");
  const [joined, setJoined] = useState(false);
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(null); // {qid, choice}
  const [busy, setBusy] = useState(false);
  const unsub = useRef([]);
  const lastHolder = useRef(false);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("r") || "";
    setCode(r.replace(/\D/g, "").slice(0, 6)); setCodeIn(r);
    try {
      const sn = localStorage.getItem("hskg_bomb_name") || ""; setName((x) => x || sn);
      let p = localStorage.getItem("hskg_bomb_pid");
      if (!p) { p = newPid(); localStorage.setItem("hskg_bomb_pid", p); }
      setPid(p);
      if (r && localStorage.getItem("hskg_bomb_room") === r) setJoined("auto");
    } catch (e) { setPid(newPid()); }
    return () => unsub.current.forEach((u) => u && u());
  }, []);

  // vào lại tự động nếu lỡ tải lại trang
  useEffect(() => { if (joined === "auto" && pid && code && name) join(); }, [joined, pid, code, name]); // eslint-disable-line

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
      if (s.data().status === "end") { setErr("Phòng này đã kết thúc."); setBusy(false); setJoined(false); return; }
      const pRef = doc(db, ROOMS, c, "players", pid);
      const ps = await getDoc(pRef);
      if (ps.exists()) await setDoc(pRef, { name: n }, { merge: true });
      else await setDoc(pRef, { name: n, score: 0, booms: 0, correct: 0, wrong: 0, joinedAt: serverTimestamp() });
      try { localStorage.setItem("hskg_bomb_name", n); localStorage.setItem("hskg_bomb_room", c); } catch (e) {}
      setCode(c); setName(n);
      unsub.current.forEach((u) => u && u());
      unsub.current = [
        onSnapshot(doc(db, ROOMS, c), (d) => setRoom(d.data() || null)),
        onSnapshot(pRef, (d) => setMe(d.exists() ? d.data() : "kicked")),
      ];
      setJoined(true);
    } catch (e) {
      setErr("Không vào được phòng (" + (e.code || e.message) + ").");
      setJoined(false);
    }
    setBusy(false);
  }

  const isHolder = room && room.status === "play" && room.holder === pid;
  const q = room?.q;

  // rung khi bom rơi vào tay mình
  useEffect(() => {
    if (isHolder && !lastHolder.current) { try { navigator.vibrate && navigator.vibrate([120, 60, 120]); } catch (e) {} }
    if (room?.status === "boom" && room?.last?.pid === pid) { try { navigator.vibrate && navigator.vibrate(600); } catch (e) {} }
    lastHolder.current = isHolder;
  }, [isHolder, room?.status]); // eslint-disable-line

  async function answer(i) {
    if (!q || sent?.qid === q.id || room?.paused) return;
    setSent({ qid: q.id, choice: i });
    try { await addDoc(collection(db, ROOMS, code, "answers"), { pid, qid: q.id, choice: i, at: Date.now() }); }
    catch (e) { setErr("Gửi đáp án lỗi — thử lại."); setSent(null); }
  }

  const shell = (children, tone = "bg-[#F4F7EF]") => (
    <div className={`bomb-p min-h-[100dvh] ${tone} text-[#13261C] flex flex-col`}>
      <style>{`@import url("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@500;700;800;900&family=Noto+Sans+SC:wght@500;700;900&display=swap");
.bomb-p{font-family:"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif}.bomb-p .zh{font-family:"Noto Sans SC","Be Vietnam Pro",sans-serif}
@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}}
@keyframes pop{0%{transform:scale(.6);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
      <header className="h-14 px-4 flex items-center gap-2 border-b border-black/5 bg-white/70">
        <span className="font-extrabold">💣 Bom nổ chậm</span>
        {joined === true && <span className="ml-auto text-sm font-bold">{name} · <b className="tabular-nums">{me?.score ?? 0}</b> điểm</span>}
      </header>
      <main className="flex-1 flex flex-col px-4 py-5 max-w-[560px] w-full mx-auto">{children}</main>
    </div>
  );

  // ---------- 1. NHẬP TÊN ----------
  if (joined !== true) {
    return shell(
      <form onSubmit={join} className="flex flex-col gap-4 mt-6">
        <div className="text-7xl text-center" style={{ animation: "shake 1.2s infinite" }}>💣</div>
        <h1 className="text-3xl font-extrabold text-center">Vào phòng chơi</h1>
        <label className="font-bold text-sm">Mã phòng
          <input inputMode="numeric" value={code || codeIn} onChange={(e) => { setCode(""); setCodeIn(e.target.value.replace(/\D/g, "").slice(0, 6)); }}
            className="mt-1 w-full h-14 rounded-2xl border-2 border-[#C9D6BE] px-4 text-2xl font-extrabold tracking-[0.2em] text-center bg-white" placeholder="000000" />
        </label>
        <label className="font-bold text-sm">Tên của bạn
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} autoFocus
            className="mt-1 w-full h-14 rounded-2xl border-2 border-[#C9D6BE] px-4 text-xl font-bold bg-white" placeholder="VD: Minh Anh" />
        </label>
        {err && <div className="p-3 rounded-xl bg-[#FDE8E8] text-[#8A1C1C] font-semibold">{err}</div>}
        <button disabled={busy} className="h-14 rounded-2xl bg-[#2E9D5B] text-white text-lg font-extrabold disabled:opacity-50">{busy ? "Đang vào…" : "Vào phòng →"}</button>
      </form>
    );
  }

  if (me === "kicked") return shell(<div className="m-auto text-center"><div className="text-5xl">🚪</div><div className="text-xl font-bold mt-3">Bạn đã được mời ra khỏi phòng.</div><button onClick={() => { setJoined(false); setMe(null); }} className="mt-4 h-12 px-6 rounded-xl bg-[#2E9D5B] text-white font-bold">Vào lại</button></div>);
  if (!room) return shell(<div className="m-auto text-[#5B7262]">Đang kết nối…</div>);

  // ---------- 2. CHỜ ----------
  if (room.status === "lobby") {
    return shell(
      <div className="m-auto text-center">
        <div className="text-6xl" style={{ animation: "shake 1.4s infinite" }}>💣</div>
        <div className="text-2xl font-extrabold mt-4">Chào {name}!</div>
        <div className="text-[#5B7262] font-semibold mt-2">Đã vào phòng {code}. Nhìn lên màn hình — chờ cô/thầy châm ngòi…</div>
        <div className="mt-5 text-sm text-[#5B7262]">{room.cfg?.level} · {room.cfg?.lessons} · {room.cfg?.mode}</div>
      </div>
    );
  }

  // ---------- 5. KẾT THÚC ----------
  if (room.status === "end") {
    return shell(
      <div className="m-auto text-center">
        <div className="text-6xl">🏆</div>
        <div className="text-2xl font-extrabold mt-3">Trò chơi kết thúc!</div>
        <div className="text-5xl font-extrabold mt-4 tabular-nums">{me?.score ?? 0}<span className="text-xl"> điểm</span></div>
        <div className="mt-3 text-[#5B7262] font-semibold">✅ {me?.correct || 0} đúng · ❌ {me?.wrong || 0} sai · 💥 {me?.booms || 0} lần nổ</div>
        <div className="mt-4 text-sm text-[#5B7262]">Xem bảng vàng trên màn hình lớn nhé!</div>
      </div>
    );
  }

  // ---------- 4. NỔ ----------
  if (room.status === "boom") {
    const mine = room.last?.pid === pid;
    return shell(
      <div className="m-auto text-center text-white" style={{ animation: "pop .4s" }}>
        <div className="text-8xl">💥</div>
        <div className="text-4xl font-extrabold mt-2">{mine ? "Bom nổ trong tay bạn!" : "BÙM!"}</div>
        <div className="text-xl mt-3">{mine ? "−15 điểm 😭" : <>Bom nổ ở chỗ <b className="text-[#FFD25A]">{room.last?.name}</b></>}</div>
        {room.last?.word && <div className="mt-4 text-lg opacity-90"><span className="zh font-bold">{room.last.word[0]}</span> · {room.last.word[1]}</div>}
      </div>,
      mine ? "bg-[#B3261E]" : "bg-[#1F2A24]"
    );
  }

  // ---------- 3. ĐANG CHƠI ----------
  if (!isHolder) {
    const lastMine = room.last?.pid === pid;
    return shell(
      <div className="m-auto text-center w-full">
        <div className="text-sm font-bold text-[#5B7262]">Ván {room.round}/{room.rounds}</div>
        <div className="text-6xl mt-4" style={{ animation: "shake 1s infinite" }}>💣</div>
        <div className="text-lg font-bold text-[#5B7262] mt-3">Bom đang ở chỗ</div>
        <div className="text-4xl font-extrabold text-[#C0392B] break-words">{room.holderName}</div>
        {lastMine && room.last.type === "ok" && <div className="mt-6 p-4 rounded-2xl bg-[#E7F5EC] text-[#1E5C38] font-bold" style={{ animation: "pop .3s" }}>✅ Chính xác! +10 · Bạn đã chuyền bom đi 😮‍💨</div>}
        <div className="mt-6 text-[#5B7262]">Sẵn sàng nhé — bom có thể bay sang bạn bất cứ lúc nào!</div>
      </div>
    );
  }

  // BOM Ở TAY MÌNH
  const waiting = sent && sent.qid === q?.id;
  const badMine = room.last?.type === "bad" && room.last?.pid === pid;
  return shell(
    <div className="flex-1 flex flex-col">
      <div className="rounded-2xl bg-[#C0392B] text-white text-center py-3 font-extrabold text-xl" style={{ animation: "shake .4s infinite" }}>💣 BOM Ở TAY BẠN — TRẢ LỜI NHANH!</div>
      {room.paused && <div className="mt-3 p-3 rounded-xl bg-[#FFF4DE] font-bold text-center">⏸ Cô/thầy đang tạm dừng</div>}
      {badMine && <div key={room.last.at} className="mt-3 p-3 rounded-xl bg-[#FDE8E8] text-[#8A1C1C] font-bold text-center" style={{ animation: "pop .3s" }}>❌ Sai rồi! Câu mới — bom vẫn trong tay bạn</div>}
      {q && (
        <>
          <div className="text-center mt-5 font-bold text-[#5B7262]">{q.ask}</div>
          <div className={`text-center font-extrabold leading-tight mt-1 mb-5 ${q.kind === "hz" ? "zh text-6xl" : q.kind === "def" ? "zh text-xl" : "text-3xl text-[#1E7A45]"}`}>{q.big}</div>
          <div className="grid gap-3 flex-1 content-start">
            {q.opts.map((o, i) => (
              <button key={q.id + i} disabled={waiting || room.paused} onClick={() => answer(i)}
                className={`${OPT[i]} min-h-[64px] rounded-2xl text-white px-4 py-3 flex items-center gap-3 text-left active:scale-[.98] transition disabled:opacity-60 ${waiting && sent.choice === i ? "ring-4 ring-black/30" : ""}`}>
                <b className="w-8 h-8 rounded-lg bg-white/25 grid place-items-center shrink-0">{"ABCD"[i]}</b>
                <span className={`font-bold ${q.optKind === "hz" ? "zh text-3xl" : q.optKind === "def" ? "zh text-base" : "text-xl"}`}>{o}</span>
              </button>
            ))}
          </div>
          {waiting && <div className="text-center mt-3 text-[#5B7262] font-semibold">Đang chấm…</div>}
        </>
      )}
      {err && <div className="mt-3 p-3 rounded-xl bg-[#FDE8E8] text-[#8A1C1C] font-semibold">{err}</div>}
    </div>,
    "bg-[#FFF1EC]"
  );
}
