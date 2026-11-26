"use client";
// 星盘 · Bản đồ sao (chiêm tinh phương Tây): cung Mặt Trời, Mặt Trăng, cung Mọc, MC, 10 hành tinh + La Hầu,
// 12 nhà Placidus, góc chiếu, nguyên tố/tính chất/hành tinh/cung/nhà trội, vòng tròn bản đồ sao và luận giải AI.
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Shell, Panel, H2, usePy, Speak, C } from "../ui";
import { chart as makeChart, dominance, SIGNS, PLANETS, ASPECTS, ELEM, MODE, signOf, degIn, norm } from "../../../lib/astro";
import { SIGN_TXT, PLANET_TXT, HOUSE_TXT, ASPECT_TXT, ELEM_TXT, MODE_TXT, VOCAB, PLACES } from "../../../lib/astro-data";

const inp = "h-10 px-3 rounded-[8px] border text-[15px] focus:outline-none";
const inpS = { background: "#262A31", borderColor: "#363B45", color: "#ECE4D3" };
const T = (g) => g + "︎";
const sym = { fontFamily: "'Segoe UI Symbol','Noto Sans Symbols 2','Noto Sans Symbols','Apple Symbols',serif" };
const PK = Object.fromEntries(PLANETS.map((p) => [p.k, p]));
const AI_SEC = [["tong_quan", "总论", "Tổng quan"], ["bo_ba", "三巨头", "Bộ ba Mặt Trời – Mặt Trăng – Cung Mọc"], ["tinh_cach", "性格", "Tính cách"], ["tinh_cam", "感情", "Tình cảm"], ["su_nghiep", "事业", "Sự nghiệp"], ["tai_chinh", "财运", "Tài chính"], ["goc_chieu", "相位", "Góc chiếu nổi bật"], ["nam_nay", "流年", "Năm nay"]];

export default function ChiemTinh() {
  const py = usePy();
  const [f, setF] = useState({ name: "", date: "2000-01-01", time: "12:00", place: 0, lat: PLACES[0][1], lon: PLACES[0][2], tz: 7, unknown: false });
  const [c, setC] = useState(null); const [err, setErr] = useState(""); const [sel, setSel] = useState(null);
  const [ai, setAi] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem("astro_form") || "null"); if (s) setF((x) => ({ ...x, ...s })); else { const t = JSON.parse(localStorage.getItem("tuvi_form") || "null"); if (t?.date) setF((x) => ({ ...x, name: t.name || "", date: t.date })); } } catch {} }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setPlace = (i) => { const p = PLACES[i]; if (p) setF((x) => ({ ...x, place: i, lat: p[1], lon: p[2], tz: p[3] })); else set("place", -1); };

  const make = () => {
    setErr(""); setAi(null); setSel(null);
    try {
      const [y, m, d] = f.date.split("-").map(Number); const [hh, mm] = (f.unknown ? "12:00" : f.time).split(":").map(Number);
      const utc = new Date(Date.UTC(y, m - 1, d, hh, mm) - Number(f.tz) * 3600000);
      if (isNaN(utc)) throw new Error("ngày giờ");
      const ch = makeChart(utc, Number(f.lat), Number(f.lon));
      setC({ ...ch, dom: dominance(ch), unknown: f.unknown });
      try { localStorage.setItem("astro_form", JSON.stringify(f)); } catch {}
      setTimeout(() => document.getElementById("chart")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) { setErr("Ngày giờ hoặc nơi sinh chưa hợp lệ."); }
  };
  const P = (k) => c?.points.find((x) => x.k === k);

  const chartText = () => {
    const pl = c.points.map((p) => `${p.vi}: ${p.sign.vi} ${p.deg}${p.house ? `, nhà ${p.house}` : ""}${p.retro ? ", nghịch hành" : ""}`).join("; ");
    const asp = c.aspects.slice(0, 14).map((a) => `${a.a.vi} ${a.t.vi} ${a.b.vi} (lệch ${a.orb.toFixed(1)}°)`).join("; ");
    const d = c.dom;
    return [`Đương số: ${f.name || "—"}. Sinh ${f.date} ${f.unknown ? "(không rõ giờ — bỏ qua cung Mọc, nhà)" : f.time} giờ địa phương (UTC${f.tz >= 0 ? "+" : ""}${f.tz}), toạ độ ${(+f.lat).toFixed(2)}, ${(+f.lon).toFixed(2)}.`,
      `Vị trí: ${pl}.`, `Đỉnh 12 nhà: ${c.cusps.map((x, i) => `${i + 1}:${signOf(x).vi} ${degIn(x)}`).join(", ")}.`, `Góc chiếu: ${asp}.`,
      `Nguyên tố %: ${Object.entries(d.elPct).map(([k, v]) => `${ELEM[k].vi} ${v}`).join(", ")}. Tính chất %: ${Object.entries(d.moPct).map(([k, v]) => `${MODE[k].vi} ${v}`).join(", ")}.`,
      `Hành tinh trội: ${d.planet.slice(0, 3).map(([k]) => PK[k].vi).join(", ")}. Cung trội: ${d.sign.slice(0, 2).map(([k]) => SIGNS.find((s) => s.k === k).vi).join(", ")}. Nhà nhiều hành tinh: ${d.house.slice(0, 2).map(([h]) => h).join(", ")}. Chủ quản cung Mọc: ${PK[d.ascRuler].vi}.`].join("\n");
  };
  const askAI = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/chiem-tinh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chart: chartText(), year: new Date().getFullYear() }) });
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || "Lỗi " + r.status); setAi(d);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };

  return (
    <Shell title="Bản đồ sao · 星盘">
      <div className="flex items-center gap-2 text-[13px] mb-3" style={{ color: C.mute }}><Link href="/huyen-hoc" className="hover:underline">‹ 玄门学宫</Link></div>
      <header className="mb-4">
        <div className="font-zh text-[14px]" style={{ color: C.gold }}>西洋占星 · 个人星盘</div>
        <h1 className="font-serif-vn text-[28px] md:text-[34px] font-extrabold">Cung hoàng đạo · Bản đồ sao</h1>
        <p className="text-[14px]" style={{ color: C.mute }}>Lập bản đồ sao cá nhân theo ngày, giờ, nơi sinh: cung Mặt Trời, Mặt Trăng, cung Mọc, 10 hành tinh trong 12 nhà, các góc chiếu và yếu tố trội. Nội dung mang tính văn hoá – tham khảo.</p>
      </header>

      <Panel className="mb-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Họ tên (tuỳ chọn)<input className={inp} style={inpS} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Ngày sinh (dương lịch)<input type="date" className={inp} style={inpS} value={f.date} onChange={(e) => set("date", e.target.value)} /></label>
          <div className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Giờ sinh (chính xác đến phút)
            <div className="flex items-center gap-2"><input type="time" className={inp + " flex-1"} style={inpS} value={f.time} disabled={f.unknown} onChange={(e) => set("time", e.target.value)} />
              <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" checked={f.unknown} onChange={(e) => set("unknown", e.target.checked)} /> không rõ giờ</label></div>
          </div>
          <label className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Nơi sinh
            <select className={inp} style={inpS} value={f.place} onChange={(e) => setPlace(+e.target.value)}>{PLACES.map((p, i) => <option key={i} value={i}>{p[0]}</option>)}<option value={-1}>Nơi khác — tự nhập toạ độ</option></select>
          </label>
          {f.place === -1 && (
            <div className="sm:col-span-2 grid grid-cols-3 gap-2 text-[13px]" style={{ color: C.mute }}>
              <label className="grid gap-1">Vĩ độ (Bắc +)<input className={inp} style={inpS} value={f.lat} onChange={(e) => set("lat", e.target.value)} /></label>
              <label className="grid gap-1">Kinh độ (Đông +)<input className={inp} style={inpS} value={f.lon} onChange={(e) => set("lon", e.target.value)} /></label>
              <label className="grid gap-1">Múi giờ UTC<input className={inp} style={inpS} value={f.tz} onChange={(e) => set("tz", e.target.value)} /></label>
            </div>
          )}
        </div>
        <p className="text-[12px] mt-2" style={{ color: C.mute }}>Cung Mọc đổi khoảng mỗi 2 giờ, các nhà đổi theo phút — giờ sinh càng chính xác càng tốt. Sinh ở miền Nam trước 1975 thường dùng giờ UTC+8: chọn &quot;Nơi khác&quot; và sửa múi giờ.</p>
        <button onClick={make} className="mt-4 w-full h-11 rounded-[8px] font-bold" style={{ background: C.gold, color: "#16181C" }}>排星盘 · Lập bản đồ sao</button>
        {err && !c && <p className="text-[14px] mt-2" style={{ color: C.red }}>{err}</p>}
      </Panel>

      {c && (
        <div id="chart" className="flex flex-col gap-4 scroll-mt-20">
          {/* Bộ ba lớn */}
          <div className="grid sm:grid-cols-3 gap-3">
            {[["sun", "太阳星座", "Cung Mặt Trời", "sun"], ["moon", "月亮星座", "Cung Mặt Trăng", "moon"], ["asc", "上升星座", "Cung Mọc", "asc"]].map(([k, zh, vi, t]) => { const p = P(k); if (k === "asc" && c.unknown) return <Panel key={k}><div className="text-[12px]" style={{ color: C.mute }}>{vi}</div><p className="text-[14px] mt-1">Cần giờ sinh để tính cung Mọc.</p></Panel>; return (
              <Panel key={k}>
                <div className="flex items-center gap-1.5 text-[12px]" style={{ color: C.mute }}><span className="font-zh">{zh}</span> · {vi}</div>
                <div className="flex items-baseline gap-2 mt-1"><span className="text-[34px] leading-none" style={{ ...sym, color: ELEM[p.sign.el].c }}>{T(p.sign.g)}</span><b className="text-[22px]">{p.sign.vi}</b></div>
                <div className="text-[13px]" style={{ color: C.mute }}><span className="font-zh">{p.sign.zh}</span> · {p.deg}{p.house ? ` · nhà ${p.house}` : ""} · {ELEM[p.sign.el].vi}</div>
                <p className="text-[14px] mt-2 leading-6">{SIGN_TXT[p.sign.k][t]}</p>
              </Panel>
            ); })}
          </div>

          {/* Vòng bản đồ sao */}
          <Panel>
            <H2 zh="星盘" right={f.name}>Bản đồ sao</H2>
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
              <Wheel c={c} sel={sel} onSel={setSel} />
              <div className="text-[14px]">
                {sel ? <PointInfo p={c.points.find((x) => x.k === sel)} c={c} /> : <p style={{ color: C.mute }}>Bấm vào một hành tinh trên vòng tròn hoặc trong bảng để xem ý nghĩa. Đường đỏ: góc căng (vuông, đối); xanh dương: góc hài hoà (tam hợp, lục hợp); xanh lá: hợp.</p>}
              </div>
            </div>
          </Panel>

          {/* Bảng hành tinh */}
          <Panel>
            <H2 zh="行星">Vị trí các hành tinh</H2>
            <div className="grid gap-px rounded-[8px] overflow-hidden text-[13px] md:text-[14px]" style={{ background: C.line }}>
              {c.points.filter((p) => !(c.unknown && (p.k === "asc" || p.k === "mc"))).map((p) => (
                <button key={p.k} onClick={() => { setSel(p.k); document.getElementById("chart")?.scrollIntoView({ behavior: "smooth" }); }} className="grid grid-cols-[28px_1fr_1fr_48px] md:grid-cols-[32px_1.2fr_1.2fr_60px_1.6fr] items-center gap-2 px-3 py-2 text-left" style={{ background: C.card }}>
                  <span className="text-[18px] text-center" style={{ ...sym, color: C.gold }}>{T(p.g)}</span>
                  <span><b>{p.vi}</b> <span className="font-zh text-[12px]" style={{ color: C.mute }}>{p.zh}</span></span>
                  <span><span style={{ ...sym, color: ELEM[p.sign.el].c }}>{T(p.sign.g)}</span> {p.sign.vi} <span style={{ color: C.mute }}>{p.deg}</span>{p.retro && <b className="ml-1 text-[11px]" style={{ color: C.red }} title="Nghịch hành 逆行">R</b>}</span>
                  <span className="text-right" style={{ color: C.mute }}>{p.house && !c.unknown ? `nhà ${p.house}` : ""}</span>
                  <span className="hidden md:block text-[12px]" style={{ color: C.mute }}>{PLANET_TXT[p.k]}</span>
                </button>
              ))}
            </div>
          </Panel>

          {/* Trội */}
          <Panel>
            <H2 zh="主导">Yếu tố trội</H2>
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <div className="text-[13px] mb-2" style={{ color: C.mute }}>Nguyên tố 元素</div>
                {Object.entries(c.dom.elPct).map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-[14px] mb-1.5"><span><b style={{ color: ELEM[k].c }}>{ELEM[k].vi}</b> <span className="font-zh text-[12px]" style={{ color: C.mute }}>{ELEM[k].zh}</span></span><div className="h-2.5 rounded-full" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${v}%`, background: ELEM[k].c }} /></div><span className="text-right">{v}%</span></div>)}
                <div className="text-[13px] mb-2 mt-4" style={{ color: C.mute }}>Tính chất 模式</div>
                {Object.entries(c.dom.moPct).map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr_40px] items-center gap-2 text-[14px] mb-1.5"><span className="text-[13px]">{MODE[k].vi.split(" (")[0]} <span className="font-zh text-[12px]" style={{ color: C.mute }}>{MODE[k].zh}</span></span><div className="h-2.5 rounded-full" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${v}%`, background: C.gold }} /></div><span className="text-right">{v}%</span></div>)}
              </div>
              <div className="grid gap-2 text-[14px] leading-6">
                {(() => { const d = c.dom; const el = Object.entries(d.elPct).sort((a, b) => b[1] - a[1]); const mo = Object.entries(d.moPct).sort((a, b) => b[1] - a[1]); const lack = el.filter(([, v]) => v <= 8);
                  const dp = PK[d.planet[0][0]], ds = SIGNS.find((s) => s.k === d.sign[0][0]);
                  return (<>
                    <p>Nguyên tố trội: <b style={{ color: ELEM[el[0][0]].c }}>{ELEM[el[0][0]].vi}</b> — {ELEM_TXT[el[0][0]]}.{lack.length ? <> Thiếu {lack.map(([k]) => ELEM[k].vi).join(", ")}: nên rèn thêm phần {lack.map(([k]) => ELEM_TXT[k].split(",")[0]).join(", ")}.</> : null}</p>
                    <p>Tính chất trội: <b>{MODE[mo[0][0]].vi}</b> — {MODE_TXT[mo[0][0]]}.</p>
                    <p>Hành tinh trội: <b style={{ ...sym, color: C.gold }}>{T(dp.g)}</b> <b>{dp.vi}</b> — {PLANET_TXT[dp.k]}. Tiếp theo: {d.planet.slice(1, 3).map(([k]) => PK[k].vi).join(", ")}.</p>
                    <p>Cung trội: <b>{ds.vi}</b> <span className="font-zh">{ds.zh}</span> — {SIGN_TXT[ds.k].kw}.</p>
                    {!c.unknown && <p>Chủ quản cung Mọc: <b>{PK[d.ascRuler].vi}</b> ở {P(d.ascRuler).sign.vi}, nhà {P(d.ascRuler).house}. Nhà nhiều hành tinh nhất: <b>nhà {d.house[0][0]}</b> ({HOUSE_TXT[d.house[0][0] - 1][1].toLowerCase()}).</p>}
                    {!c.unknown && <p className="text-[13px]" style={{ color: C.mute }}>Bán cầu: {d.above >= 6 ? "nhiều hành tinh phía trên đường chân trời — hướng ra xã hội, sự nghiệp" : "nhiều hành tinh phía dưới — hướng về bản thân, gia đình"}; {d.east >= 6 ? "phía Đông — tự chủ, tự tạo cơ hội" : "phía Tây — phát triển qua các mối quan hệ"}.</p>}
                  </>); })()}
              </div>
            </div>
          </Panel>

          {/* Nhà */}
          {!c.unknown && (
            <Panel>
              <H2 zh="宫位">12 nhà</H2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {c.cusps.map((x, i) => { const s = signOf(x); const ins = c.planets.filter((p) => p.house === i + 1); return (
                  <div key={i} className="rounded-[8px] border p-2.5 text-[13px]" style={{ borderColor: C.line, background: C.card }}>
                    <div className="flex items-baseline justify-between gap-2"><b>Nhà {i + 1}</b><span className="font-zh text-[11px]" style={{ color: C.mute }}>{HOUSE_TXT[i][0]}</span></div>
                    <div style={{ color: C.mute }}>{HOUSE_TXT[i][1]}</div>
                    <div className="mt-1">Đỉnh nhà: <span style={{ ...sym, color: ELEM[s.el].c }}>{T(s.g)}</span> {s.vi} {degIn(x)}</div>
                    {ins.length > 0 && <div className="mt-0.5">Có: {ins.map((p) => <span key={p.k} className="mr-1.5"><span style={{ ...sym, color: C.gold }}>{T(p.g)}</span> {p.vi}</span>)}</div>}
                  </div>
                ); })}
              </div>
            </Panel>
          )}

          {/* Góc chiếu */}
          <Panel>
            <H2 zh="相位">Góc chiếu</H2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">
              {c.aspects.filter((a) => !(c.unknown && [a.a.k, a.b.k].some((k) => k === "asc" || k === "mc"))).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-[14px] border-b py-1.5" style={{ borderColor: C.line }}>
                  <span style={{ ...sym, color: C.gold }}>{T(a.a.g)}</span><span className="text-[18px]" style={{ ...sym, color: a.t.c }}>{T(a.t.g)}</span><span style={{ ...sym, color: C.gold }}>{T(a.b.g)}</span>
                  <span>{a.a.vi} <b style={{ color: a.t.c }}>{a.t.vi}</b> {a.b.vi}</span>
                  <span className="ml-auto text-[12px]" style={{ color: C.mute }}>{a.orb.toFixed(1)}°</span>
                </div>
              ))}
            </div>
            <p className="text-[12px] mt-2" style={{ color: C.mute }}>{ASPECTS.map((s) => `${s.vi} ${s.zh} ${s.a}°: ${ASPECT_TXT[s.k]}`).join(" · ")}. Số độ là độ lệch so với góc chuẩn — càng nhỏ càng mạnh.</p>
          </Panel>

          {/* AI */}
          <Panel>
            <H2 zh="解盘">Luận giải chi tiết</H2>
            {!ai ? (
              <>
                <p className="text-[14px] mb-3" style={{ color: C.mute }}>AI đọc toàn bộ bản đồ sao và luận: bộ ba Mặt Trời – Mặt Trăng – Cung Mọc, tính cách, tình cảm, sự nghiệp, tài chính, góc chiếu nổi bật, xu hướng năm {new Date().getFullYear()}, kèm thuật ngữ tiếng Trung. Cần đăng nhập · tối đa 8 lượt/ngày.</p>
                <button onClick={askAI} disabled={busy} className="h-11 px-5 rounded-[8px] font-bold disabled:opacity-60" style={{ background: C.gold, color: "#16181C" }}>{busy ? "Đang luận giải… (khoảng 20–40 giây)" : "✦ Luận giải chi tiết"}</button>
                {err && <p className="text-[14px] mt-2" style={{ color: C.red }}>{err}</p>}
              </>
            ) : (
              <div className="flex flex-col gap-3">
                {AI_SEC.filter(([k]) => ai[k]).map(([k, zh, vi]) => (
                  <div key={k} className="rounded-[8px] border p-3 md:p-4" style={{ background: C.card, borderColor: C.line }}>
                    <div className="font-bold mb-1"><span className="font-zh mr-2" style={{ color: C.gold }}>{zh}</span>{vi}</div>
                    <p className="text-[15px] leading-relaxed whitespace-pre-line">{ai[k]}</p>
                  </div>
                ))}
                <div className="grid md:grid-cols-3 gap-3">
                  {[["diem_manh", "Điểm mạnh", C.green], ["thu_thach", "Thử thách", C.red], ["loi_khuyen", "Lời khuyên", C.gold]].map(([k, l, col]) => ai[k]?.length ? <div key={k} className="rounded-[8px] border p-3" style={{ background: C.card, borderColor: C.line }}><b style={{ color: col }}>{l}</b><ul className="list-disc pl-5 text-[14px] mt-1">{ai[k].map((x, i) => <li key={i}>{x}</li>)}</ul></div> : null)}
                </div>
                {ai.tu_vung?.length > 0 && <div><b style={{ color: C.gold }}>Thuật ngữ</b><div className="grid sm:grid-cols-2 gap-x-6">{ai.tu_vung.map((v, i) => <div key={i} className="flex items-center gap-2 text-[14px] border-b py-1" style={{ borderColor: C.line }}><Speak t={v.zh} /><b className="font-zh">{v.zh}</b><span className="text-[12px]" style={{ color: C.mute }}>{v.py}</span><span className="ml-auto text-right">{v.vi}</span></div>)}</div></div>}
              </div>
            )}
          </Panel>

          <Panel>
            <H2 zh="星座词汇">Từ vựng chiêm tinh</H2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">{VOCAB.map(([zh, vi]) => <div key={zh} className="flex items-center gap-2 text-[14px] border-b py-1" style={{ borderColor: C.line }}><Speak t={zh} /><b className="font-zh" style={{ color: C.gold }}>{zh}</b><span className="text-[12px]" style={{ color: C.mute }}>{py(zh)}</span><span className="ml-auto text-right">{vi}</span></div>)}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-1 mt-4 text-[13px]">{SIGNS.map((s) => <div key={s.k} className="flex items-center gap-1.5"><span style={{ ...sym, color: ELEM[s.el].c }}>{T(s.g)}</span><b className="font-zh">{s.zh}</b><span style={{ color: C.mute }}>{py(s.zh)}</span><span>{s.vi.split(" (")[0]}</span></div>)}</div>
          </Panel>
        </div>
      )}
    </Shell>
  );
}

function PointInfo({ p, c }) {
  if (!p) return null;
  const asp = c.aspects.filter((a) => a.a.k === p.k || a.b.k === p.k);
  return (
    <div className="grid gap-2 leading-6">
      <div className="flex items-baseline gap-2"><span className="text-[26px]" style={{ ...sym, color: C.gold }}>{T(p.g)}</span><b className="text-[18px]">{p.vi}</b><span className="font-zh" style={{ color: C.mute }}>{p.zh}</span></div>
      <p><b>{p.sign.vi}</b> <span className="font-zh">{p.sign.zh}</span> {p.deg}{p.house ? `, nhà ${p.house}` : ""}{p.retro ? " · nghịch hành" : ""}</p>
      <p style={{ color: C.mute }}>{PLANET_TXT[p.k]}, thể hiện theo cách {SIGN_TXT[p.sign.k].style}{p.house ? `; lĩnh vực: ${HOUSE_TXT[p.house - 1][1].toLowerCase()}` : ""}.</p>
      {asp.length > 0 && <ul className="text-[13px]">{asp.map((a, i) => { const o = a.a.k === p.k ? a.b : a.a; return <li key={i}><b style={{ color: a.t.c }}>{a.t.vi}</b> {o.vi} ({a.orb.toFixed(1)}°) — {ASPECT_TXT[a.t.k]}</li>; })}</ul>}
    </div>
  );
}

// Vòng tròn bản đồ sao (SVG): cung Mọc nằm bên trái, hoàng đạo chạy ngược chiều kim đồng hồ
function Wheel({ c, sel, onSel }) {
  const S = 520, R = 250, cx = S / 2, cy = S / 2;
  const base = c.unknown ? 0 : c.asc;
  const ang = (lon) => (180 + (norm(lon) - base)) * Math.PI / 180; // ASC ở 180° (bên trái)
  const pt = (lon, r) => [cx + r * Math.cos(ang(lon)), cy - r * Math.sin(ang(lon))];
  // xếp hành tinh tránh chồng
  const pl = c.points.filter((p) => !["asc", "mc"].includes(p.k)).map((p) => ({ ...p, d: norm(p.lon) })).sort((a, b) => a.d - b.d);
  const pos = pl.map((p) => p.d);
  for (let it = 0; it < 30; it++) for (let i = 0; i < pos.length; i++) { const j = (i + 1) % pos.length; const gap = norm(pos[j] - pos[i]); if (gap < 7) { pos[i] = norm(pos[i] - (7 - gap) / 2); pos[j] = norm(pos[j] + (7 - gap) / 2); } }
  return (
    <svg viewBox={`-22 -22 ${S + 44} ${S + 44}`} className="w-full max-w-[560px] mx-auto" role="img" aria-label="Bản đồ sao">
      <circle cx={cx} cy={cy} r={R} fill="#1A1C20" stroke={C.goldDim} />
      <circle cx={cx} cy={cy} r={R - 34} fill="none" stroke={C.goldDim} />
      <circle cx={cx} cy={cy} r={R - 120} fill="#16181C" stroke={C.line} />
      {SIGNS.map((s, i) => {
        const a0 = i * 30, [x1, y1] = pt(a0, R), [x2, y2] = pt(a0, R - 34), [tx, ty] = pt(a0 + 15, R - 17);
        const [ax, ay] = pt(a0, R), [bx, by] = pt(a0 + 30, R), [ix, iy] = pt(a0 + 30, R - 34), [jx, jy] = pt(a0, R - 34);
        return (<g key={s.k}>
          <path d={`M${ax},${ay} A${R},${R} 0 0 0 ${bx},${by} L${ix},${iy} A${R - 34},${R - 34} 0 0 1 ${jx},${jy} Z`} fill={ELEM[s.el].c} opacity="0.12" />
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.goldDim} />
          <text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize="19" fill={ELEM[s.el].c} style={sym}>{T(s.g)}</text>
        </g>);
      })}
      {/* vạch độ */}
      {Array.from({ length: 72 }).map((_, i) => { const [x1, y1] = pt(i * 5, R - 34), [x2, y2] = pt(i * 5, R - 34 - (i % 2 ? 4 : 7)); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.goldDim} strokeWidth="0.6" />; })}
      {/* nhà */}
      {!c.unknown && c.cusps.map((x, i) => { const [x1, y1] = pt(x, R - 34), [x2, y2] = pt(x, R - 120), [tx, ty] = pt(x + norm(c.cusps[(i + 1) % 12] - x) / 2, R - 112); const ang4 = i % 3 === 0; return (
        <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ang4 ? C.gold : C.line} strokeWidth={ang4 ? 1.6 : 1} /><text x={tx} y={ty} textAnchor="middle" dominantBaseline="central" fontSize="10" fill={C.mute}>{i + 1}</text></g>
      ); })}
      {!c.unknown && [["AC", c.asc], ["DC", c.asc + 180], ["MC", c.mc], ["IC", c.mc + 180]].map(([l, x]) => { const [tx, ty] = pt(x, R + 0); const [ox, oy] = [cx + (tx - cx) * 1.0, cy + (ty - cy) * 1.0]; return <text key={l} x={ox + (ox - cx) * 0.035} y={oy + (oy - cy) * 0.035} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill={C.gold}>{l}</text>; })}
      {/* góc chiếu */}
      {c.aspects.filter((a) => !["asc", "mc"].includes(a.a.k) && !["asc", "mc"].includes(a.b.k) && a.t.k !== "conj").map((a, i) => { const [x1, y1] = pt(a.a.lon, R - 122), [x2, y2] = pt(a.b.lon, R - 122); const on = sel && (a.a.k === sel || a.b.k === sel); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={a.t.c} strokeWidth={on ? 2 : 1} opacity={sel ? (on ? 0.95 : 0.12) : 0.55} />; })}
      {/* hành tinh */}
      {pl.map((p, i) => { const [x, y] = pt(pos[i], R - 60), [mx, my] = pt(p.d, R - 34), [nx, ny] = pt(p.d, R - 40); const on = sel === p.k; return (
        <g key={p.k} onClick={() => onSel(p.k)} style={{ cursor: "pointer" }}>
          <line x1={mx} y1={my} x2={nx} y2={ny} stroke={C.gold} strokeWidth="1.2" />
          <circle cx={x} cy={y} r="14" fill={on ? "#3A3222" : "#1A1C20"} stroke={on ? C.gold : "transparent"} />
          <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="17" fill={p.k === "sun" || p.k === "moon" ? "#F3E7C8" : C.gold} style={sym}>{T(p.g)}</text>
          {p.retro && <text x={x + 11} y={y + 9} fontSize="8" fill={C.red}>R</text>}
          <text {...(() => { const [a, b] = pt(pos[i], R - 84); return { x: a, y: b }; })()} textAnchor="middle" dominantBaseline="central" fontSize="9" fill={C.mute}>{Math.floor(norm(p.lon) % 30)}°</text>
        </g>
      ); })}
    </svg>
  );
}
