"use client";
// ============================================================
// LUẬN VÕ 论武 — đấu từ vựng 1 chọi 1 theo thời gian thực (Giang hồ · Sơn Hải Thư Viện)
// Phòng lưu ở Firestore game_rooms/duel-{code} (cùng collection với các trò cả lớp)
//   { kind:"duel", code, lv, lvName, open(public), status: open|play|done|cancel, hostId, guestId,
//     names:{uid:tên}, qs:[10 câu], startAt(ms), p:{uid:{i, score, ok, at, done}}, rewarded:{uid:true} }
// 10 câu, mỗi câu 10 giây: đúng = 10 điểm + số giây còn lại. Thắng +50 linh khí, hòa +25, thua +10.
// ============================================================
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, useUser, SignInButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc, getDocs, onSnapshot, collection, query, where, limit, runTransaction, increment } from "firebase/firestore";
import GardenNav from "../GardenNav";
import { ThienBang } from "../giangHo";
import { buildPool, makeQuestion, publicQuestion, loadVocab, speak, newCode } from "../bom/game";

const ROOMS = "game_rooms";
const N_Q = 10, SEC = 10, OPEN_TTL = 5 * 60 * 1000;
const LABELS = ["甲", "乙", "丙", "丁"];
const REWARD = { win: 50, draw: 25, lose: 10 };
const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

function makeQs(level) {
  const pool = buildPool(level, level.lessons.map((_, i) => i));
  const avoid = new Set(); const out = [];
  for (let i = 0; i < N_Q; i++) {
    const q = makeQuestion(pool, "mix", avoid);
    avoid.add(q.word[0]);
    out.push({ ...publicQuestion(q), ans: q.ans });
  }
  return out;
}

export default function LuanVoPage() {
  const { isSignedIn, userId, isLoaded } = useAuth();
  const { user } = useUser();
  const myName = user?.fullName || user?.firstName || "Thư sinh";

  const [vocab, setVocab] = useState(null);
  const [lv, setLv] = useState(0);
  const [code, setCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // trạng thái chơi của mình
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState(null);
  const [left, setLeft] = useState(SEC);
  const [now, setNow] = useState(Date.now());
  const scoreRef = useRef({ score: 0, ok: 0 });
  const qStartRef = useRef(0);
  const rewardedRef = useRef(false);

  useEffect(() => {
    loadVocab().then((v) => {
      setVocab(v);
      const s = v.findIndex((x) => x.id === LS.get("sh_duel_lv"));
      if (s >= 0) setLv(s);
    }).catch(() => setMsg("Không tải được kho từ vựng."));
    try { const c = new URLSearchParams(location.search).get("code"); if (c) setJoinCode(c); } catch (_) {}
  }, []);

  // Theo dõi phòng
  useEffect(() => {
    if (!code) return;
    const off = onSnapshot(doc(db, ROOMS, "duel-" + code), (s) => setRoom(s.exists() ? s.data() : null), () => setMsg("Mất kết nối phòng đấu."));
    return () => off();
  }, [code]);

  // Đồng hồ
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  const me = userId;
  const oppId = room ? (room.hostId === me ? room.guestId : room.hostId) : null;
  const myP = room?.p?.[me] || { i: 0, score: 0, ok: 0 };
  const opP = oppId ? room?.p?.[oppId] || { i: 0, score: 0, ok: 0 } : null;
  const started = room?.status === "play" && now >= (room.startAt || 0);
  const countdown = room?.status === "play" && now < (room.startAt || 0) ? Math.ceil((room.startAt - now) / 1000) : 0;

  // Hủy phòng đang chờ khi rời trang
  useEffect(() => {
    if (!room || room.status !== "open" || room.hostId !== me) return;
    const cancel = () => { setDoc(doc(db, ROOMS, "duel-" + room.code), { status: "cancel" }, { merge: true }).catch(() => {}); };
    window.addEventListener("pagehide", cancel);
    return () => window.removeEventListener("pagehide", cancel);
  }, [room, me]);

  // ---------- Tạo / tìm / vào phòng ----------
  const createRoom = async (open) => {
    if (!vocab) return;
    setBusy(true); setMsg("");
    const c = newCode(); const level = vocab[lv];
    try {
      await setDoc(doc(db, ROOMS, "duel-" + c), {
        kind: "duel", code: c, lv, lvName: level.name, open, status: "open", createdAt: Date.now(),
        hostId: me, guestId: "", names: { [me]: myName }, qs: makeQs(level), startAt: 0,
        p: { [me]: { i: 0, score: 0, ok: 0, at: Date.now(), done: false } },
      });
      resetPlay(); setCode(c);
    } catch (e) { setMsg("Chưa lập được lôi đài: " + (e?.message || "")); }
    setBusy(false);
  };
  const joinRoom = async (c) => {
    setBusy(true); setMsg("");
    try {
      const ref = doc(db, ROOMS, "duel-" + c);
      await runTransaction(db, async (tx) => {
        const s = await tx.get(ref);
        if (!s.exists()) throw new Error("Không có lôi đài mã này.");
        const r = s.data();
        if (r.hostId === me) return; // phòng của chính mình
        if (r.status !== "open" || r.guestId) throw new Error("Lôi đài đã đủ người hoặc đã đóng.");
        tx.update(ref, { guestId: me, [`names.${me}`]: myName, [`p.${me}`]: { i: 0, score: 0, ok: 0, at: Date.now(), done: false }, status: "play", startAt: Date.now() + 4000 });
      });
      resetPlay(); setCode(c);
      return true;
    } catch (e) { setMsg(e?.message || "Không vào được lôi đài."); return false; }
    finally { setBusy(false); }
  };
  const quickMatch = async () => {
    if (!vocab) return;
    setBusy(true); setMsg("Đang tìm đồng song cùng cấp…");
    LS.set("sh_duel_lv", vocab[lv].id);
    try {
      const snap = await getDocs(query(collection(db, ROOMS), where("kind", "==", "duel"), where("status", "==", "open"), where("lv", "==", lv), limit(10)));
      const cands = []; snap.forEach((d) => { const r = d.data(); if (r.open && r.hostId !== me && Date.now() - (r.createdAt || 0) < OPEN_TTL) cands.push(r.code); });
      for (const c of cands) { if (await joinRoom(c)) { setMsg(""); return; } }
    } catch (_) { /* không tìm được thì tự lập lôi đài công khai */ }
    setBusy(false);
    await createRoom(true);
    setMsg("");
  };
  const resetPlay = () => { setQi(0); setPicked(null); setLeft(SEC); scoreRef.current = { score: 0, ok: 0 }; qStartRef.current = 0; rewardedRef.current = false; };
  const leave = () => {
    if (room?.status === "open" && room.hostId === me) setDoc(doc(db, ROOMS, "duel-" + room.code), { status: "cancel" }, { merge: true }).catch(() => {});
    setCode(""); setRoom(null); resetPlay();
  };

  // ---------- Chơi ----------
  const q = room?.qs?.[qi];
  useEffect(() => { if (started && qi < N_Q && picked === null) { qStartRef.current = Date.now(); if (q?.say) speak(q.say); } }, [started, qi]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!started || qi >= N_Q || picked !== null || !qStartRef.current) return;
    const l = Math.max(0, SEC - Math.floor((now - qStartRef.current) / 1000));
    setLeft(l);
    if (l <= 0) answer(-1);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (k) => {
    if (picked !== null || !q) return;
    const sec = Math.max(0, SEC - (Date.now() - qStartRef.current) / 1000);
    const ok = k === q.ans;
    const st = scoreRef.current;
    if (ok) { st.score += 10 + Math.round(sec); st.ok += 1; }
    setPicked(k);
    const ni = qi + 1;
    setDoc(doc(db, ROOMS, "duel-" + code), { p: { [me]: { i: ni, score: st.score, ok: st.ok, at: Date.now(), done: ni >= N_Q } } }, { merge: true }).catch(() => {});
    setTimeout(() => { setPicked(null); setQi(ni); setLeft(SEC); }, 900);
  };

  // ---------- Kết thúc + thưởng ----------
  const myDone = myP.done || qi >= N_Q;
  const oppGone = opP && !opP.done && now - (opP.at || 0) > 40000; // đối thủ bỏ đi
  const finished = room && (room.status === "done" || (myDone && opP && (opP.done || oppGone)));
  const outcome = useMemo(() => {
    if (!finished || !opP) return null;
    const a = myP.score || 0, b = opP.score || 0;
    return a > b ? "win" : a < b ? "lose" : "draw";
  }, [finished, myP.score, opP]);

  useEffect(() => {
    if (!finished || !outcome || rewardedRef.current || room?.rewarded?.[me]) return;
    rewardedRef.current = true;
    const g = REWARD[outcome];
    setDoc(doc(db, ROOMS, "duel-" + code), { status: "done", rewarded: { [me]: true } }, { merge: true }).catch(() => {});
    setDoc(doc(db, "users", me), { xp: increment(g), luanVo: { [outcome]: increment(1) } }, { merge: true }).catch(() => {});
  }, [finished, outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const shareLink = typeof window !== "undefined" && code ? `${location.origin}/luan-vo?code=${code}` : "";
  const copyLink = async () => { try { await navigator.clipboard.writeText(shareLink); setMsg("Đã chép đường dẫn lôi đài — gửi cho đồng song nhé."); } catch (_) {} };

  const Bar = ({ p, name, mine, dark }) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm"><b className={mine ? (dark ? "text-[#E6B656]" : "text-[#9E2F22]") : ""}>{name}{mine ? " (bạn)" : ""}</b><span className="font-bold tabular-nums">{p?.score || 0} điểm</span></div>
      <div className={`h-2 rounded-[2px] overflow-hidden ${dark ? "bg-[#3A3D48]" : "bg-[#DCD1BA]"}`}><div className={`h-full transition-all duration-500 ${mine ? (dark ? "bg-[#E6B656]" : "bg-[#9E2F22]") : dark ? "bg-[#EDE8DC]" : "bg-[#1C1A17]"}`} style={{ width: `${((p?.i || 0) / N_Q) * 100}%` }} /></div>
      <div className={`text-xs ${dark ? "text-[#A6A9B4]" : "text-[#6B6253]"}`}>{p?.i || 0}/{N_Q} câu · đúng {p?.ok || 0}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="play" title="Luận võ" />
      <main className="max-w-[1100px] mx-auto px-4 md:px-8 pt-6 pb-28 md:pb-16 grid gap-6 lg:grid-cols-[1.4fr_1fr] items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <div className="flex items-baseline gap-3">
            <span className="font-brush text-[40px] leading-none text-[#9E2F22]" aria-hidden="true">论武</span>
            <h1 className="font-serif-vn text-[26px] font-extrabold">Luận võ</h1>
          </div>

          {!isLoaded ? null : !isSignedIn ? (
            <section className="rounded-[14px] border-2 border-[#1C1A17] bg-[#FBF8F1] p-5 flex flex-col gap-3">
              <p>Luận võ cần biết bạn là ai để tính thắng thua và cộng linh khí.</p>
              <SignInButton mode="modal"><button className="self-start h-11 px-5 rounded-md bg-[#9E2F22] text-white font-bold">Đăng nhập để luận võ</button></SignInButton>
            </section>
          ) : !code ? (
            /* ---------- SẢNH ---------- */
            <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-4">
              <p className="text-[15px] leading-relaxed text-[#4A4238]">Đấu từ vựng một chọi một với đồng song: <b>10 câu</b>, mỗi câu <b>10 giây</b>. Đúng được 10 điểm cộng số giây còn lại. Thắng <b>+50</b> linh khí, hòa <b>+25</b>, thua vẫn được <b>+10</b>.</p>
              <label className="flex flex-col gap-1.5 text-sm font-semibold">Võ đài (cấp từ vựng)
                <select value={lv} onChange={(e) => setLv(Number(e.target.value))} className="h-11 px-3 rounded-md border border-[#CDBF9F] bg-white text-[15px] font-normal">
                  {(vocab || []).map((v, i) => <option key={v.id} value={i}>{v.name} · {v.lessons.reduce((a, l) => a + l.w.length, 0)} từ</option>)}
                </select>
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={quickMatch} disabled={busy || !vocab} className="flex-1 h-12 rounded-md bg-[#1C1A17] disabled:bg-[#8C7F68] text-[#F3EEE2] font-serif-vn font-extrabold shadow-[4px_4px_0_#9E2F22]">Tìm đối thủ</button>
                <button onClick={() => createRoom(false)} disabled={busy || !vocab} className="flex-1 h-12 rounded-md border-2 border-[#1C1A17] font-bold">Lập lôi đài riêng</button>
              </div>
              <div className="flex gap-2 items-end">
                <label className="flex-1 flex flex-col gap-1.5 text-sm font-semibold">Vào lôi đài bằng mã
                  <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6 chữ số" className="h-11 px-3 rounded-md border border-[#CDBF9F] bg-white text-[15px] font-normal tracking-[0.2em]" />
                </label>
                <button onClick={() => joinRoom(joinCode)} disabled={busy || joinCode.length !== 6} className="h-11 px-5 rounded-md bg-[#9E2F22] disabled:bg-[#CDBF9F] text-white font-bold">Vào</button>
              </div>
              {msg && <p className="text-sm text-[#7A2218]" role="status">{msg}</p>}
            </section>
          ) : !room ? (
            <p className="text-[#6B6253]">Đang mở lôi đài…</p>
          ) : room.status === "cancel" ? (
            <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-3"><p>Lôi đài đã đóng.</p><button onClick={leave} className="self-start h-11 px-5 rounded-md bg-[#1C1A17] text-white font-bold">Về sảnh</button></section>
          ) : room.status === "open" ? (
            /* ---------- CHỜ ĐỐI THỦ ---------- */
            <section className="rounded-[14px] bg-[#121318] text-[#EDE8DC] p-6 flex flex-col items-center text-center gap-3">
              <div className="font-brush text-[44px] leading-none text-[#E6B656] tt-pulse">候敌</div>
              <h2 className="font-serif-vn text-xl font-extrabold">{room.open ? "Đang chờ đối thủ ghép trận…" : "Lôi đài riêng đã dựng"}</h2>
              <p className="text-sm text-[#C9CBD3]">Võ đài {room.lvName}. Gửi mã cho đồng song để vào đấu:</p>
              <div className="font-extrabold text-[34px] tracking-[0.3em] tabular-nums">{room.code}</div>
              <div className="flex gap-2"><button onClick={copyLink} className="h-10 px-4 rounded-md bg-[#E6B656] text-[#121318] font-bold text-sm">Chép đường dẫn</button><button onClick={leave} className="h-10 px-4 rounded-md border border-[#3A3D48] text-sm font-semibold">Hủy</button></div>
              {msg && <p className="text-xs text-[#C9CBD3]">{msg}</p>}
            </section>
          ) : finished ? (
            /* ---------- KẾT QUẢ ---------- */
            <section className={`rounded-[14px] p-6 flex flex-col items-center text-center gap-3 ${outcome === "win" ? "bg-[#121318] text-[#EDE8DC]" : "bg-[#FBF8F1] border border-[#D8CBAE]"}`}>
              <div className={`font-brush text-[54px] leading-none ${outcome === "win" ? "text-[#E6B656]" : "text-[#9E2F22]"}`}>{outcome === "win" ? "胜" : outcome === "lose" ? "败" : "和"}</div>
              <h2 className="font-serif-vn text-xl font-extrabold">{outcome === "win" ? "Thắng trận luận võ!" : outcome === "lose" ? "Thua trận — luyện thêm rồi tái đấu" : "Bất phân thắng bại"}</h2>
              <p className="text-sm">{myP.score || 0} : {opP?.score || 0} {oppGone ? "· đối thủ đã rời lôi đài" : ""}</p>
              <p className="text-sm font-bold">+{REWARD[outcome] || 0} linh khí</p>
              <div className="w-full max-w-sm flex flex-col gap-3 text-left mt-1">
                <Bar p={myP} name={myName} mine dark={outcome === "win"} />
                {opP && <Bar p={opP} name={room.names?.[oppId] || "Đối thủ"} dark={outcome === "win"} />}
              </div>
              <button onClick={leave} className={`mt-2 h-11 px-6 rounded-md font-bold ${outcome === "win" ? "bg-[#E6B656] text-[#121318]" : "bg-[#1C1A17] text-white"}`}>Đấu trận khác</button>
            </section>
          ) : (
            /* ---------- ĐANG ĐẤU ---------- */
            <section className="rounded-[14px] bg-[#FBF8F1] border border-[#D8CBAE] p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <Bar p={{ ...myP, i: Math.max(myP.i || 0, qi), score: scoreRef.current.score, ok: scoreRef.current.ok }} name={myName} mine />
                <Bar p={opP} name={room.names?.[oppId] || "Đối thủ"} />
              </div>
              {countdown > 0 ? (
                <div className="py-10 flex flex-col items-center gap-2"><div className="font-brush text-[64px] leading-none text-[#9E2F22]">{countdown}</div><p className="text-sm text-[#6B6253]">Chuẩn bị ra chiêu…</p></div>
              ) : myDone ? (
                <div className="py-10 text-center text-[#4A4238]">Bạn đã xong 10 câu — chờ đối thủ hoàn tất…</div>
              ) : q ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold">Câu {qi + 1}/{N_Q} · {q.ask}</span><span className={`font-extrabold tabular-nums ${left <= 3 ? "text-[#9E2F22]" : ""}`}>{left}s</span></div>
                  <div className="h-1.5 bg-[#DCD1BA] rounded-[1px] overflow-hidden"><div className="h-full bg-[#9E2F22] transition-[width] duration-200" style={{ width: `${(left / SEC) * 100}%` }} /></div>
                  <div className="rounded-md bg-[#EFE7D6] px-4 py-5 text-center">
                    {q.kind === "audio" ? <button onClick={() => speak(q.say)} className="h-12 px-5 rounded-full bg-[#9E2F22] text-white font-bold">Nghe lại</button>
                      : <span className={q.kind === "hz" ? "text-[40px]" : "text-[20px]"} style={q.kind === "hz" || q.kind === "def" ? { fontFamily: '"Noto Serif SC",serif' } : undefined}>{q.big}</span>}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Các đáp án">
                    {q.opts.map((o, k) => {
                      const show = picked !== null; const right = k === q.ans; const mine = k === picked;
                      return (
                        <button key={k} onClick={() => answer(k)} disabled={picked !== null} role="radio" aria-checked={mine}
                          className={`min-h-[52px] flex items-center gap-3 px-3 py-2 rounded-[4px] text-left border ${show && right ? "border-2 border-[#2F6E5A] bg-[#E2ECE5]" : show && mine ? "border-2 border-[#9E2F22] bg-[#F3E3D2]" : "border-[#D8CBAE] bg-white hover:border-[#9E2F22]"}`}>
                          <span className="w-7 h-7 rounded-[3px] grid place-items-center font-brush text-[18px] bg-[#EFE7D6] shrink-0" aria-hidden="true">{LABELS[k]}</span>
                          <span className={q.optKind === "hz" ? "text-[22px]" : "text-[15px]"} style={q.optKind === "hz" || q.optKind === "def" ? { fontFamily: '"Noto Serif SC",serif' } : undefined}>{o}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </div>
        <ThienBang n={10} me={userId} />
        <p className="lg:col-span-2 text-xs text-[#6B6253]"><Link href="/?tab=play" className="underline">← Về Giang hồ</Link></p>
      </main>
    </div>
  );
}
