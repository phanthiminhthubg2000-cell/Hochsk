"use client";
// 紫微斗数 — Lập lá số Tử vi (an sao bằng thư viện iztro) + luận giải cơ bản theo từ điển sao + luận giải chi tiết bằng AI
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shell, Panel, H2, usePy, speak, C } from "../ui";
import { PALACE, MAJOR, MINOR, MUTAGEN, BRIGHT, BRIGHT_NOTE, CLASS } from "../../../lib/tuvi-data";

const HOURS = ["Tý sớm (00–01h)", "Sửu (01–03h)", "Dần (03–05h)", "Mão (05–07h)", "Thìn (07–09h)", "Tỵ (09–11h)", "Ngọ (11–13h)", "Mùi (13–15h)", "Thân (15–17h)", "Dậu (17–19h)", "Tuất (19–21h)", "Hợi (21–23h)", "Tý muộn (23–24h)"];
const POS = { 巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4], 辰: [2, 1], 酉: [2, 4], 卯: [3, 1], 戌: [3, 4], 寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4] };
const OPP = { 子: "午", 丑: "未", 寅: "申", 卯: "酉", 辰: "戌", 巳: "亥", 午: "子", 未: "丑", 申: "寅", 酉: "卯", 戌: "辰", 亥: "巳" };
const KIND = { cát: "#7CC48A", sát: "#E07A63", đào: "#E58FB4", trung: "#C9B98A" };
const inp = "h-10 px-3 rounded-[8px] border text-[15px] focus:outline-none";
const inpS = { background: "#262A31", borderColor: "#363B45", color: "#ECE4D3" };

function hourFromNow() { const h = new Date().getHours(); return h === 23 ? 12 : Math.floor((h + 1) / 2); }

// gộp lá số tiếng Việt + tiếng Trung theo thứ tự cung/sao
function merge(v, z) {
  return v.palaces.map((p, i) => {
    const q = z.palaces[i];
    const stars = (k) => p[k].map((s, j) => ({ vi: s.name, zh: q[k][j]?.name, br: q[k][j]?.brightness || "", mu: q[k][j]?.mutagen || "" }));
    return { i, vi: p.name, zh: q.name, can: p.heavenlyStem, chi: p.earthlyBranch, zhi: q.earthlyBranch, gan: q.heavenlyStem, body: p.isBodyPalace, major: stars("majorStars"), minor: stars("minorStars"), adj: stars("adjectiveStars"), dv: p.decadal.range, cs: p.changsheng12, csz: q.changsheng12 };
  });
}

function Star({ s, big }) {
  const mu = s.mu && MUTAGEN[s.mu];
  return (
    <span className={"inline-flex items-baseline gap-1 flex-wrap " + (big ? "text-[13px] font-bold" : "text-[11px]")}>
      <span style={{ color: big ? "#F3E7C8" : KIND[MINOR[s.zh]?.[1]] || C.mute }}>{s.vi}</span>
      {s.br && <span className="text-[10px]" style={{ color: C.mute }}>({BRIGHT[s.br] || s.br})</span>}
      {mu && <span className="text-[10px] font-bold px-1 rounded" style={{ background: mu[1], color: "#fff" }}>{mu[0].replace("Hoá ", "")}</span>}
    </span>
  );
}

function Cell({ p, sel, onPick, dv, ln }) {
  const [r, c] = POS[p.zhi];
  const ming = p.zh === "命宫";
  return (
    <button type="button" onClick={() => onPick(p.i)} style={{ gridRow: r, gridColumn: c, background: sel ? "#3A3222" : C.card, borderColor: sel ? C.gold : ming ? "#8F7642" : C.line }}
      className="relative text-left rounded-[6px] border p-1.5 flex flex-col gap-0.5 min-h-[150px] hover:border-[#D4AF5F]">
      <div className="flex items-start gap-1">
        <span className="text-[12px] font-extrabold uppercase" style={{ color: ming ? "#E07A63" : C.gold }}>{PALACE[p.zh]?.vi || p.vi}</span>
        {p.body && <span className="text-[9px] font-bold px-1 rounded" style={{ background: "#3D2420", color: "#E07A63" }}>THÂN</span>}
        <span className="ml-auto flex gap-0.5">
          {dv && <span className="text-[9px] font-bold px-1 rounded" style={{ background: "#22382A", color: "#7CC48A" }} title="Đại vận hiện tại">ĐV</span>}
          {ln && <span className="text-[9px] font-bold px-1 rounded" style={{ background: "#1F3550", color: "#8AB8E6" }} title="Lưu niên năm nay">LN</span>}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">{p.major.length ? p.major.map((s) => <Star key={s.zh} s={s} big />) : <span className="text-[11px] italic" style={{ color: C.mute }}>Vô chính diệu</span>}</div>
      <div className="flex flex-wrap gap-x-1.5 leading-tight">{p.minor.map((s) => <Star key={s.zh} s={s} />)}</div>
      <div className="flex flex-wrap gap-x-1.5 leading-tight opacity-80">{p.adj.slice(0, 6).map((s) => <span key={s.zh} className="text-[10px]" style={{ color: KIND[MINOR[s.zh]?.[1]] || C.mute }}>{s.vi}</span>)}</div>
      <div className="mt-auto flex items-end justify-between text-[10px] pt-1" style={{ color: C.mute }}>
        <span>{p.can} {p.chi}</span><span>{p.cs}</span><span className="font-bold" style={{ color: "#CFC3A8" }}>{p.dv[0]}–{p.dv[1]}</span>
      </div>
    </button>
  );
}

function Detail({ P, i }) {
  const py = usePy();
  const p = P[i]; const opp = P.find((x) => x.zhi === OPP[p.zhi]);
  const info = PALACE[p.zh] || {};
  const majors = p.major.length ? p.major : opp.major;
  const all = [...p.minor, ...p.adj].filter((s) => MINOR[s.zh]);
  const mus = [...p.major, ...p.minor].filter((s) => s.mu);
  return (
    <Panel>
      <H2 zh={p.zh} right={`${p.can} ${p.chi} · đại vận ${p.dv[0]}–${p.dv[1]} tuổi`}>Cung {info.vi || p.vi}{p.body ? " · Thân cư" : ""}</H2>
      <p className="text-[14px] mb-3" style={{ color: C.mute }}>{info.y}</p>
      {!p.major.length && <p className="text-[14px] mb-3 rounded-[8px] border px-3 py-2" style={{ borderColor: C.goldDim, background: "#2B2619" }}><b>Vô chính diệu</b> (cung không có chính tinh): theo lệ, mượn chính tinh của cung đối diện — <b>{PALACE[opp.zh]?.vi}</b> — để luận, tính chất nhẹ và dễ thay đổi theo hoàn cảnh hơn.</p>}
      <div className="grid gap-2">
        {majors.map((s) => { const m = MAJOR[s.zh]; if (!m) return null; return (
          <div key={s.zh} className="rounded-[8px] border p-3" style={{ background: C.card, borderColor: C.line }}>
            <div className="flex items-baseline gap-2 flex-wrap">
              <button onClick={() => speak(s.zh)} className="font-zh text-[22px] font-bold" style={{ color: C.gold }}>{s.zh}</button>
              <span className="text-[13px]" style={{ color: C.goldDim }}>{py(s.zh)}</span>
              <b className="text-[16px]">{m.hv}</b>
              {s.br && <span className="text-[12px] px-1.5 rounded" style={{ background: C.panel, color: C.mute }}>{BRIGHT[s.br]} — {BRIGHT_NOTE[s.br]}</span>}
              <span className="text-[12px] ml-auto" style={{ color: C.mute }}>{m.wx} · <span className="font-zh">{m.hq}</span></span>
            </div>
            <p className="text-[14px] mt-1">{m.t}</p>
            <p className="text-[13px] mt-1"><b style={{ color: C.green }}>Mạnh:</b> {m.g}</p>
            <p className="text-[13px]"><b style={{ color: C.red }}>Lưu ý:</b> {m.b}</p>
          </div>
        ); })}
      </div>
      {mus.length > 0 && (
        <div className="mt-3 grid gap-1.5">
          {mus.map((s) => <div key={s.zh + s.mu} className="text-[14px]"><span className="font-bold px-1.5 rounded mr-1.5" style={{ background: MUTAGEN[s.mu][1], color: "#fff" }}>{MUTAGEN[s.mu][0]} <span className="font-zh">化{s.mu}</span></span>{s.vi}: {MUTAGEN[s.mu][2]}</div>)}
        </div>
      )}
      {all.length > 0 && (
        <div className="mt-3">
          <div className="text-[12px] font-bold mb-1.5" style={{ color: C.mute }}>Phụ tinh trong cung</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {all.map((s) => { const m = MINOR[s.zh]; return (
              <div key={s.zh} className="text-[13px] rounded-[6px] border px-2.5 py-1.5" style={{ borderColor: C.line }}>
                <b style={{ color: KIND[m[1]] }}>{m[0]}</b> <span className="font-zh" style={{ color: C.gold }}>{s.zh}</span> <span className="text-[11px]" style={{ color: C.goldDim }}>{py(s.zh)}</span> — {m[2]}
              </div>
            ); })}
          </div>
        </div>
      )}
    </Panel>
  );
}

function chartText(v, P, hz, name) {
  const st = (a) => a.map((s) => `${s.vi} ${s.zh}${s.br ? `(${BRIGHT[s.br]})` : ""}${s.mu ? `[Hoá ${MUTAGEN[s.mu][0].replace("Hoá ", "")}]` : ""}`).join(", ");
  const head = [`Đương số: ${name || "—"}, ${v.gender}, sinh dương lịch ${v.solarDate}, ${v.lunarDate}, giờ ${v.time} (${v.timeRange}).`,
    `Bát tự: ${v.chineseDate}. Cục: ${v.fiveElementsClass}. Mệnh chủ: ${v.soul}. Thân chủ: ${v.body}. Mệnh tại ${v.earthlyBranchOfSoulPalace}, Thân tại ${v.earthlyBranchOfBodyPalace}.`,
    hz ? `Hiện tại (năm ${new Date().getFullYear()}, ${hz.age} tuổi mụ): đại vận ở cung ${P[hz.dv].vi} (${P[hz.dv].dv.join("–")} tuổi), lưu niên ${hz.yname} ở cung ${P[hz.ln].vi}.` : ""];
  return head.join("\n") + "\n" + P.map((p) => `Cung ${p.vi} 「${p.zh}」 tại ${p.can} ${p.chi}${p.body ? " (Thân cư)" : ""}, đại vận ${p.dv.join("–")}: chính tinh: ${p.major.length ? st(p.major) : "vô chính diệu"}; phụ tinh: ${st(p.minor) || "—"}; sao khác: ${p.adj.map((s) => s.vi).join(", ") || "—"}; tràng sinh: ${p.cs}.`).join("\n");
}

const AI_SEC = [["tong_quan", "总论", "Tổng quan"], ["tinh_cach", "性格", "Tính cách"], ["su_nghiep", "事业", "Sự nghiệp – học hành"], ["tai_loc", "财运", "Tài lộc"], ["tinh_duyen", "感情", "Tình duyên – hôn nhân"], ["gia_dao", "家庭", "Gia đạo"], ["suc_khoe", "健康", "Sức khoẻ"], ["dai_van", "大运", "Đại vận hiện tại"], ["nam_nay", "流年", "Vận năm nay"]];

export default function TuViPage() {
  const [f, setF] = useState({ name: "", gender: "女", cal: "solar", date: "1995-08-15", ld: 20, lm: 7, ly: 1995, leap: false, h: 7 });
  const [lib, setLib] = useState(null); const [chart, setChart] = useState(null); const [sel, setSel] = useState(null);
  const [ai, setAi] = useState(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem("tuvi_form") || "null"); if (s) setF((x) => ({ ...x, ...s })); else setF((x) => ({ ...x, h: hourFromNow() })); } catch {} import("iztro").then((m) => setLib(m)).catch(() => setErr("Không tải được bộ an sao.")); }, []);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const make = () => {
    if (!lib) return;
    setErr(""); setAi(null);
    try {
      const args = f.cal === "solar" ? ["bySolar", f.date.replace(/-0?/g, "-").replace(/^-/, ""), +f.h, f.gender, true] : ["byLunar", `${f.ly}-${f.lm}-${f.ld}`, +f.h, f.gender, !!f.leap, true];
      const run = (lang) => args[0] === "bySolar" ? lib.astro.bySolar(args[1], args[2], args[3], true, lang) : lib.astro.byLunar(args[1], args[2], args[3], args[4], true, lang);
      const v = run("vi-VN"), z = run("zh-CN"); const P = merge(v, z);
      let hz = null;
      try { const h = v.horoscope(new Date()); hz = { dv: h.decadal.index, ln: h.yearly.index, age: h.age?.nominalAge, yname: `${h.yearly.heavenlyStem} ${h.yearly.earthlyBranch}` }; } catch {}
      setChart({ v, z, P, hz }); setSel(P.findIndex((p) => p.zh === "命宫"));
      try { localStorage.setItem("tuvi_form", JSON.stringify(f)); } catch {}
      setTimeout(() => document.getElementById("laso")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) { setErr("Ngày sinh không hợp lệ: " + (e.message || e)); }
  };
  const askAI = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/tu-vi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chart: chartText(chart.v, chart.P, chart.hz, f.name), year: new Date().getFullYear() }) });
      const d = await r.json(); if (!r.ok || d.error) throw new Error(d.error || "Lỗi " + r.status);
      setAi(d); setTimeout(() => document.getElementById("ai")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) { setErr(e.message || String(e)); }
    setBusy(false);
  };
  const py = usePy();
  const ch = chart?.v; const P = chart?.P;
  const ming = P?.find((p) => p.zh === "命宫"); const shen = P?.find((p) => p.body);

  return (
    <Shell title="Lá số Tử vi">
      <div className="flex items-center gap-2 text-[13px] mb-3" style={{ color: C.mute }}><Link href="/huyen-hoc" className="hover:underline">‹ 玄门学宫</Link><span>/</span><Link href="/huyen-hoc/cong-cu" className="hover:underline">法器</Link></div>
      <header className="mb-4">
        <div className="font-zh text-[14px]" style={{ color: C.gold }}>紫微斗数 · 排盘与论命</div>
        <h1 className="font-serif-vn text-[28px] md:text-[34px] font-extrabold">Lập lá số Tử vi</h1>
        <p className="text-[14px]" style={{ color: C.mute }}>An đủ 14 chính tinh, lục cát, lục sát, Tứ hoá, Tràng sinh, đại vận · bấm từng cung để xem luận giải và học tên sao bằng tiếng Trung. Nội dung mang tính văn hoá – tham khảo.</p>
      </header>

      <Panel className="mb-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="grid gap-1 text-[13px]" style={{ color: C.mute }}>Họ tên (tuỳ chọn)<input className={inp} style={inpS} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nguyễn Văn A" /></label>
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
        <button onClick={make} disabled={!lib} className="mt-4 w-full h-11 rounded-[8px] font-bold disabled:opacity-50" style={{ background: C.gold, color: "#16181C" }}>{lib ? "排盘 · Lập lá số" : "Đang tải bộ an sao…"}</button>
        {err && <p className="text-[14px] mt-2" style={{ color: C.red }}>{err}</p>}
      </Panel>

      {chart && (
        <div id="laso" className="flex flex-col gap-4 scroll-mt-20">
          <div className="overflow-x-auto -mx-3 px-3 pb-1">
            <div className="grid gap-1 min-w-[660px]" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))", gridTemplateRows: "repeat(4,auto)" }}>
              {P.map((p) => <Cell key={p.i} p={p} sel={sel === p.i} onPick={setSel} dv={chart.hz?.dv === p.i} ln={chart.hz?.ln === p.i} />)}
              <div className="rounded-[6px] border p-3 flex flex-col items-center justify-center text-center gap-1" style={{ gridRow: "2 / span 2", gridColumn: "2 / span 2", background: "radial-gradient(circle at 50% 35%,#2B2619,#1E2126)", borderColor: C.goldDim }}>
                <div className="font-brush text-[30px] leading-none" style={{ color: C.gold }}>紫微斗数</div>
                {f.name && <div className="text-[17px] font-bold mt-1">{f.name}</div>}
                <div className="text-[13px]">{ch.gender} · {ch.solarDate} (DL)</div>
                <div className="text-[13px]">{ch.lunarDate}</div>
                <div className="text-[13px]" style={{ color: C.mute }}>{ch.time} · {ch.timeRange}</div>
                <div className="font-zh text-[15px] mt-1" style={{ color: "#F3E7C8" }}>{chart.z.chineseDate}</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[13px] mt-2 text-left">
                  <span style={{ color: C.mute }}>Cục</span><b>{ch.fiveElementsClass}</b>
                  <span style={{ color: C.mute }}>Mệnh chủ</span><b>{ch.soul}</b>
                  <span style={{ color: C.mute }}>Thân chủ</span><b>{ch.body}</b>
                  <span style={{ color: C.mute }}>Mệnh / Thân</span><b>{ming?.chi} / {shen?.vi}</b>
                  {chart.hz && <><span style={{ color: C.mute }}>Năm nay</span><b>{chart.hz.yname} · {chart.hz.age} tuổi</b></>}
                </div>
                <div className="flex gap-1.5 flex-wrap justify-center mt-2 text-[10px]">{Object.values(MUTAGEN).map(([n, c]) => <span key={n} className="px-1.5 rounded font-bold" style={{ background: c, color: "#fff" }}>{n}</span>)}</div>
              </div>
            </div>
          </div>
          <p className="text-[12px] -mt-2" style={{ color: C.mute }}>ĐV = cung đại vận hiện tại · LN = cung lưu niên năm nay · chữ xanh: cát tinh, đỏ: sát tinh, hồng: đào hoa. Bấm vào một cung để xem luận giải.</p>

          <Panel>
            <H2 zh="命格">Tổng quan lá số</H2>
            <div className="grid sm:grid-cols-3 gap-2 text-[14px]">
              <div className="rounded-[8px] border p-3" style={{ borderColor: C.line, background: C.card }}><div className="text-[12px]" style={{ color: C.mute }}>Ngũ hành cục <span className="font-zh">{chart.z.fiveElementsClass}</span></div><b>{ch.fiveElementsClass}</b><div className="text-[13px] mt-1">{CLASS[chart.z.fiveElementsClass]}</div></div>
              <div className="rounded-[8px] border p-3" style={{ borderColor: C.line, background: C.card }}><div className="text-[12px]" style={{ color: C.mute }}>Mệnh chủ <span className="font-zh">命主 {chart.z.soul}</span></div><b>{ch.soul}</b><div className="text-[13px] mt-1">Sao chủ của bản mệnh, theo chi cung Mệnh — nét tính cách gốc.</div></div>
              <div className="rounded-[8px] border p-3" style={{ borderColor: C.line, background: C.card }}><div className="text-[12px]" style={{ color: C.mute }}>Thân chủ <span className="font-zh">身主 {chart.z.body}</span></div><b>{ch.body}</b><div className="text-[13px] mt-1">Thân cư cung <b>{shen?.vi}</b>: từ khoảng 30 tuổi trở đi, lĩnh vực này ảnh hưởng mạnh đến cuộc sống.</div></div>
            </div>
            <p className="text-[14px] mt-3">Cung Mệnh tại <b>{ming.can} {ming.chi}</b>: {ming.major.length ? <>chính tinh <b>{ming.major.map((s) => s.vi).join(" – ")}</b> <span className="font-zh" style={{ color: C.gold }}>{ming.major.map((s) => s.zh).join("")}</span> {py(ming.major.map((s) => s.zh).join(" "))}.</> : "vô chính diệu."} Xem chi tiết từng cung ở bảng dưới, rồi bấm “Luận giải chi tiết” để có bài luận đầy đủ.</p>
          </Panel>

          {sel != null && <Detail P={P} i={sel} />}

          <Panel>
            <H2 zh="论命">Luận giải chi tiết</H2>
            {!ai ? (
              <>
                <p className="text-[14px] mb-3" style={{ color: C.mute }}>AI đọc toàn bộ lá số (14 chính tinh, phụ tinh, Tứ hoá, tam phương tứ chính, đại vận và lưu niên năm nay) rồi viết bài luận: tính cách, sự nghiệp, tài lộc, tình duyên, gia đạo, sức khoẻ, vận năm nay, kèm thuật ngữ tiếng Trung để học. Cần đăng nhập · tối đa 8 lượt/ngày.</p>
                <button onClick={askAI} disabled={busy} className="h-11 px-5 rounded-[8px] font-bold disabled:opacity-60" style={{ background: C.gold, color: "#16181C" }}>{busy ? "Đang luận giải… (khoảng 20–40 giây)" : "✦ Luận giải chi tiết"}</button>
              </>
            ) : (
              <div id="ai" className="flex flex-col gap-3 scroll-mt-20">
                {AI_SEC.filter(([k]) => ai[k]).map(([k, zh, vi]) => (
                  <div key={k} className="rounded-[8px] border p-3 md:p-4" style={{ background: C.card, borderColor: C.line }}>
                    <div className="font-bold mb-1"><span className="font-zh mr-2" style={{ color: C.gold }}>{zh}</span>{vi}</div>
                    <p className="text-[15px] leading-relaxed whitespace-pre-line">{ai[k]}</p>
                  </div>
                ))}
                {ai.cach_cuc?.filter((x) => x.ten).length > 0 && (
                  <div className="rounded-[8px] border p-3 md:p-4" style={{ background: C.card, borderColor: C.goldDim }}>
                    <div className="font-bold mb-1"><span className="font-zh mr-2" style={{ color: C.gold }}>格局</span>Cách cục nổi bật</div>
                    {ai.cach_cuc.filter((x) => x.ten).map((x) => <p key={x.ten} className="text-[15px] mb-1.5"><b style={{ color: C.gold }}>{x.ten}</b> — {x.giai}</p>)}
                  </div>
                )}
                {ai.loi_khuyen?.length > 0 && <div className="rounded-[8px] border p-3 md:p-4" style={{ background: C.greenSoft, borderColor: "#2E4A33" }}><div className="font-bold mb-1">Lời khuyên</div><ul className="grid gap-1 text-[15px]">{ai.loi_khuyen.map((x) => <li key={x}>◆ {x}</li>)}</ul></div>}
                {ai.tu_vung?.length > 0 && (
                  <div className="rounded-[8px] border p-3 md:p-4" style={{ background: C.card, borderColor: C.line }}>
                    <div className="font-bold mb-2"><span className="font-zh mr-2" style={{ color: C.gold }}>词汇</span>Thuật ngữ để học</div>
                    <div className="grid sm:grid-cols-2 gap-1.5">{ai.tu_vung.map((w) => <button key={w.zh} onClick={() => speak(w.zh)} className="text-left rounded-[6px] border px-3 py-1.5" style={{ borderColor: C.line }}><span className="font-zh text-[18px] font-bold" style={{ color: C.gold }}>{w.zh}</span> <span className="text-[13px]" style={{ color: C.goldDim }}>{w.py}</span><div className="text-[13px]">{w.vi}</div></button>)}</div>
                  </div>
                )}
                <p className="text-[12px]" style={{ color: C.mute }}>Bài luận do AI viết dựa trên lá số, chỉ mang tính tham khảo văn hoá; đừng dùng để thay cho quyết định quan trọng về sức khoẻ, tài chính hay các mối quan hệ.</p>
                <button onClick={() => setAi(null)} className="self-start h-9 px-4 rounded-[8px] border text-[13px] font-bold" style={{ borderColor: C.line }}>Luận lại</button>
              </div>
            )}
          </Panel>
        </div>
      )}
    </Shell>
  );
}
