"use client";
// 八字 · Bát tự (Tứ trụ): lập tứ trụ, thập thần, tàng can, nạp âm, ngũ hành vượng – khuyết, nhật chủ cường nhược,
// dụng thần – hỷ thần – kỵ thần, gợi ý bổ sung ngũ hành (nên làm / nên tránh), đại vận + luận giải AI
import { useEffect, useState } from "react";
import Link from "next/link";
import { Shell, Panel, H2, usePy, speak, Speak, C } from "../ui";
import { analyze, baziText, WX, WX_ORDER, SHISHEN_VI, gzVi, wxOf } from "../../../lib/batu";

const HOURS = ["Tý sớm (00–01h)", "Sửu (01–03h)", "Dần (03–05h)", "Mão (05–07h)", "Thìn (07–09h)", "Tỵ (09–11h)", "Ngọ (11–13h)", "Mùi (13–15h)", "Thân (15–17h)", "Dậu (17–19h)", "Tuất (19–21h)", "Hợi (21–23h)", "Tý muộn (23–24h)"];
const inp = "h-10 px-3 rounded-[8px] border text-[15px] focus:outline-none";
const inpS = { background: "#262A31", borderColor: "#363B45", color: "#ECE4D3" };
const hourOf = (i) => (i === 0 ? 0 : i === 12 ? 23 : i * 2);
const W = (e) => <b style={{ color: WX[e].c }}>{WX[e].vi} <span className="font-zh">{e}</span></b>;
const RATE = { tốt: ["#22382A", "#7CC48A"], khá: ["#2B3322", "#B5CF7A"], bình: ["#2A2D33", "#A39C8B"], "cần thận trọng": ["#3D2420", "#E07A63"] };
const VOCAB = [["八字", "bát tự (tám chữ can chi)"], ["四柱", "tứ trụ"], ["日主", "nhật chủ"], ["天干", "thiên can"], ["地支", "địa chi"], ["藏干", "tàng can"], ["十神", "thập thần"], ["五行", "ngũ hành"], ["身强", "thân vượng"], ["身弱", "thân nhược"], ["用神", "dụng thần"], ["喜神", "hỷ thần"], ["忌神", "kỵ thần"], ["纳音", "nạp âm"], ["大运", "đại vận"], ["调候", "điều hậu"]];
const AI_SEC = [["tong_quan", "总论", "Tổng quan"], ["cach_cuc", "格局", "Cách cục"], ["tinh_cach", "性格", "Tính cách"], ["su_nghiep", "事业", "Sự nghiệp – học hành"], ["tai_van", "财运", "Tài vận"], ["tinh_cam", "感情", "Tình cảm"], ["suc_khoe", "健康", "Sức khoẻ"], ["dung_than", "用神", "Dụng thần và cách bổ sung"], ["dai_van", "大运", "Đại vận"], ["nam_nay", "流年", "Vận năm nay"]];

export default function BatTu() {
  const py = usePy();
  const [f, setF] = useState({ name: "", gender: "女", cal: "solar", date: "1995-08-15", ld: 20, lm: 7, ly: 1995, leap: false, h: 7 });
  const [L, setL] = useState(null); const [a, setA] = useState(null); const [err, setErr] = useState("");
  const [ai, setAi] = useState(null); const [busy, setBusy] = useState(false);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem("tuvi_form") || "null"); if (s) setF((x) => ({ ...x, ...s })); } catch {} import("lunar-javascript").then((m) => setL(m.default?.Solar ? m.default : m)).catch(() => setErr("Không tải được bộ lịch.")); }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const make = () => {
    if (!L) return; setErr(""); setAi(null);
    try {
      const hh = hourOf(+f.h), mi = +f.h === 0 ? 30 : 0;
      const lu = f.cal === "solar" ? (() => { const [y, m, d] = f.date.split("-").map(Number); return L.Solar.fromYmdHms(y, m, d, hh, mi, 0).getLunar(); })() : L.Lunar.fromYmdHms(+f.ly, f.leap ? -f.lm : +f.lm, +f.ld, hh, mi, 0);
      const so = lu.getSolar();
      const lunarTxt = `ngày ${lu.getDay()} tháng ${Math.abs(lu.getMonth())}${lu.getMonth() < 0 ? " nhuận" : ""} năm ${gzVi(lu.getYearInGanZhi())} (${lu.getYear()}), giờ ${HOURS[+f.h].split(" (")[0]} · dương lịch ${so.getDay()}/${so.getMonth()}/${so.getYear()}`;
      setA(analyze(lu.getEightChar(), f.gender === "男" ? 1 : 0, lunarTxt));
      try { localStorage.setItem("tuvi_form", JSON.stringify(f)); } catch {}
      setTimeout(() => document.getElementById("bz")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) { setErr("Ngày sinh không hợp lệ: " + (e.message || e)); }
  };
  const askAI = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/bat-tu", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chart: baziText(a, f.name, f.gender === "男" ? 1 : 0), year: new Date().getFullYear() }) });
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || "Lỗi " + r.status); setAi(d);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const thisYear = new Date().getFullYear();
  const age = a && f.cal === "solar" ? thisYear - Number(f.date.slice(0, 4)) + 1 : a ? thisYear - f.ly + 1 : 0;

  return (
    <Shell title="Bát tự · Tứ trụ">
      <div className="flex items-center gap-2 text-[13px] mb-3" style={{ color: C.mute }}><Link href="/huyen-hoc" className="hover:underline">‹ 玄门学宫</Link><span>/</span><Link href="/huyen-hoc/tu-vi" className="hover:underline">紫微斗数</Link></div>
      <header className="mb-4">
        <div className="font-zh text-[14px]" style={{ color: C.gold }}>八字命理 · 四柱推命</div>
        <h1 className="font-serif-vn text-[28px] md:text-[34px] font-extrabold">Bát tự · Tứ trụ</h1>
        <p className="text-[14px]" style={{ color: C.mute }}>Xem mệnh theo tám chữ can chi: ngũ hành vượng – khuyết, nhật chủ mạnh hay yếu, dụng thần, nên bổ sung hành gì, nên làm và nên tránh điều gì. Nội dung mang tính văn hoá – tham khảo.</p>
      </header>

      <Panel className="mb-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Họ tên (tuỳ chọn)<input className={inp} style={inpS} value={f.name} onChange={(e) => set("name", e.target.value)} /></label>
          <div className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Giới tính
            <div className="flex gap-1.5">{[["男", "Nam 男"], ["女", "Nữ 女"]].map(([k, l]) => <button key={k} onClick={() => set("gender", k)} className="flex-1 h-10 rounded-[8px] border font-bold" style={f.gender === k ? { background: C.goldSoft, borderColor: C.gold, color: C.gold } : inpS}>{l}</button>)}</div>
          </div>
          <div className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Ngày sinh
            <div className="flex gap-1.5 mb-1">{[["solar", "Dương lịch"], ["lunar", "Âm lịch"]].map(([k, l]) => <button key={k} onClick={() => set("cal", k)} className="h-8 px-3 rounded-full border text-[12px] font-bold" style={f.cal === k ? { background: C.goldSoft, borderColor: C.gold, color: C.gold } : inpS}>{l}</button>)}</div>
            {f.cal === "solar" ? <input type="date" className={inp} style={inpS} value={f.date} onChange={(e) => set("date", e.target.value)} aria-label="Ngày sinh dương lịch" /> : (
              <div className="flex gap-1.5 items-center flex-wrap">
                <select className={inp} style={inpS} value={f.ld} onChange={(e) => set("ld", +e.target.value)} aria-label="Ngày âm">{Array.from({ length: 30 }, (_, i) => <option key={i} value={i + 1}>Ngày {i + 1}</option>)}</select>
                <select className={inp} style={inpS} value={f.lm} onChange={(e) => set("lm", +e.target.value)} aria-label="Tháng âm">{Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>Tháng {i + 1}</option>)}</select>
                <input type="number" className={inp + " w-24"} style={inpS} value={f.ly} onChange={(e) => set("ly", +e.target.value)} aria-label="Năm âm" />
                <label className="flex items-center gap-1 text-[13px]"><input type="checkbox" checked={f.leap} onChange={(e) => set("leap", e.target.checked)} /> tháng nhuận</label>
              </div>
            )}
          </div>
          <label className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Giờ sinh
            <select className={inp} style={inpS} value={f.h} onChange={(e) => set("h", +e.target.value)}>{HOURS.map((h, i) => <option key={i} value={i}>{h}</option>)}</select>
          </label>
        </div>
        <button onClick={make} disabled={!L} className="mt-4 w-full h-11 rounded-[8px] font-bold disabled:opacity-50" style={{ background: C.gold, color: "#16181C" }}>{L ? "排八字 · Lập tứ trụ" : "Đang tải bộ lịch…"}</button>
        {err && !a && <p className="text-[14px] mt-2" style={{ color: C.red }}>{err}</p>}
      </Panel>

      {a && (
        <div id="bz" className="flex flex-col gap-4 scroll-mt-20">
          {/* Tứ trụ */}
          <Panel>
            <H2 zh="四柱" right={a.lunar}>Tứ trụ{f.name ? ` · ${f.name}` : ""}</H2>
            <div className="grid grid-cols-[auto_repeat(4,minmax(0,1fr))] gap-px rounded-[8px] overflow-hidden text-center text-[12px] md:text-[14px]" style={{ background: C.line }}>
              {[
                ["", (p) => <span className="font-bold">{p.vi} <span className="font-zh" style={{ color: C.mute }}>{p.zh}</span></span>],
                ["Thập thần", (p) => <span style={{ color: p.god === "日主" ? C.gold : C.text }}>{SHISHEN_VI[p.god]}<span className="block font-zh text-[11px]" style={{ color: C.mute }}>{p.god === "日主" ? "日元" : p.god}</span></span>],
                ["Thiên can", (p) => <button onClick={() => speak(p.gan)} className="leading-none"><span className="font-zh text-[26px] md:text-[34px] font-bold" style={{ color: WX[p.ganWx].c }}>{p.gan}</span><span className="block text-[11px]" style={{ color: C.mute }}>{p.gzVi.split(" ")[0]} · {WX[p.ganWx].vi}</span></button>],
                ["Địa chi", (p) => <button onClick={() => speak(p.zhi)} className="leading-none"><span className="font-zh text-[26px] md:text-[34px] font-bold" style={{ color: WX[p.zhiWx].c }}>{p.zhi}</span><span className="block text-[11px]" style={{ color: C.mute }}>{p.gzVi.split(" ")[1]} · {WX[p.zhiWx].vi}</span></button>],
                ["Tàng can", (p) => <span className="grid gap-0.5">{p.hide.map((h) => <span key={h.g} className="text-[11px] md:text-[12px]"><b className="font-zh" style={{ color: WX[h.wx].c }}>{h.g}</b> {SHISHEN_VI[h.god]}</span>)}</span>],
                ["Nạp âm", (p) => <span className="text-[11px] md:text-[12px]">{p.nayinVi}<span className="block font-zh" style={{ color: C.mute }}>{p.nayin}</span></span>],
                ["Trường sinh", (p) => <span className="text-[11px] md:text-[12px]">{p.dishiVi} <span className="font-zh" style={{ color: C.mute }}>{p.dishi}</span></span>],
              ].map(([label, fn], r) => [
                <div key={"l" + r} className="px-2 py-2 text-left text-[11px] md:text-[12px] flex items-center" style={{ background: C.panel, color: C.mute }}>{label}</div>,
                ...a.pillars.map((p, i) => <div key={r + "-" + i} className="px-1 py-2 grid place-items-center" style={{ background: i === 2 ? "#2B2619" : C.card }}>{fn(p)}</div>),
              ])}
            </div>
            <p className="text-[12px] mt-2" style={{ color: C.mute }}>Bấm vào chữ để nghe đọc. Màu chữ theo ngũ hành. Cột Ngày (nền vàng) là nhật chủ — đại diện cho chính bạn. Không vong ngày: <span className="font-zh">{a.xunkong}</span> · Mệnh cung: <span className="font-zh">{a.mingGong}</span> · Thai nguyên: <span className="font-zh">{a.taiYuan}</span>.</p>
          </Panel>

          {/* Mệnh + ngũ hành */}
          <div className="grid md:grid-cols-2 gap-4">
            <Panel>
              <H2 zh="命">Bạn mệnh gì?</H2>
              <div className="grid gap-2 text-[14px] leading-6">
                <div className="rounded-[8px] border p-3" style={{ borderColor: C.line, background: C.card }}>
                  <div className="text-[12px]" style={{ color: C.mute }}>Nhật chủ 日主 — cốt lõi của Bát tự</div>
                  <div className="text-[18px] font-bold"><span className="font-zh" style={{ color: WX[a.E].c }}>{a.dm}</span> {a.dmVi} · {a.yinyang} {WX[a.E].vi}</div>
                  <div className="text-[13px]">Khi xem Bát tự, &quot;bạn thuộc hành gì&quot; là hành của can ngày sinh: bạn là người <b>{a.yinyang} {WX[a.E].vi}</b>.</div>
                </div>
                <div className="rounded-[8px] border p-3" style={{ borderColor: C.line, background: C.card }}>
                  <div className="text-[12px]" style={{ color: C.mute }}>Mệnh niên (nạp âm năm sinh) — cách gọi dân gian</div>
                  <div className="text-[18px] font-bold">{a.yearNayinVi} <span className="font-zh text-[14px]" style={{ color: C.mute }}>{a.yearNayin}</span></div>
                  <div className="text-[13px]">Đây là &quot;mệnh&quot; người Việt hay dùng để xem tuổi, chọn màu xe, hướng nhà. Nó giống nhau cho mọi người sinh cùng năm nên chỉ để tham khảo; việc <b>bổ sung hành nào</b> phải theo dụng thần bên dưới.</div>
                </div>
              </div>
            </Panel>
            <Panel>
              <H2 zh="五行" right="theo điểm can, chi, tàng can">Ngũ hành vượng – khuyết</H2>
              <div className="grid gap-2">
                {WX_ORDER.map((e) => (
                  <div key={e} className="grid grid-cols-[64px_1fr_44px] items-center gap-2 text-[14px]">
                    <span><b style={{ color: WX[e].c }}>{WX[e].vi}</b> <span className="font-zh" style={{ color: C.mute }}>{e}</span></span>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: C.line }}><div className="h-full rounded-full" style={{ width: `${a.pct[e]}%`, background: WX[e].c }} /></div>
                    <span className="text-right tabular-nums">{a.pct[e]}%</span>
                  </div>
                ))}
              </div>
              <div className="text-[14px] mt-3 leading-6">
                <p>Vượng nhất: {W(a.strongest)}. {a.lack.length ? <>Khuyết (không lộ trong 8 chữ): {a.lack.map((e, i) => <span key={e}>{i ? ", " : ""}{W(e)}{a.hidden[e] ? <span style={{ color: C.mute }}> (có ẩn trong tàng can)</span> : ""}</span>)}.</> : "Đủ cả năm hành trong 8 chữ, không khuyết hành nào."}</p>
                {a.lack.length > 0 && <p className="text-[13px]" style={{ color: C.mute }}>Khuyết hành chưa chắc là xấu: chỉ cần bổ sung khi hành đó là dụng/hỷ thần của bạn.</p>}
              </div>
            </Panel>
          </div>

          {/* Vượng nhược */}
          <Panel>
            <H2 zh="身强身弱">Nhật chủ mạnh hay yếu</H2>
            <div className="relative h-4 rounded-full mb-1" style={{ background: "linear-gradient(90deg,#6FA8DC,#3A3222 45%,#3A3222 55%,#E07A63)" }}>
              <span className="absolute -top-1 w-1.5 h-6 rounded" style={{ left: `calc(${Math.min(95, Math.max(3, a.ratio))}% - 3px)`, background: C.gold }} />
            </div>
            <div className="flex justify-between text-[11px] mb-3" style={{ color: C.mute }}><span>Nhược 身弱</span><span>Trung hoà</span><span>Vượng 身强</span></div>
            <p className="text-[15px]">Thân <b style={{ color: C.gold }}>{a.level}</b> — lực sinh trợ (Tỷ Kiếp + Ấn) chiếm {a.ratio}% các hành còn lại.</p>
            <div className="flex flex-wrap gap-1.5 mt-2 text-[13px]">
              {[[a.deLenh, "Đắc lệnh 得令", "tháng sinh trợ giúp nhật chủ"], [a.deDia, "Đắc địa 得地", "có gốc ở địa chi"], [a.deThe, "Đắc thế 得势", "nhiều can sinh trợ"]].map(([ok, t, d]) => (
                <span key={t} className="px-2 py-1 rounded border" style={ok ? { borderColor: C.green, color: C.green, background: C.greenSoft } : { borderColor: C.line, color: C.mute }} title={d}>{ok ? "✓" : "✗"} {t}</span>
              ))}
            </div>
          </Panel>

          {/* Dụng thần */}
          <Panel>
            <H2 zh="用神">Dụng thần – Hỷ thần – Kỵ thần</H2>
            <div className="grid sm:grid-cols-3 gap-2">
              {[["Dụng thần 用神", [a.dung], "hành cần nhất, nên bổ sung"], ["Hỷ thần 喜神", [a.hy], "hành hỗ trợ, có lợi"], ["Kỵ thần 忌神", a.ky, "hành nên hạn chế"]].map(([t, es, d], i) => (
                <div key={t} className="rounded-[8px] border p-3" style={{ borderColor: i === 2 ? "#5A3028" : C.goldDim, background: C.card }}>
                  <div className="text-[12px]" style={{ color: C.mute }}>{t}</div>
                  <div className="text-[18px]">{es.map((e, k) => <span key={e}>{k ? " · " : ""}{W(e)}</span>)}</div>
                  <div className="text-[12px]" style={{ color: C.mute }}>{d}</div>
                </div>
              ))}
            </div>
            <p className="text-[14px] mt-3 leading-6">{a.why}</p>
            {a.tiaohou && <p className="text-[14px] mt-1 leading-6">Điều hậu 调候: sinh vào tháng {a.pillars[1].gzVi.split(" ")[1]} ({"亥子丑".includes(a.pillars[1].zhi) ? "mùa đông, khí lạnh" : "mùa hè, khí nóng"}) mà {W(a.tiaohou)} ít, nên thêm {W(a.tiaohou)} để cân bằng khí hậu trong mệnh.</p>}
            <p className="text-[12px] mt-2" style={{ color: C.mute }}>Tính theo phép Phù ức (扶抑) giản lược. Lá số đặc biệt (tòng cách, hoá khí…) cần thầy xem kỹ; phần AI bên dưới sẽ xét thêm.</p>
          </Panel>

          {/* Nên làm / tránh */}
          <div className="grid md:grid-cols-2 gap-4">
            <Panel>
              <H2 zh="宜">Cần bổ sung · nên làm</H2>
              {[a.dung, a.hy, a.tiaohou].filter((e, i, arr) => e && arr.indexOf(e) === i).map((e, i) => (
                <div key={e} className="mb-3 text-[14px] leading-6">
                  <div className="font-bold mb-1">{i === 0 ? "Hành chính cần bổ sung: " : "Thêm: "}{W(e)}</div>
                  <ul className="list-disc pl-5">
                    <li>Màu hợp: {WX[e].color}</li>
                    <li>Hướng tốt: {WX[e].dir} (bàn làm việc, giường, cửa) · mùa thuận: {WX[e].season}</li>
                    <li>Con số: {WX[e].num}</li>
                    <li>Nghề – lĩnh vực hợp: {WX[e].job}</li>
                    <li>Vật phẩm: {WX[e].item}</li>
                    <li>Thói quen: {WX[e].habit}</li>
                    <li>Ăn uống: {WX[e].food}</li>
                  </ul>
                </div>
              ))}
            </Panel>
            <Panel>
              <H2 zh="忌">Nên tránh · hạn chế</H2>
              {a.ky.filter((e) => e !== a.tiaohou).map((e) => (
                <div key={e} className="mb-3 text-[14px] leading-6">
                  <div className="font-bold mb-1">Hạn chế {W(e)}</div>
                  <ul className="list-disc pl-5">
                    <li>Không nên dùng quá nhiều màu {WX[e].color}</li>
                    <li>Bớt ưu tiên hướng {WX[e].dir}</li>
                    <li>Chú ý sức khoẻ: {WX[e].organ} (hành kỵ quá vượng dễ làm mất cân bằng)</li>
                  </ul>
                </div>
              ))}
              <p className="text-[12px]" style={{ color: C.mute }}>Không cần tránh tuyệt đối — chỉ là đừng để hành kỵ chiếm ưu thế trong nhà, trang phục, công việc chính.</p>
            </Panel>
          </div>

          {/* Đại vận */}
          {a.yun && (
            <Panel>
              <H2 zh="大运" right={`khởi vận sau sinh ${a.yun.start}`}>Đại vận 10 năm</H2>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {a.yun.list.map((d) => { const now = age >= d.from && age <= d.to; const [bg, fg] = RATE[d.rate]; return (
                  <div key={d.gz} className="shrink-0 w-[92px] rounded-[8px] border p-2 text-center" style={{ borderColor: now ? C.gold : C.line, background: now ? "#2B2619" : C.card }}>
                    <div className="text-[11px]" style={{ color: C.mute }}>{d.from}–{d.to} tuổi</div>
                    <div className="font-zh text-[22px] font-bold leading-tight"><span style={{ color: WX[wxOf(d.gz[0])].c }}>{d.gz[0]}</span><span style={{ color: WX[wxOf(d.gz[1])].c }}>{d.gz[1]}</span></div>
                    <div className="text-[11px]">{d.gzVi}</div>
                    <div className="text-[10px]" style={{ color: C.mute }}>{SHISHEN_VI[d.god]} · {d.year}</div>
                    <div className="mt-1 text-[11px] font-bold rounded px-1" style={{ background: bg, color: fg }}>{d.rate}</div>
                    {now && <div className="text-[10px] mt-0.5" style={{ color: C.gold }}>hiện tại</div>}
                  </div>
                ); })}
              </div>
              <p className="text-[12px] mt-1" style={{ color: C.mute }}>Đánh giá theo việc can chi của vận có mang dụng/hỷ thần hay kỵ thần.</p>
            </Panel>
          )}

          {/* AI */}
          <Panel>
            <H2 zh="论命">Luận giải chi tiết</H2>
            {!ai ? (
              <>
                <p className="text-[14px] mb-3" style={{ color: C.mute }}>AI đọc cả tứ trụ, thập thần, ngũ hành, dụng thần và đại vận rồi luận: cách cục, tính cách, sự nghiệp, tài vận, tình cảm, sức khoẻ, vận năm {thisYear}, nên làm – nên tránh, kèm thuật ngữ tiếng Trung. Cần đăng nhập · tối đa 8 lượt/ngày.</p>
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
                <div className="grid md:grid-cols-2 gap-3">
                  {ai.nen_lam?.length > 0 && <div className="rounded-[8px] border p-3" style={{ background: C.card, borderColor: C.line }}><b style={{ color: C.green }}>Nên làm</b><ul className="list-disc pl-5 text-[14px] mt-1">{ai.nen_lam.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                  {ai.nen_tranh?.length > 0 && <div className="rounded-[8px] border p-3" style={{ background: C.card, borderColor: C.line }}><b style={{ color: C.red }}>Nên tránh</b><ul className="list-disc pl-5 text-[14px] mt-1">{ai.nen_tranh.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                </div>
                {ai.tu_vung?.length > 0 && <div><b style={{ color: C.gold }}>Thuật ngữ</b><div className="grid sm:grid-cols-2 gap-x-6">{ai.tu_vung.map((v, i) => <div key={i} className="flex items-center gap-2 text-[14px] border-b py-1" style={{ borderColor: C.line }}><Speak t={v.zh} /><b className="font-zh">{v.zh}</b><span className="text-[12px]" style={{ color: C.mute }}>{v.py}</span><span className="ml-auto text-right">{v.vi}</span></div>)}</div></div>}
              </div>
            )}
          </Panel>

          <Panel>
            <H2 zh="八字词汇">Từ vựng Bát tự</H2>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1">{VOCAB.map(([zh, vi]) => <div key={zh} className="flex items-center gap-2 text-[14px] border-b py-1" style={{ borderColor: C.line }}><Speak t={zh} /><b className="font-zh" style={{ color: C.gold }}>{zh}</b><span className="text-[12px]" style={{ color: C.mute }}>{py(zh)}</span><span className="ml-auto text-right">{vi}</span></div>)}</div>
          </Panel>
        </div>
      )}
    </Shell>
  );
}
