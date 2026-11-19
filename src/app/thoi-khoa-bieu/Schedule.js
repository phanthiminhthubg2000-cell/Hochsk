"use client";
// Thời khoá biểu: xem (học viên) / sửa (giáo viên). Dữ liệu sống từ Firestore: classes/{id}.tkb + schedule_config/main
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, updateDoc, addDoc, setDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "../../firebase";
import {
  COLORS, COLOR_KEYS, HAN, DOW, DS, pad, ymd, parse, addD, dowIdx, mins, dm, fmtD, fmtS, tm, today, weekStart, TOPTS, clone,
  emptyTkb, firstDate, gen, buildAll, isPast, isNow, stat, STL, schedText, TPL, tplLessons, guessTpl, SERIES, lessonLinks, LEGACY,
} from "../../lib/tkb";

const P = { bg: "#EFE7D6", paper: "#FBF8F1", line: "#D8CBAE", ink: "#1C1A17", mute: "#6B6253", soft: "#F3EDE0", red: "#9E2F22" };
const kc = (c) => ({ "--k": COLORS[c]?.[0] || COLORS.slate[0], "--t": COLORS[c]?.[1] || COLORS.slate[1] });
const btn = "px-3 py-2 rounded-[10px] border text-sm font-bold whitespace-nowrap disabled:opacity-40";
const B = ({ children, onClick, kind, className = "", ...r }) => (
  <button type="button" onClick={onClick} className={`${btn} ${className}`} style={kind === "pri" ? { background: P.red, color: "#fff", borderColor: P.red } : kind === "dark" ? { background: P.ink, color: "#fff", borderColor: P.ink } : kind === "danger" ? { color: P.red, borderColor: P.red, background: "transparent" } : { background: "#fff", borderColor: P.line }} {...r}>{children}</button>
);
function Modal({ open, onClose, children, color, title, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${wide ? "sm:max-w-[760px]" : "sm:max-w-[600px]"} max-h-[92dvh] overflow-y-auto rounded-t-[16px] sm:rounded-[16px] shadow-2xl`} style={{ background: P.paper, ...kc(color) }}>
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b" style={{ background: P.paper, borderColor: P.line }}>
          {color && <span className="w-1.5 self-stretch rounded" style={{ background: "var(--k)" }} />}
          <div className="flex-1 font-extrabold text-[17px] leading-snug">{title}</div>
          <button onClick={onClose} className="w-9 h-9 rounded-[10px] border text-lg" style={{ borderColor: P.line }} aria-label="Đóng">×</button>
        </div>
        <div className="p-4 grid gap-4">{children}</div>
      </div>
    </div>
  );
}
const Field = ({ label, children, hint }) => <label className="grid gap-1 text-[13px] font-bold" style={{ color: P.mute }}>{label}{children}{hint && <span className="font-normal text-xs">{hint}</span>}</label>;
const inp = "w-full rounded-[9px] border px-2.5 py-2 text-[15px] font-medium text-[#1C1A17] bg-white";
const TimeSel = ({ value, onChange, empty }) => <select className={inp} style={{ borderColor: P.line }} value={value || ""} onChange={(e) => onChange(e.target.value)}>{empty && <option value="">— Không ghi —</option>}{TOPTS.map((t) => <option key={t}>{t}</option>)}</select>;

function SessBlock({ s, c, mode, onClick }) {
  const cls = s.off ? "opacity-75" : isPast(s) ? "opacity-50" : "";
  const st = s.off ? { background: "transparent", border: "1.5px dashed " + P.line, borderLeft: "4px dashed var(--k)" } : { background: "var(--t)", borderLeft: "4px solid var(--k)" };
  const body = s.off ? `${s.hol ? "Nghỉ lễ" : "Nghỉ"}${s.reason && !/^Nghỉ( lễ)?$/.test(s.reason) ? " · " + s.reason : ""}` : s.lesson;
  return (
    <button onClick={onClick} className={`block w-full text-left rounded-[8px] px-2 py-1.5 leading-tight ${cls}`} style={{ ...kc(c.color), ...st, boxShadow: isNow(s) ? `0 0 0 2px ${P.red}` : undefined }}>
      <span className="text-[11.5px] font-bold tabular-nums" style={{ color: "var(--k)" }}>{mode === "month" ? s.start : tm(s)}</span>
      <span className="block text-[12px] font-semibold" style={{ color: P.mute }}>{c.name}</span>
      <span className={`block ${s.off ? "text-[12.5px] font-semibold" : "text-[13.5px] font-extrabold"}`} style={s.off ? { color: P.mute } : {}}>{body}</span>
      {mode !== "month" && !s.off && <span className="block text-[11px]" style={{ color: P.mute }}>Buổi {s.no}/{(c.lessons || []).length}{s.extra ? " · học bù" : ""}{s.note ? " · " + s.note : ""}</span>}
    </button>
  );
}

export default function Schedule({ editable = false }) {
  const [raw, setRaw] = useState(null);     // tất cả lớp
  const [hol, setHol] = useState({});
  const [view, setView] = useState("week");
  const [cur, setCur] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [hidden, setHidden] = useState(new Set());
  const [dlg, setDlg] = useState(null);     // {k:"s"|"c"|"day"|"form", ...}
  const [toastMsg, setToast] = useState("");
  const [, tick] = useState(0);
  const toast = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  useEffect(() => {
    try { const v = localStorage.getItem("tkb-view"); if (["week", "month", "classes"].includes(v)) setView(v); setHidden(new Set(JSON.parse(localStorage.getItem("tkb-hidden") || "[]"))); } catch {}
    const u1 = onSnapshot(collection(db, "classes"), (s) => { const o = {}; s.forEach((d) => (o[d.id] = { id: d.id, ...d.data() })); setRaw(o); }, () => setRaw({}));
    const u2 = onSnapshot(doc(db, "schedule_config", "main"), (s) => setHol((s.exists() && s.data().holidays) || {}), () => {});
    const t = setInterval(() => tick((x) => x + 1), 60000);
    return () => { u1(); u2(); clearInterval(t); };
  }, []);

  const courses = useMemo(() => { const o = {}; Object.values(raw || {}).forEach((x) => { if (x.tkb) o[x.id] = { ...emptyTkb(), ...x.tkb, name: x.className || "Lớp", level: x.level || "" }; }); return o; }, [raw]);
  const unsched = useMemo(() => Object.values(raw || {}).filter((x) => !x.tkb), [raw]);
  const all = useMemo(() => buildAll(courses, hol), [courses, hol]);
  const sorted = Object.entries(courses).sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99) || a[1].name.localeCompare(b[1].name, "vi"));
  const st = (id) => stat(courses[id], all.gen[id]);

  const setV = (v) => { setView(v); try { localStorage.setItem("tkb-view", v); } catch {} };
  const toggle = (id) => { const n = new Set(hidden); n.has(id) ? n.delete(id) : n.add(id); setHidden(n); try { localStorage.setItem("tkb-hidden", JSON.stringify([...n])); } catch {} };
  const shift = (n) => setCur((d) => (view === "week" ? addD(d, 7 * n) : new Date(d.getFullYear(), d.getMonth() + n, 1)));

  // ---------- lưu ----------
  const strip = (c) => { const { name, level, ...t } = c; return t; };
  const saveTkb = async (cid, c, ok) => { try { await updateDoc(doc(db, "classes", cid), { tkb: strip(c) }); if (ok) toast(ok); } catch (e) { console.error(e); toast("Không lưu được: " + (e.code || e.message)); } };
  const mutate = (cid, fn, ok) => { const c = clone(courses[cid]); fn(c); return saveTkb(cid, c, ok); };
  const saveHol = async (h, ok) => { try { await setDoc(doc(db, "schedule_config", "main"), { holidays: h }, { merge: false }); toast(ok); } catch (e) { toast("Không lưu được ngày nghỉ lễ: " + (e.code || e.message)); } };
  const importLegacy = async () => {
    try {
      for (const L of LEGACY) {
        const key = L.name.match(/[A-Z]{2}\d+/)?.[0];
        const ex = Object.values(raw || {}).find((x) => key && String(x.className || "").toUpperCase().includes(key));
        const tkb = { ...L.tkb, lessons: tplLessons(L.tkb.tpl, 1) };
        if (ex) await updateDoc(doc(db, "classes", ex.id), { tkb });
        else await addDoc(collection(db, "classes"), { className: L.name, level: L.level, students: [], createdAt: serverTimestamp(), tkb });
      }
      toast("Đã nhập 2 lớp từ thời khoá biểu cũ");
    } catch (e) { toast("Lỗi nhập: " + (e.code || e.message)); }
  };

  // ---------- tiêu đề ----------
  let han, title, sub = "";
  if (view === "week") { const a = weekStart(cur), b = addD(a, 6); han = HAN[a.getMonth()]; title = `Tuần ${a.getDate()}/${a.getMonth() + 1} – ${b.getDate()}/${b.getMonth() + 1}/${b.getFullYear()}`; }
  else if (view === "month") { han = HAN[cur.getMonth()]; title = `Tháng ${cur.getMonth() + 1}, ${cur.getFullYear()}`; }
  else { han = "课"; title = "Các lớp"; }
  if (raw) {
    let a, b;
    if (view === "week") { a = ymd(weekStart(cur)); b = ymd(addD(weekStart(cur), 6)); }
    else if (view === "month") { a = ymd(new Date(cur.getFullYear(), cur.getMonth(), 1)); b = ymd(new Date(cur.getFullYear(), cur.getMonth() + 1, 0)); }
    if (a) {
      const r = []; for (const [ds, v] of Object.entries(all.byDate)) if (ds >= a && ds <= b) v.forEach((s) => !s.off && !hidden.has(s.cid) && r.push(s));
      const mn = r.reduce((t, s) => t + (s.end ? Math.max(0, mins(s.end) - mins(s.start)) : 0), 0);
      sub = r.length ? `${r.length} buổi học · ${Math.floor(mn / 60)} giờ${mn % 60 ? " " + (mn % 60) + " phút" : ""} · ${new Set(r.map((s) => s.cid)).size} lớp` : "Không có buổi học";
    } else { const s = sorted.map(([id]) => st(id)); sub = `${s.filter((x) => x.status === "active" || x.status === "soon").length} lớp đang học · ${s.length} lớp có lịch`; }
  }

  // ---------- hôm nay ----------
  const t = today();
  const todayList = (all.byDate[t] || []).filter((s) => !s.off && !hidden.has(s.cid));
  let nextList = null;
  if (!todayList.length) for (const ds of Object.keys(all.byDate).filter((x) => x > t).sort()) { const v = all.byDate[ds].filter((s) => !s.off && !hidden.has(s.cid)); if (v.length) { nextList = v; break; } }
  const openS = (s) => setDlg({ k: "s", cid: s.cid, ds: s.date });

  // ---------- các khung xem ----------
  const WeekV = () => {
    const a = weekStart(cur), days = [...Array(7)].map((_, i) => addD(a, i));
    const per = days.map((d) => (all.byDate[ymd(d)] || []).filter((s) => !hidden.has(s.cid)));
    const times = [...new Set(per.flat().map((s) => s.start))].sort((x, y) => mins(x) - mins(y));
    return (
      <>
        <div className="hidden md:block overflow-x-auto">
          <div className="grid gap-px rounded-[14px] overflow-hidden border" style={{ gridTemplateColumns: "64px repeat(7,minmax(118px,1fr))", background: P.line, borderColor: P.line }}>
            <div style={{ background: P.soft }} />
            {days.map((d, i) => { const ds = ymd(d); return <button key={ds} onClick={() => setDlg({ k: "day", ds })} className="text-left px-2.5 py-2 text-[13px] font-bold" style={ds === t ? { background: P.red, color: "#fff" } : { background: P.soft, color: P.mute }}>{DOW[i]}<b className="block text-[17px]" style={{ color: ds === t ? "#fff" : P.ink }}>{pad(d.getDate())}/{pad(d.getMonth() + 1)}{hol[ds] !== undefined && <span className="text-[11px]"> · nghỉ lễ</span>}</b></button>; })}
            {!times.length && <><div style={{ background: P.soft }} />{days.map((d) => <div key={ymd(d)} className="min-h-[60px]" style={{ background: "#fff" }} />)}</>}
            {times.map((tt) => [<div key={tt} className="px-2 py-2 text-[13px] font-extrabold tabular-nums" style={{ background: P.soft }}>{tt}</div>, ...days.map((d, i) => <div key={tt + i} className="p-1 flex flex-col gap-1 min-h-[60px]" style={{ background: ymd(d) === t ? "#FFF8F3" : "#fff" }}>{per[i].filter((s) => s.start === tt).map((s) => <SessBlock key={s.cid} s={s} c={courses[s.cid]} onClick={() => openS(s)} />)}</div>)])}
          </div>
        </div>
        <div className="md:hidden grid gap-2">
          {days.map((d, i) => { const ds = ymd(d), v = per[i]; return (
            <div key={ds} className="grid grid-cols-[52px_1fr] gap-2.5 rounded-[12px] border p-2.5" style={{ background: v.length ? "#fff" : "transparent", borderColor: ds === t ? P.red : P.line, borderStyle: v.length ? "solid" : "dashed" }}>
              <button onClick={() => setDlg({ k: "day", ds })} className="text-center"><b className="block text-[22px] leading-none" style={{ color: ds === t ? P.red : P.ink }}>{d.getDate()}</b><small className="font-bold" style={{ color: P.mute }}>{DS[i]}</small></button>
              <div className="grid gap-1.5">{v.length ? v.map((s) => <SessBlock key={s.cid} s={s} c={courses[s.cid]} onClick={() => openS(s)} />) : <span className="text-[13px] self-center" style={{ color: P.mute }}>{hol[ds] !== undefined ? "Nghỉ lễ" : "Không có lớp"}</span>}</div>
            </div>); })}
        </div>
      </>
    );
  };
  const MonthV = () => {
    const y = cur.getFullYear(), m = cur.getMonth(), first = new Date(y, m, 1), lead = dowIdx(first), n = new Date(y, m + 1, 0).getDate(), cells = Math.ceil((lead + n) / 7) * 7;
    return (
      <div className="overflow-x-auto"><div className="grid gap-px rounded-[14px] overflow-hidden border min-w-[780px]" style={{ gridTemplateColumns: "repeat(7,minmax(108px,1fr))", background: P.line, borderColor: P.line }}>
        {DOW.map((x, i) => <div key={x} className="px-2.5 py-2 text-[13px] font-bold" style={{ background: P.soft, color: i > 4 ? P.red : P.mute }}>{x}</div>)}
        {[...Array(cells)].map((_, i) => { const x = new Date(y, m, 1 - lead + i), ds = ymd(x), out = x.getMonth() !== m; const v = out ? [] : (all.byDate[ds] || []).filter((s) => !hidden.has(s.cid)); return (
          <div key={ds} className="min-h-[108px] p-1.5 flex flex-col gap-1" style={{ background: out ? P.soft : "#fff" }}>
            <button onClick={() => setDlg({ k: "day", ds })} className="text-left text-[13px] font-bold" style={{ color: P.mute, opacity: out ? 0.4 : 1 }}><span className={ds === t ? "inline-grid place-items-center min-w-[24px] h-6 px-1.5 rounded-full text-white" : ""} style={ds === t ? { background: P.red } : {}}>{x.getDate()}</span></button>
            {!out && hol[ds] !== undefined && <span className="text-[11px] font-bold" style={{ color: P.red }}>Nghỉ lễ{hol[ds] ? ": " + hol[ds] : ""}</span>}
            {v.map((s) => <SessBlock key={s.cid} s={s} c={courses[s.cid]} mode="month" onClick={() => openS(s)} />)}
          </div>); })}
      </div></div>
    );
  };
  const ClassesV = () => {
    const xs = sorted.map(([id, c]) => ({ id, c, ...st(id) }));
    return (
      <div className="grid gap-5">
        {!xs.length && <div className="rounded-[12px] border border-dashed p-6 text-center" style={{ borderColor: P.line, color: P.mute }}>Chưa có lớp nào có lịch.</div>}
        {["active", "soon", "paused", "done"].map((k) => { const v = xs.filter((x) => x.status === k); if (!v.length) return null; return (
          <section key={k}><h3 className="text-sm font-bold mb-2" style={{ color: P.mute }}>{STL[k]} · {v.length} lớp</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{v.map((x) => { const p = x.total ? Math.round((x.taught / x.total) * 100) : 0; return (
              <button key={x.id} onClick={() => setDlg({ k: "c", cid: x.id })} className="text-left grid gap-2 rounded-[14px] border p-3.5" style={{ ...kc(x.c.color), background: "#fff", borderColor: P.line, borderTop: "5px solid var(--k)" }}>
                <span className="justify-self-start text-[11.5px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: "var(--t)", color: "var(--k)" }}>{STL[x.status]}</span>
                <div><div className="font-extrabold text-[17px]">{x.c.name}</div>{x.c.place && <div className="text-[13px] font-semibold" style={{ color: P.mute }}>{x.c.place}{x.c.series && SERIES[x.c.series] ? " · " + SERIES[x.c.series].label : ""}</div>}</div>
                <div className="text-[13.5px] font-semibold">{schedText(x.c)}</div>
                <div className="flex justify-between text-[13px] font-semibold" style={{ color: P.mute }}><span>Đã học {x.taught}/{x.total} buổi</span><span>{p}%</span></div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: P.soft }}><i className="block h-full rounded-full" style={{ width: p + "%", background: "var(--k)" }} /></div>
                {x.status === "paused" ? <div className="text-[13.5px]">Tạm dừng từ {dm(all.gen[x.id].paused)} · còn <b>{all.gen[x.id].left}</b> bài</div> : x.next && <div className="text-[13.5px]">Buổi tới: <b>{x.next.lesson}</b> · {fmtS(x.next.date)} {x.next.start}</div>}
              </button>); })}</div>
          </section>); })}
        {editable && unsched.length > 0 && (
          <section><h3 className="text-sm font-bold mb-2" style={{ color: P.mute }}>Lớp chưa có lịch · {unsched.length}</h3>
            <div className="flex flex-wrap gap-2">{unsched.map((x) => <B key={x.id} onClick={() => setDlg({ k: "form", cid: null, attach: x.id })}>＋ Xếp lịch: {x.className}</B>)}</div>
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="grid gap-3.5" style={{ color: P.ink }}>
      <header className="flex items-center gap-4 flex-wrap">
        <div className="font-brush text-[clamp(44px,7vw,72px)] leading-[.85]" style={{ color: P.red }} aria-hidden="true">{han}</div>
        <div><h2 className="m-0 text-[clamp(20px,3vw,28px)] font-extrabold">{title}</h2><div className="text-sm" style={{ color: P.mute }}>{sub}</div></div>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          {editable && <B kind="pri" onClick={() => setDlg({ k: "form", cid: null })}>＋ Thêm lớp / xếp lịch</B>}
          <B onClick={() => window.print()}>In</B>
        </div>
      </header>
      <div className="flex gap-2.5 flex-wrap items-center print:hidden">
        <div className="inline-flex rounded-[10px] border overflow-hidden" style={{ borderColor: P.line, background: "#fff" }}>
          {[["week", "Tuần"], ["month", "Tháng"], ["classes", "Lớp học"]].map(([k, l]) => <button key={k} onClick={() => setV(k)} className="px-3.5 py-2 text-sm font-bold" style={view === k ? { background: P.ink, color: "#fff" } : {}}>{l}</button>)}
        </div>
        {view !== "classes" && <div className="flex gap-1"><B onClick={() => shift(-1)} aria-label="Trước">‹</B><B onClick={() => { const d = new Date(); d.setHours(0, 0, 0, 0); setCur(d); }}>Hôm nay</B><B onClick={() => shift(1)} aria-label="Sau">›</B></div>}
      </div>
      {raw === null ? <div className="rounded-[12px] border p-6 text-center" style={{ borderColor: P.line, color: P.mute }}>Đang tải lịch…</div> : (
        <>
          {editable && !Object.keys(courses).length && (
            <div className="rounded-[12px] border p-3 flex flex-wrap items-center gap-3 text-sm" style={{ borderColor: P.line, background: P.soft }}>
              <span className="flex-1">Chưa có lớp nào có lịch. Bạn có thể nhập 2 lớp từ thời khoá biểu cũ (HSK5 – NB50, HSK4 - MC272); lớp trùng mã sẽ được gắn lịch vào lớp có sẵn.</span>
              <B kind="dark" onClick={importLegacy}>Nhập lịch cũ</B>
            </div>
          )}
          <section className="rounded-[14px] border p-3 flex gap-3.5 flex-wrap print:hidden" style={{ background: "#fff", borderColor: P.line }}>
            <div className="font-extrabold text-sm min-w-[120px]">Hôm nay<small className="block font-semibold text-xs" style={{ color: P.mute }}>{fmtD(t)}</small></div>
            <div className="flex gap-2 flex-wrap flex-1">
              {todayList.length ? todayList.map((s) => <SessToday key={s.cid} s={s} c={courses[s.cid]} onClick={() => openS(s)} />) : (
                <><span className="text-sm" style={{ color: P.mute }}>Hôm nay không có lớp.</span>{nextList && <><span className="text-sm w-full" style={{ color: P.mute }}>Buổi tới: {fmtD(nextList[0].date)}</span>{nextList.map((s) => <SessToday key={s.cid} s={s} c={courses[s.cid]} onClick={() => openS(s)} />)}</>}</>
              )}
            </div>
          </section>
          {view !== "classes" && sorted.length > 0 && (
            <div className="flex gap-2 flex-wrap print:hidden">{sorted.filter(([id]) => st(id).status !== "done" || hidden.has(id)).map(([id, c]) => (
              <button key={id} onClick={() => toggle(id)} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-semibold" style={{ ...kc(c.color), background: "#fff", borderColor: P.line, opacity: hidden.has(id) ? 0.35 : 1 }} title="Bấm để ẩn/hiện lớp"><span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--k)" }} />{c.name}</button>
            ))}</div>
          )}
          {view === "week" ? <WeekV /> : view === "month" ? <MonthV /> : <ClassesV />}
        </>
      )}
      {dlg?.k === "s" && courses[dlg.cid] && <SessionDlg key={dlg.cid + dlg.ds} cid={dlg.cid} ds={dlg.ds} c={courses[dlg.cid]} g={all.gen[dlg.cid]} editable={editable} close={() => setDlg(null)} mutate={mutate} toast={toast} openCourse={() => setDlg({ k: "c", cid: dlg.cid })} />}
      {dlg?.k === "c" && courses[dlg.cid] && <CourseDlg cid={dlg.cid} c={courses[dlg.cid]} g={all.gen[dlg.cid]} x={st(dlg.cid)} editable={editable} close={() => setDlg(null)} mutate={mutate} toast={toast} openS={openS} edit={() => setDlg({ k: "form", cid: dlg.cid })} unschedule={async () => { if (!confirm(`Gỡ lịch của lớp “${courses[dlg.cid].name}”? (lớp và danh sách học viên vẫn giữ nguyên)`)) return; setDlg(null); try { await updateDoc(doc(db, "classes", dlg.cid), { tkb: deleteField() }); toast("Đã gỡ lịch lớp"); } catch (e) { toast("Lỗi: " + e.message); } }} />}
      {dlg?.k === "day" && <DayDlg ds={dlg.ds} list={all.byDate[dlg.ds] || []} courses={courses} hol={hol} editable={editable} close={() => setDlg(null)} openS={openS} saveHol={saveHol} />}
      {dlg?.k === "form" && <FormDlg cid={dlg.cid} attach={dlg.attach} courses={courses} all={all} hol={hol} unsched={unsched} raw={raw} close={() => setDlg(null)} toast={toast} onSaved={(first) => { if (first) setCur(parse(first)); }} />}
      {toastMsg && <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-6 z-[90] px-4 py-2.5 rounded-[10px] text-sm font-semibold text-white" style={{ background: P.ink }}>{toastMsg}</div>}
    </div>
  );
}

const SessToday = ({ s, c, onClick }) => (
  <button onClick={onClick} className={`flex gap-2.5 items-center rounded-[9px] px-3 py-1.5 text-left ${isPast(s) ? "opacity-55" : ""}`} style={{ ...kc(c.color), background: "var(--t)", borderLeft: "4px solid var(--k)" }}>
    <span className="font-extrabold tabular-nums" style={{ color: "var(--k)" }}>{tm(s)}</span>
    <span><span className="block text-[13px] leading-tight" style={{ color: P.mute }}>{c.name}</span><span className="block font-bold leading-tight">{s.lesson}</span></span>
  </button>
);

function Act({ ico, t, sub, open, onClick }) {
  return <button type="button" onClick={onClick} className="flex gap-3 items-center rounded-[12px] border p-2.5 text-left w-full" style={{ borderColor: open ? P.ink : P.line, background: "#fff" }}><span className="w-8 h-8 rounded-[9px] grid place-items-center shrink-0" style={{ background: P.soft }}>{ico}</span><span><b className="block text-[14.5px]">{t}</b><small className="block text-[12.5px]" style={{ color: P.mute }}>{sub}</small></span></button>;
}
const Sub = ({ children }) => <div className="grid gap-2.5 rounded-[12px] border p-3" style={{ borderColor: P.line, background: P.soft }}>{children}</div>;

function SessionDlg({ cid, ds, c, g, editable, close, mutate, toast, openCourse }) {
  const s = g.list.find((x) => x.date === ds);
  const [open, setOpen] = useState("");
  const [f, setF] = useState({ reason: "", date: s ? ymd(addD(parse(ds), 1)) : "", st: s?.start, en: s?.end, name: s?.lesson || "", ins: "Ôn tập", note: s?.note || "" });
  if (!s) return null;
  const L = !s.off && lessonLinks(c, s.lesson);
  const go = async (fn, ok) => { close(); await mutate(cid, fn, ok); };
  const tog = (k) => setOpen(open === k ? "" : k);
  return (
    <Modal open onClose={close} color={c.color} title={c.name}>
      <div className="grid gap-1">
        <div className="font-semibold" style={{ color: P.mute }}>{fmtD(ds)} · {tm(s)}{c.place ? " · " + c.place : ""}</div>
        <div className="text-[22px] font-extrabold leading-tight">{s.off ? (s.hol ? "Nghỉ lễ" : "Nghỉ buổi này") : s.lesson}</div>
        <div className="font-semibold" style={{ color: P.mute }}>{s.off ? s.reason : `Buổi ${s.no}/${(c.lessons || []).length}${s.extra ? " · buổi học bù" : ""}${isPast(s) ? " · đã học" : ""}`}</div>
        {s.note && <div className="font-semibold" style={{ color: P.mute }}>Ghi chú: {s.note}</div>}
      </div>
      {L && (
        <div className="flex gap-2 flex-wrap">
          <Link href={L.lecture} className={btn} style={{ background: P.red, color: "#fff", borderColor: P.red }}>📖 Mở bài giảng Bài {L.n}</Link>
          <Link href={L.conDuong} className={btn} style={{ background: "#fff", borderColor: P.line }}>⛰ Chuỗi ải tự học</Link>
        </div>
      )}
      {editable && (
        <div className="grid gap-2">
          {s.off && !s.hol && <Act ico="↺" t="Vẫn học buổi này" sub="Bỏ nghỉ, các bài sẽ tự xếp lại" onClick={() => go((c) => { delete c.cancel[ds]; }, "Đã khôi phục buổi học")} />}
          {s.hol && <div className="text-sm" style={{ color: P.mute }}>Ngày này là ngày nghỉ lễ chung cho tất cả các lớp. Bấm vào ngày trên lịch để bỏ.</div>}
          {!s.off && <>
            <Act ico="✕" t="Cho nghỉ buổi này" sub="Bài này và các bài sau tự lùi sang buổi kế tiếp" open={open === "cancel"} onClick={() => tog("cancel")} />
            {open === "cancel" && <Sub><Field label="Lý do (không bắt buộc)"><input className={inp} style={{ borderColor: P.line }} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="VD: Ốm, giáo viên bận" /></Field><B kind="pri" onClick={() => go((c) => { if (s.extra) delete c.extra[ds]; else c.cancel[ds] = f.reason.trim() || "Nghỉ"; }, "Đã cho nghỉ, các bài sau đã tự lùi")}>Xác nhận nghỉ</B></Sub>}
            <Act ico="→" t="Dời sang ngày khác" sub="Dạy bù vào một ngày khác" open={open === "move"} onClick={() => tog("move")} />
            {open === "move" && <Sub><Field label="Ngày dạy bù"><input type="date" className={inp} style={{ borderColor: P.line }} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field><div className="grid grid-cols-2 gap-2"><Field label="Từ"><TimeSel value={f.st} onChange={(v) => setF({ ...f, st: v })} /></Field><Field label="Đến"><TimeSel value={f.en} empty onChange={(v) => setF({ ...f, en: v })} /></Field></div>
              <B kind="pri" onClick={() => { const nd = f.date; if (!nd) return; const o = g.list.find((x) => x.date === nd); if (o && nd !== ds && !o.off) { toast("Ngày đó lớp đã có buổi học"); return; } go((c) => { if (s.extra) delete c.extra[ds]; else c.cancel[ds] = "Dời sang " + fmtS(nd); delete c.cancel[nd]; c.extra[nd] = { start: f.st, end: f.en || "" }; }, "Đã dời sang " + fmtS(nd)); }}>Dời buổi</B></Sub>}
            <Act ico="◷" t="Đổi giờ buổi này" sub="Chỉ đổi giờ của riêng buổi này" open={open === "time"} onClick={() => tog("time")} />
            {open === "time" && <Sub><div className="grid grid-cols-2 gap-2"><Field label="Từ"><TimeSel value={f.st} onChange={(v) => setF({ ...f, st: v })} /></Field><Field label="Đến"><TimeSel value={f.en} empty onChange={(v) => setF({ ...f, en: v })} /></Field></div><B kind="pri" onClick={() => go((c) => { if (s.extra) c.extra[ds] = { start: f.st, end: f.en || "" }; else c.ov[ds] = { start: f.st, end: f.en || "" }; }, "Đã đổi giờ")}>Lưu giờ</B></Sub>}
            <Act ico="✎" t="Sửa tên bài" sub="Đổi nội dung buổi này" open={open === "lesson"} onClick={() => tog("lesson")} />
            {open === "lesson" && <Sub><input className={inp} style={{ borderColor: P.line }} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /><B kind="pri" onClick={() => f.name.trim() && go((c) => { c.lessons[s.idx] = f.name.trim(); }, "Đã sửa tên bài")}>Lưu tên bài</B></Sub>}
            <Act ico="＋" t="Chèn buổi trước bài này" sub="VD: Ôn tập, Kiểm tra. Các bài sau tự lùi" open={open === "insert"} onClick={() => tog("insert")} />
            {open === "insert" && <Sub><input className={inp} style={{ borderColor: P.line }} value={f.ins} onChange={(e) => setF({ ...f, ins: e.target.value })} /><B kind="pri" onClick={() => f.ins.trim() && go((c) => { c.lessons.splice(s.idx, 0, f.ins.trim()); }, `Đã chèn “${f.ins.trim()}”`)}>Chèn buổi</B></Sub>}
            <Act ico="🗑" t="Bỏ buổi này khỏi giáo án" sub="Xoá nội dung buổi, các bài sau tự tiến lên" open={open === "drop"} onClick={() => tog("drop")} />
            {open === "drop" && <Sub><span className="text-sm">Xoá “{s.lesson}” khỏi danh sách bài của lớp?</span><B kind="danger" onClick={() => go((c) => { c.lessons.splice(s.idx, 1); }, "Đã bỏ buổi")}>Xoá buổi</B></Sub>}
          </>}
          <Act ico="☰" t="Ghi chú" sub="Bài tập về nhà, phòng học…" open={open === "note"} onClick={() => tog("note")} />
          {open === "note" && <Sub><textarea className={inp} style={{ borderColor: P.line }} rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /><B kind="pri" onClick={() => go((c) => { const v = f.note.trim(); if (v) c.notes[ds] = v; else delete c.notes[ds]; }, "Đã lưu ghi chú")}>Lưu ghi chú</B></Sub>}
        </div>
      )}
      <B onClick={openCourse}>Xem giáo án cả lớp</B>
    </Modal>
  );
}

function CourseDlg({ cid, c, g, x, editable, close, mutate, toast, openS, edit, unschedule }) {
  const [pause, setPause] = useState(false);
  const [pf, setPf] = useState({ from: today(), to: "" });
  const [resume, setResume] = useState("");
  const go = async (fn, ok) => { close(); await mutate(cid, fn, ok); };
  useEffect(() => { setTimeout(() => document.getElementById("tkb-next")?.scrollIntoView({ block: "center" }), 80); }, []);
  return (
    <Modal open onClose={close} color={c.color} wide title={<>{c.name} <span className="text-[11.5px] font-extrabold px-2 py-0.5 rounded-full align-middle" style={{ background: "var(--t)", color: "var(--k)" }}>{STL[x.status]}</span><div className="text-[13px] font-semibold" style={{ color: P.mute }}>{c.place}{c.series && SERIES[c.series] ? " · Giáo trình " + SERIES[c.series].label : ""}</div></>}>
      <div className="font-bold">{schedText(c)}</div>
      <div className="grid grid-cols-3 gap-2">
        {[[`${x.taught}/${x.total}`, "buổi đã học"], [x.first ? dm(x.first.date) : "–", "buổi đầu"], [x.status === "paused" ? "–" : x.last ? dm(x.last.date) : "–", x.status === "done" ? "buổi cuối" : "dự kiến kết thúc"]].map(([a, b]) => <div key={b} className="rounded-[10px] p-2.5" style={{ background: P.soft }}><b className="block text-[19px]">{a}</b><small className="font-semibold" style={{ color: P.mute }}>{b}</small></div>)}
      </div>
      {editable && (
        <div className="flex gap-2 flex-wrap">
          <B onClick={edit}>Sửa lớp & giáo án</B>
          {x.status === "paused" ? <B kind="pri" onClick={() => setResume(today())}>Học tiếp từ ngày…</B> : x.status !== "done" && <B onClick={() => setPause(!pause)}>Tạm dừng / nghỉ một đợt</B>}
          <B onClick={() => go((c) => { c.archived = !c.archived; }, c.archived ? "Đã mở lại lớp" : "Đã chuyển sang Đã kết thúc")}>{c.archived ? "Mở lại lớp" : "Kết thúc lớp"}</B>
          <B kind="danger" onClick={unschedule}>Gỡ lịch</B>
        </div>
      )}
      {pause && <Sub><div className="grid grid-cols-2 gap-2"><Field label="Nghỉ từ ngày"><input type="date" className={inp} style={{ borderColor: P.line }} value={pf.from} onChange={(e) => setPf({ ...pf, from: e.target.value })} /></Field><Field label="Học lại từ ngày" hint="Để trống nếu chưa biết (tạm dừng)"><input type="date" className={inp} style={{ borderColor: P.line }} value={pf.to} onChange={(e) => setPf({ ...pf, to: e.target.value })} /></Field></div>
        <B kind="pri" onClick={() => { if (pf.to && pf.to <= pf.from) { toast("Ngày học lại phải sau ngày nghỉ"); return; } go((c) => { c.breaks = c.breaks || []; c.breaks.push(pf.to ? { from: pf.from, to: ymd(addD(parse(pf.to), -1)) } : { from: pf.from }); }, pf.to ? `Đã cho nghỉ từ ${dm(pf.from)} đến hết ${dm(ymd(addD(parse(pf.to), -1)))}` : "Đã tạm dừng lớp"); }}>Lưu</B></Sub>}
      {resume && <Sub><Field label="Học lại từ ngày"><input type="date" className={inp} style={{ borderColor: P.line }} value={resume} onChange={(e) => setResume(e.target.value)} /></Field>
        <B kind="pri" onClick={() => { const b = (c.breaks || []).find((z) => !z.to); if (!b) return; if (resume <= b.from) { toast("Ngày học lại phải sau ngày tạm dừng (" + dm(b.from) + ")"); return; } go((c) => { const z = c.breaks.find((q) => !q.to); z.to = ymd(addD(parse(resume), -1)); }, "Lớp học tiếp từ " + fmtS(resume)); }}>Lưu</B></Sub>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="text-left text-xs" style={{ color: P.mute }}><th className="p-2">#</th><th className="p-2">Ngày</th><th className="p-2">Giờ</th><th className="p-2">Bài giảng</th></tr></thead>
          <tbody>
            {g.list.map((s) => { const L = !s.off && lessonLinks(c, s.lesson); const nxt = x.next && x.next.date === s.date; return (
              <tr key={s.date} id={nxt ? "tkb-next" : undefined} onClick={() => openS(s)} className="cursor-pointer border-t" style={{ borderColor: P.line, background: nxt ? "var(--t)" : undefined, color: s.off || isPast(s) ? P.mute : undefined, fontStyle: s.off ? "italic" : undefined }}>
                <td className="p-2 tabular-nums whitespace-nowrap">{s.off ? "" : s.no}{!s.off && isPast(s) && <span style={{ color: "#3C8A2E" }}> ✓</span>}</td>
                <td className="p-2 whitespace-nowrap tabular-nums">{fmtS(s.date)}</td>
                <td className="p-2 whitespace-nowrap tabular-nums">{tm(s)}</td>
                <td className="p-2"><span className={s.off ? "" : "font-bold"}>{s.off ? (s.hol ? "Nghỉ lễ" : "Nghỉ") + (s.reason && !/^Nghỉ( lễ)?$/.test(s.reason) ? " · " + s.reason : "") : s.lesson}</span>{s.extra && <span className="text-xs" style={{ color: P.mute }}> (học bù)</span>}
                  {L && <Link href={L.lecture} onClick={(e) => e.stopPropagation()} className="ml-2 text-xs font-bold underline" style={{ color: P.red }}>bài giảng</Link>}
                  {s.note && <div className="text-xs" style={{ color: P.mute }}>{s.note}</div>}</td>
              </tr>); })}
            {g.left > 0 && (c.lessons || []).slice(c.lessons.length - g.left).map((l, i) => <tr key={"l" + i} className="border-t" style={{ borderColor: P.line, color: P.mute }}><td className="p-2">{c.lessons.length - g.left + i + 1}</td><td className="p-2" colSpan={2}>Chưa xếp lịch</td><td className="p-2">{l}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function DayDlg({ ds, list, courses, hol, editable, close, openS, saveHol }) {
  const [name, setName] = useState("");
  const isH = hol[ds] !== undefined;
  return (
    <Modal open onClose={close} title={fmtD(ds)}>
      {list.length ? <div className="grid gap-1.5">{list.map((s) => <SessBlock key={s.cid} s={s} c={courses[s.cid]} onClick={() => openS(s)} />)}</div> : <div className="text-sm" style={{ color: P.mute }}>Không có buổi học nào.</div>}
      {editable && (isH ? <B onClick={() => { const h = { ...hol }; delete h[ds]; close(); saveHol(h, "Đã bỏ ngày nghỉ lễ"); }}>Bỏ ngày nghỉ lễ</B> : (
        <Sub><b>Nghỉ lễ cả ngày cho tất cả lớp</b><span className="text-xs" style={{ color: P.mute }}>Mọi buổi học hôm nay chuyển thành nghỉ, bài của từng lớp tự lùi sang buổi sau.</span>
          <input className={inp} style={{ borderColor: P.line }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên ngày lễ (không bắt buộc)" />
          <B kind="pri" onClick={() => { close(); saveHol({ ...hol, [ds]: name.trim() }, "Đã đặt ngày nghỉ lễ"); }}>Đặt ngày nghỉ lễ</B></Sub>
      ))}
    </Modal>
  );
}

function FormDlg({ cid, attach, courses, all, hol, unsched, raw, close, toast, onSaved }) {
  const c0 = cid ? courses[cid] : null;
  const seg0 = useMemo(() => { if (!c0) return null; const s = [...c0.sched].sort((a, b) => a.from.localeCompare(b.from)); let x = null; for (const z of s) if (z.from <= today()) x = z; return x || s[s.length - 1] || s[0] || null; }, []); // eslint-disable-line
  const used = new Set(Object.values(courses).map((x) => x.color));
  const started = !!(c0 && stat(c0, all.gen[cid]).taught > 0);
  const [target, setTarget] = useState(cid || attach || "new");   // lớp có sẵn để gắn lịch, hoặc "new"
  const [name, setName] = useState(c0?.name || (attach ? raw[attach]?.className : "") || "");
  const [place, setPlace] = useState(c0?.place || "");
  const [color, setColor] = useState(c0?.color || COLOR_KEYS.find((x) => !used.has(x)) || "teal");
  const [days, setDays] = useState(() => new Map((seg0?.days || []).map((x) => [x.d, { start: x.start, end: x.end || "" }])));
  const [diff, setDiff] = useState(() => new Set((seg0?.days || []).map((x) => tm(x))).size > 1);
  const [startT, setStartT] = useState(seg0?.days?.[0]?.start || "19:00");
  const [endT, setEndT] = useState(seg0?.days?.[0]?.end ?? "20:45");
  const [from, setFrom] = useState(c0 ? firstDate(c0) : ymd(addD(new Date(), 1)));
  const [apply, setApply] = useState(today());
  const [tpl, setTpl] = useState(c0 ? c0.tpl || "custom" : guessTpl(name) || "");
  const [tplFrom, setTplFrom] = useState(1);
  const [series, setSeries] = useState(c0?.series || (c0?.tpl && TPL[c0.tpl]?.series) || (guessTpl(name) && TPL[guessTpl(name)].series) || "");
  const [lessons, setLessons] = useState(() => (c0?.lessons || []).join("\n") || (guessTpl(name) ? tplLessons(guessTpl(name), 1).join("\n") : ""));
  const [warn, setWarn] = useState("");
  const [busy, setBusy] = useState(false);
  const origSeg = seg0 ? JSON.stringify(seg0.days.slice().sort((a, b) => a.d - b.d)) : null;
  const curDays = () => [...days.keys()].sort().map((d) => (diff ? { d, start: days.get(d).start, end: days.get(d).end || "" } : { d, start: startT, end: endT }));
  const L = lessons.split("\n").map((x) => x.trim()).filter(Boolean);
  const build = () => {
    const c = c0 ? clone(c0) : { ...emptyTkb(), order: Object.keys(courses).length };
    delete c.name; delete c.level;
    Object.assign(c, { place: place.trim(), color, lessons: L, tpl: tpl && tpl !== "custom" ? tpl : null, series });
    const ds = curDays();
    if (!c0 || !started) { c.sched = [{ from, days: ds }]; if (c0) for (const k of Object.keys(c.extra)) if (k < from) delete c.extra[k]; }
    else if (origSeg !== JSON.stringify(ds)) { c.sched = c.sched.filter((s) => s.from < apply); c.sched.push({ from: apply, days: ds }); }
    return c;
  };
  const pickTpl = (k) => {
    if (k !== "custom" && lessons.trim() && tpl !== k && !confirm("Thay danh sách bài hiện tại bằng giáo trình " + TPL[k].name + "?")) return;
    setTpl(k); if (k !== "custom") { setTplFrom(1); setLessons(tplLessons(k, 1).join("\n")); if (!series) setSeries(TPL[k].series); }
  };
  // xem trước
  let prev = "Chọn các thứ học trong tuần để xem lịch dự kiến.";
  const ds = curDays();
  if (ds.length && L.length) {
    const c = build(); const g = gen(c, cid || "__new", hol); const r = g.list.filter((s) => !s.off);
    if (r.length) {
      let clash = 0; const ex = [];
      r.forEach((s) => (all.byDate[s.date] || []).forEach((o) => { if (o.cid === cid || o.off) return; const a1 = mins(s.start), a2 = mins(s.end) ?? a1 + 90, b1 = mins(o.start), b2 = mins(o.end) ?? b1 + 90; if (a1 < b2 && b1 < a2) { clash++; if (ex.length < 2) ex.push(`${fmtS(s.date)} trùng ${courses[o.cid].name}`); } }));
      prev = <>Lớp có <b>{r.length} buổi</b>, buổi đầu <b>{fmtS(r[0].date)}</b> ({r[0].lesson}), buổi cuối <b>{fmtS(r[r.length - 1].date)}/{parse(r[r.length - 1].date).getFullYear()}</b> ({r[r.length - 1].lesson}).{g.left > 0 && <><br />Còn {g.left} bài chưa xếp lịch vì lớp đang tạm dừng.</>}{clash > 0 && <><br /><span className="font-bold" style={{ color: P.red }}>⚠ {clash} buổi trùng giờ lớp khác, ví dụ: {ex.join("; ")}.</span></>}</>;
    } else prev = "Chưa xếp được buổi nào.";
  } else if (ds.length) prev = "Thêm danh sách bài để lịch tự xếp vào từng buổi.";
  const changed = started && origSeg !== JSON.stringify(ds);
  const save = async () => {
    const msg = target === "new" && !name.trim() ? "Hãy nhập tên lớp." : !days.size && !Object.keys(c0?.extra || {}).length ? "Hãy chọn ít nhất một thứ học trong tuần." : !L.length ? "Hãy thêm ít nhất một bài giảng." : "";
    if (msg) { setWarn(msg); return; }
    setBusy(true);
    try {
      const tkb = build();
      if (target === "new") await addDoc(collection(db, "classes"), { className: name.trim(), level: tpl && TPL[tpl] ? TPL[tpl].name : "", students: [], createdAt: serverTimestamp(), tkb });
      else { const upd = { tkb }; if (name.trim() && name.trim() !== raw[target]?.className) upd.className = name.trim(); await updateDoc(doc(db, "classes", target), upd); }
      toast(cid ? "Đã lưu lớp" : `Đã xếp lịch ${L.length} buổi`);
      const f = gen(tkb, "x", hol).list.find((s) => !s.off); close(); if (!cid && f) onSaved(f.date);
    } catch (e) { setWarn("Không lưu được: " + (e.code || e.message)); setBusy(false); }
  };
  const step = (n, t, children) => <section className="grid gap-3 rounded-[14px] border p-3.5" style={{ borderColor: P.line, background: "#fff" }}><h3 className="m-0 text-[15px] font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-full grid place-items-center text-[13px] text-white" style={{ background: P.ink }}>{n}</span>{t}</h3>{children}</section>;
  return (
    <Modal open onClose={close} wide title={cid ? "Sửa lớp & giáo án" : "Thêm lớp / xếp lịch"}>
      {step(1, "Thông tin lớp", <>
        {!cid && <Field label="Lớp" hint="Chọn lớp đã tạo ở trang giáo viên (có danh sách học viên), hoặc tạo lớp mới.">
          <select className={inp} style={{ borderColor: P.line }} value={target} onChange={(e) => { setTarget(e.target.value); const x = raw[e.target.value]; if (x) { setName(x.className || ""); const gt = guessTpl(x.className + " " + (x.level || "")); if (gt && !lessons.trim()) { setTpl(gt); setLessons(tplLessons(gt, 1).join("\n")); setSeries(TPL[gt].series); } } }}>
            <option value="new">＋ Lớp mới</option>{unsched.map((x) => <option key={x.id} value={x.id}>{x.className}{x.level ? " · " + x.level : ""} ({(x.students || []).length} học viên)</option>)}
          </select></Field>}
        <Field label="Tên lớp"><input className={inp} style={{ borderColor: P.line }} value={name} onChange={(e) => { setName(e.target.value); if (!cid && !lessons.trim()) { const g = guessTpl(e.target.value); if (g) { setTpl(g); setLessons(tplLessons(g, 1).join("\n")); setSeries(TPL[g].series); } } }} placeholder="VD: HSK4 – MC272" /></Field>
        <Field label="Cơ sở / hình thức"><input className={inp} style={{ borderColor: P.line }} value={place} onChange={(e) => setPlace(e.target.value)} list="tkb-places" placeholder="VD: CS Bắc Giang, Online" /><datalist id="tkb-places">{[...new Set(Object.values(courses).map((x) => x.place).filter(Boolean))].map((p) => <option key={p} value={p} />)}</datalist></Field>
        <Field label="Màu"><div className="flex gap-1.5 flex-wrap">{COLOR_KEYS.map((k) => <button key={k} type="button" onClick={() => setColor(k)} className="w-8 h-8 rounded-[8px]" style={{ background: COLORS[k][0], outline: color === k ? `2px solid ${P.ink}` : "none", outlineOffset: 2 }} aria-label={k} />)}</div></Field>
      </>)}
      {step(2, "Lịch học trong tuần", <>
        <Field label="Học vào các thứ"><div className="flex gap-1.5 flex-wrap">{DS.map((d, i) => <button key={d} type="button" onClick={() => { const n = new Map(days); n.has(i) ? n.delete(i) : n.set(i, { start: startT, end: endT }); setDays(n); }} className="w-11 py-2 rounded-[9px] border font-bold text-sm" style={days.has(i) ? { background: P.ink, color: "#fff", borderColor: P.ink } : { borderColor: P.line }}>{d}</button>)}</div></Field>
        {!diff ? <div className="grid grid-cols-2 gap-2"><Field label="Giờ bắt đầu"><TimeSel value={startT} onChange={setStartT} /></Field><Field label="Giờ kết thúc"><TimeSel value={endT} empty onChange={setEndT} /></Field></div>
          : <div className="grid gap-2">{[...days.keys()].sort().map((d) => <div key={d} className="grid grid-cols-[48px_1fr_1fr] gap-2 items-center font-bold text-sm"><span>{DS[d]}</span><TimeSel value={days.get(d).start} onChange={(v) => { const n = new Map(days); n.set(d, { ...n.get(d), start: v }); setDays(n); }} /><TimeSel value={days.get(d).end} empty onChange={(v) => { const n = new Map(days); n.set(d, { ...n.get(d), end: v }); setDays(n); }} /></div>)}</div>}
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={diff} onChange={(e) => { setDiff(e.target.checked); if (e.target.checked) { const n = new Map(); days.forEach((v, k) => n.set(k, { start: v.start || startT, end: v.end ?? endT })); setDays(n); } }} /> Mỗi thứ học giờ khác nhau</label>
        <div className="grid grid-cols-2 gap-2">
          {!started && <Field label="Ngày học buổi đầu"><input type="date" className={inp} style={{ borderColor: P.line }} value={from} onChange={(e) => setFrom(e.target.value)} /></Field>}
          {changed && <Field label="Lịch mới áp dụng từ ngày" hint="Các buổi trước ngày này giữ nguyên lịch cũ."><input type="date" className={inp} style={{ borderColor: P.line }} value={apply} onChange={(e) => setApply(e.target.value)} /></Field>}
        </div>
      </>)}
      {step(3, "Giáo án (danh sách buổi) & bài giảng", <>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{[...Object.entries(TPL).map(([k, v]) => [k, v.name, v.sub]), ["custom", "Tự nhập", "Lớp khác"]].map(([k, n, s]) => <button key={k} type="button" onClick={() => pickTpl(k)} className="text-left rounded-[12px] border p-2.5" style={{ borderColor: tpl === k ? P.red : P.line, boxShadow: tpl === k ? `inset 0 0 0 1px ${P.red}` : "none" }}><b className="block">{n}</b><small style={{ color: P.mute }}>{s}</small></button>)}</div>
        {TPL[tpl] && <div className="grid gap-2 rounded-[12px] p-3" style={{ background: P.soft }}><ol className="m-0 pl-5 text-[13px] leading-relaxed">{TPL[tpl].desc.map((d) => <li key={d}>{d}</li>)}</ol>
          <Field label="Lớp bắt đầu từ bài"><select className={inp} style={{ borderColor: P.line }} value={tplFrom} onChange={(e) => { setTplFrom(+e.target.value); setLessons(tplLessons(tpl, +e.target.value).join("\n")); }}>{[...Array(TPL[tpl].bai)].map((_, i) => <option key={i} value={i + 1}>Bài {i + 1}{i === 0 ? " (lớp mới)" : ""}</option>)}</select></Field></div>}
        <Field label="Liên kết bài giảng trên web" hint="Buổi “Lesson N…” sẽ có nút mở Bài N của giáo trình này."><select className={inp} style={{ borderColor: P.line }} value={series} onChange={(e) => setSeries(e.target.value)}><option value="">— Không liên kết —</option>{Object.entries(SERIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
        <Field label={`Mỗi dòng là một buổi, theo đúng thứ tự dạy · ${L.length} buổi`}><textarea className={inp} style={{ borderColor: P.line }} rows={8} value={lessons} onChange={(e) => setLessons(e.target.value)} placeholder={"Lesson 1\nLesson 2\nÔn tập\n…"} /></Field>
        <div className="flex gap-1.5 flex-wrap">{["Ôn tập", "Kiểm tra"].map((q) => <B key={q} onClick={() => setLessons((lessons.replace(/\s+$/, "") ? lessons.replace(/\s+$/, "") + "\n" : "") + q)}>＋ {q}</B>)}</div>
      </>)}
      <div className="rounded-[12px] p-3 text-sm leading-relaxed" style={{ background: P.soft }}>{prev}</div>
      {warn && <div className="text-sm font-bold" style={{ color: P.red }}>{warn}</div>}
      <div className="flex justify-end gap-2 sticky bottom-0 py-2" style={{ background: P.paper }}><B onClick={close}>Huỷ</B><B kind="pri" onClick={save} disabled={busy}>{busy ? "Đang lưu…" : "Lưu lớp"}</B></div>
    </Modal>
  );
}
