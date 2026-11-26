"use client";
// 紫微斗数 — Lập lá số Tử vi (an sao bằng thư viện iztro) + luận giải cơ bản theo từ điển sao + luận giải chi tiết bằng AI
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Shell, Panel, H2, usePy, speak, C } from "../ui";
import { PALACE, MAJOR, MINOR, MUTAGEN, BRIGHT, BRIGHT_NOTE, CLASS, tuanPair, trietPair, TUAN_TRIET, BAC_SI, vnStars, vnMinor, vnBright, luuStars, tieuHan, nguyetHan, napAm, NAYIN_NOTE, canLuong, menhChuVN, thanChuVN, ZHI_YANG, WX_REL } from "../../../lib/tuvi-data";

const HOURS = ["Tý sớm (00–01h)", "Sửu (01–03h)", "Dần (03–05h)", "Mão (05–07h)", "Thìn (07–09h)", "Tỵ (09–11h)", "Ngọ (11–13h)", "Mùi (13–15h)", "Thân (15–17h)", "Dậu (17–19h)", "Tuất (19–21h)", "Hợi (21–23h)", "Tý muộn (23–24h)"];
const POS = { 巳: [1, 1], 午: [1, 2], 未: [1, 3], 申: [1, 4], 辰: [2, 1], 酉: [2, 4], 卯: [3, 1], 戌: [3, 4], 寅: [4, 1], 丑: [4, 2], 子: [4, 3], 亥: [4, 4] };
const OPP = { 子: "午", 丑: "未", 寅: "申", 卯: "酉", 辰: "戌", 巳: "亥", 午: "子", 未: "丑", 申: "寅", 酉: "卯", 戌: "辰", 亥: "巳" };
const KIND = { cát: "#7CC48A", sát: "#E07A63", đào: "#E58FB4", trung: "#C9B98A" };
const inp = "h-10 px-3 rounded-[8px] border text-[15px] focus:outline-none";
const inpS = { background: "#262A31", borderColor: "#363B45", color: "#ECE4D3" };

function hourFromNow() { const h = new Date().getHours(); return h === 23 ? 12 : Math.floor((h + 1) / 2); }

// Tuần/Triệt vẽ riêng ở ranh giới hai cung (theo lối Việt) nên bỏ bản an một cung của iztro; vòng Thái Tuế an lại theo tên Việt
const SKIP = new Set(["旬空", "截路", "空亡", "天月", "阴煞", "天巫", "年解", "蜚廉", "解神", "天德", "月德", "大耗"]);
const VI_NAME = { 台辅: "Thai Phụ", 凤阁: "Phượng Các", 咸池: "Đào Hoa", 天姚: "Thiên Diêu", 天刑: "Thiên Hình" };
const VN_MINOR_VI = { 天魁: "Thiên Khôi", 天钺: "Thiên Việt", 火星: "Hoả Tinh", 铃星: "Linh Tinh" };
// thêm sao theo trường phái Việt + Tuần/Triệt
function addVN(P, z, v, hour, male) {
  const [yg, yz] = z.rawDates.chineseDate.yearly;
  const lm = v.rawDates?.lunarDate?.lunarMonth, ld = v.rawDates?.lunarDate?.lunarDay;
  const find = (zh, k = "adj") => P.find((p) => p[k].some((s) => s.zh === zh))?.zhi;
  const locTon = find("禄存", "minor");
  // Khôi Việt, Hoả Linh an lại theo sách Việt
  const vm = vnMinor({ yg, yz, hour, male });
  P.forEach((p) => { p.minor = p.minor.filter((s) => !VN_MINOR_VI[s.zh]); });
  Object.entries(VN_MINOR_VI).forEach(([zh, vi]) => P.find((p) => p.zhi === vm[zh])?.minor.push({ vi, zh, br: "", mu: "" }));
  // Ân Quang, Thiên Quý theo sách Việt: Ân Quang từ Văn Xương đếm thuận đến ngày sinh rồi lùi 1; Thiên Quý từ Văn Khúc đếm nghịch đến ngày sinh rồi tiến 1
  if (ld) {
    const ZH = "子丑寅卯辰巳午未申酉戌亥", ix = (k) => ZH[((k % 12) + 12) % 12];
    const xi = ZH.indexOf(find("文昌", "minor")), ki = ZH.indexOf(find("文曲", "minor"));
    P.forEach((p) => { p.adj = p.adj.filter((s) => s.zh !== "恩光" && s.zh !== "天贵"); });
    if (xi >= 0) P.find((p) => p.zhi === ix(xi + ld - 2))?.adj.push({ vi: "Ân Quang", zh: "恩光", br: "", mu: "" });
    if (ki >= 0) P.find((p) => p.zhi === ix(ki - ld + 2))?.adj.push({ vi: "Thiên Quý", zh: "天贵", br: "", mu: "" });
  }
  const ext = vnStars({ yg, yz, lm, hour, locTon, male, yao: find("天姚"), fengge: find("凤阁") });
  const tuan = tuanPair(yg, yz), triet = trietPair(yg);
  const year = new Date().getFullYear(), L = luuStars(year), TH = tieuHan(yz, male);
  const thNow = Object.keys(TH).find((k) => TH[k] === L.gz[1]);
  const NH = thNow && lm ? nguyetHan(thNow, Math.abs(lm), hour) : {};
  P.forEach((p) => {
    p.ext = ext[p.zhi] || []; p.luu = L.out[p.zhi] || []; p.th = TH[p.zhi]; p.thNow = p.zhi === thNow; p.nh = NH[p.zhi];
    p.tt = [tuan.includes(p.zhi) && "Tuần", triet.includes(p.zhi) && "Triệt"].filter(Boolean);
    [...p.major, ...p.minor, ...p.adj, ...p.ext].forEach((s) => { s.vbr = vnBright(s.zh, p.zhi); });
  });
  // thông tin tổng quát theo lối Việt
  const ny = napAm(yg, yz), cucWx = (z.fiveElementsClass || "")[0], nyWx = ny[2];
  const ming = P.find((p) => p.zh === "命宫"), body = P.find((p) => p.body);
  const yang = "甲丙戊庚壬".includes(yg);
  const lai = P.find((p) => p.gan === yg);
  const rel = WX_REL(cucWx, nyWx);
  return {
    tuan, triet, year, yearGz: L.gz, thNow,
    info: {
      amduong: `${yang ? "Dương" : "Âm"} ${male ? "Nam" : "Nữ"} (${yang === ZHI_YANG(ming?.zhi) ? "Âm dương thuận lý" : "Âm dương nghịch lý"})`,
      menh: `${NAYIN_NOTE[ny]?.[0] || ny} (${NAYIN_NOTE[ny]?.[1] || ""})`, menhZh: ny,
      cucRel: rel === "bình hoà" ? `Cục và Mệnh cùng hành (bình hoà)` : rel === "sinh" ? `Cục sinh Mệnh — tốt` : rel === "được sinh bởi" ? `Mệnh sinh Cục — hao tổn` : rel === "khắc" ? `Cục khắc Mệnh — vất vả` : `Mệnh khắc Cục — phải tự lực`,
      menhChu: menhChuVN(yz), thanChu: thanChuVN(yz),
      canLuong: lm && ld ? canLuong(yg, yz, lm, ld, hour) : "",
      laiNhan: lai ? PALACE[lai.zh]?.vi || lai.vi : "", thanCu: body ? PALACE[body.zh]?.vi || body.vi : "",
    },
  };
}

// gộp lá số tiếng Việt + tiếng Trung theo thứ tự cung/sao
function merge(v, z) {
  return v.palaces.map((p, i) => {
    const q = z.palaces[i];
    const stars = (k) => p[k].map((s, j) => ({ vi: VI_NAME[q[k][j]?.name] || s.name, zh: q[k][j]?.name, br: q[k][j]?.brightness || "", mu: q[k][j]?.mutagen || "" }));
    return { i, vi: p.name, zh: q.name, can: p.heavenlyStem, chi: p.earthlyBranch, zhi: q.earthlyBranch, gan: q.heavenlyStem, body: p.isBodyPalace, major: stars("majorStars"), minor: stars("minorStars"), adj: stars("adjectiveStars").filter((s) => !SKIP.has(s.zh)), dv: p.decadal.range, cs: p.changsheng12, csz: q.changsheng12, bs: q.boshi12 };
  });
}

const VBR_NOTE = { M: "Miếu địa — vị trí đẹp nhất, sao phát huy hết mặt tốt", V: "Vượng địa — sao mạnh, tốt", Đ: "Đắc địa — sao được việc, khá tốt", B: "Bình hoà — trung bình", H: "Hãm địa — sao yếu, dễ lộ mặt xấu" };
function Star({ s, big }) {
  const mu = s.mu && MUTAGEN[s.mu];
  return (
    <span className={"inline-flex items-baseline gap-x-0.5 flex-wrap leading-tight " + (big ? "text-[11px] md:text-[13px] font-bold" : "text-[9.5px] md:text-[11px]")}>
      <span style={{ color: big ? "#F3E7C8" : KIND[MINOR[s.zh]?.[1]] || C.mute }}>{s.vi}</span>
      {s.vbr && <span className="text-[8.5px] md:text-[10px]" style={{ color: s.vbr === "H" ? "#C98A7E" : C.mute }}>({s.vbr})</span>}
      {mu && <span className="text-[8.5px] md:text-[10px] font-bold px-0.5 rounded" style={{ background: mu[1], color: "#fff" }}>{mu[0].replace("Hoá ", "")}</span>}
    </span>
  );
}
const Small = ({ list }) => list.map((s) => <span key={s.zh} className={"text-[8.5px] md:text-[10px] leading-tight" + (s.luu ? " italic" : "")} style={{ color: s.luu ? "#8AB8E6" : KIND[MINOR[s.zh]?.[1] || s.k] || C.mute }}>{s.vi}{s.vbr ? <span style={{ color: s.vbr === "H" ? "#C98A7E" : C.mute }}> ({s.vbr})</span> : null}</span>);

function Cell({ p, sel, onPick, dv, ln }) {
  const [r, c] = POS[p.zhi];
  const ming = p.zh === "命宫";
  return (
    <button type="button" onClick={() => onPick(p.i)} style={{ gridRow: r, gridColumn: c, background: sel ? "#3A3222" : C.card, borderColor: sel ? C.gold : ming ? "#8F7642" : C.line }}
      className="relative min-w-0 text-left rounded-[4px] md:rounded-[6px] border p-1 md:p-1.5 flex flex-col gap-0.5 min-h-[130px] md:min-h-[170px] hover:border-[#D4AF5F] overflow-hidden">
      <div className="flex items-start gap-0.5 flex-wrap">
        <span className="text-[9.5px] md:text-[12px] font-extrabold uppercase leading-tight" style={{ color: ming ? "#E07A63" : C.gold }}>{PALACE[p.zh]?.vi || p.vi}</span>
        {p.body && <span className="text-[8px] md:text-[9px] font-bold px-0.5 rounded" style={{ background: "#3D2420", color: "#E07A63" }}>THÂN</span>}
        {dv && <span className="text-[8px] md:text-[9px] font-bold px-0.5 rounded" style={{ background: "#22382A", color: "#7CC48A" }} title="Đại vận hiện tại">ĐV</span>}
        {ln && <span className="text-[8px] md:text-[9px] font-bold px-0.5 rounded" style={{ background: "#1F3550", color: "#8AB8E6" }} title="Lưu niên năm nay">LN</span>}
      </div>
      <div className="flex flex-col">{p.major.length ? p.major.map((s) => <Star key={s.zh} s={s} big />) : <span className="text-[9.5px] md:text-[11px] italic" style={{ color: C.mute }}>Vô chính diệu</span>}</div>
      <div className="flex flex-wrap gap-x-1">{p.minor.map((s) => <Star key={s.zh} s={s} />)}</div>
      <div className="flex flex-wrap gap-x-1 opacity-90"><Small list={[...p.adj, ...(p.ext || []).filter((x) => !THAI_TUE_ZH.has(x.zh))]} /></div>
      <div className="mt-auto pt-0.5 flex flex-wrap gap-x-1 border-t border-dashed" style={{ borderColor: C.line }}>
        {p.bs && <span className="text-[8.5px] md:text-[10px]" style={{ color: "#9FB7C9" }}>{BAC_SI[p.bs] || p.bs}</span>}
        <Small list={(p.ext || []).filter((x) => THAI_TUE_ZH.has(x.zh))} />
      </div>
      {p.luu?.length > 0 && <div className="flex flex-wrap gap-x-1"><Small list={p.luu} /></div>}
      <div className="flex items-end justify-between gap-1 text-[8.5px] md:text-[10px]" style={{ color: C.mute }}>
        <span className="whitespace-nowrap">{p.can} {p.chi}</span><span className="hidden sm:inline truncate">{p.cs}</span><span className="font-bold whitespace-nowrap" style={{ color: "#CFC3A8" }}>{p.dv[0]}–{p.dv[1]}</span>
      </div>
      <div className="sm:hidden text-[8.5px] -mt-0.5" style={{ color: C.mute }}>{p.cs}</div>
      <div className="flex items-center justify-between gap-1 text-[8.5px] md:text-[10px]" style={{ color: C.mute }}>
        <span title="Tiểu hạn: năm có chi này đi qua cung" className={p.thNow ? "font-bold px-0.5 rounded" : ""} style={p.thNow ? { background: "#3A3222", color: C.gold } : {}}>TH {CHI_VI[p.th] || ""}</span>
        {p.nh && <span title="Nguyệt hạn năm nay">Th.{p.nh}</span>}
      </div>
    </button>
  );
}
const CHI_VI = { 子: "Tý", 丑: "Sửu", 寅: "Dần", 卯: "Mão", 辰: "Thìn", 巳: "Tỵ", 午: "Ngọ", 未: "Mùi", 申: "Thân", 酉: "Dậu", 戌: "Tuất", 亥: "Hợi" };
const THAI_TUE_ZH = new Set(["太岁", "少阳", "丧门", "少阴", "官符", "死符", "岁破", "龙德", "白虎", "福德", "吊客", "直符"]);

// nhãn Tuần / Triệt đặt trên ranh giới giữa hai cung
function TTTag({ pair, label }) {
  const [a, b] = pair.map((z) => POS[z]);
  const top = ((a[0] + b[0]) / 2 - 0.5) * 25, left = ((a[1] + b[1]) / 2 - 0.5) * 25;
  return <span className="absolute z-10 -translate-x-1/2 -translate-y-1/2 text-[9px] md:text-[11px] font-black px-1.5 py-0.5 rounded shadow" style={{ top: `${top}%`, left: `${left}%`, background: label === "Tuần" ? "#4A3F8C" : "#7A2218", color: "#fff", border: "1px solid #ECE4D3" }} title={TUAN_TRIET[label][1]}>{label}</span>;
}

function Detail({ P, i }) {
  const py = usePy();
  const p = P[i]; const opp = P.find((x) => x.zhi === OPP[p.zhi]);
  const info = PALACE[p.zh] || {};
  const majors = p.major.length ? p.major : opp.major;
  const all = [...p.minor, ...p.adj, ...(p.ext || [])].filter((s) => MINOR[s.zh]);
  const mus = [...p.major, ...p.minor].filter((s) => s.mu);
  return (
    <Panel>
      <H2 zh={p.zh} right={`${p.can} ${p.chi} · đại vận ${p.dv[0]}–${p.dv[1]} tuổi`}>Cung {info.vi || p.vi}{p.body ? " · Thân cư" : ""}</H2>
      <p className="text-[14px] mb-3" style={{ color: C.mute }}>{info.y}</p>
      {(p.tt || []).map((t) => <p key={t} className="text-[14px] mb-3 rounded-[8px] border px-3 py-2" style={{ borderColor: t === "Tuần" ? "#4A3F8C" : "#7A2218", background: C.card }}><b>{t} <span className="font-zh">{TUAN_TRIET[t][0]}</span></b> án ngữ cung này. {TUAN_TRIET[t][1]}</p>)}
      {p.bs && <p className="text-[13px] mb-3" style={{ color: C.mute }}>Vòng Bác sĩ: <b style={{ color: "#9FB7C9" }}>{BAC_SI[p.bs]}</b> <span className="font-zh">{p.bs}</span> · Tràng sinh: <b>{p.cs}</b> <span className="font-zh">{p.csz}</span></p>}
      {!p.major.length && <p className="text-[14px] mb-3 rounded-[8px] border px-3 py-2" style={{ borderColor: C.goldDim, background: "#2B2619" }}><b>Vô chính diệu</b> (cung không có chính tinh): theo lệ, mượn chính tinh của cung đối diện — <b>{PALACE[opp.zh]?.vi}</b> — để luận, tính chất nhẹ và dễ thay đổi theo hoàn cảnh hơn.</p>}
      <div className="grid gap-2">
        {majors.map((s) => { const m = MAJOR[s.zh]; if (!m) return null; return (
          <div key={s.zh} className="rounded-[8px] border p-3" style={{ background: C.card, borderColor: C.line }}>
            <div className="flex items-baseline gap-2 flex-wrap">
              <button onClick={() => speak(s.zh)} className="font-zh text-[22px] font-bold" style={{ color: C.gold }}>{s.zh}</button>
              <span className="text-[13px]" style={{ color: C.goldDim }}>{py(s.zh)}</span>
              <b className="text-[16px]">{m.hv}</b>
              {s.vbr && <span className="text-[12px] px-1.5 rounded" style={{ background: C.panel, color: C.mute }}>{VBR_NOTE[s.vbr]}</span>}
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

function chartText(v, P, hz, name, tt) {
  const st = (a) => a.map((s) => `${s.vi} ${s.zh}${s.vbr ? `(${s.vbr})` : ""}${s.mu ? `[Hoá ${MUTAGEN[s.mu][0].replace("Hoá ", "")}]` : ""}`).join(", ");
  const head = [`Đương số: ${name || "—"}, ${v.gender}, sinh dương lịch ${v.solarDate}, ${v.lunarDate}, giờ ${v.time} (${v.timeRange}).`,
    `Bát tự: ${v.chineseDate}. Cục: ${v.fiveElementsClass}${tt?.info ? ` (${tt.info.cucRel}); ${tt.info.amduong}; bản mệnh ${tt.info.menh}; cân lượng ${tt.info.canLuong}; lai nhân cung ${tt.info.laiNhan}` : ""}. Mệnh chủ: ${tt?.info?.menhChu || v.soul}. Thân chủ: ${tt?.info?.thanChu || v.body}. Mệnh tại ${v.earthlyBranchOfSoulPalace}, Thân tại ${v.earthlyBranchOfBodyPalace}.`,
    hz ? `Hiện tại (năm ${new Date().getFullYear()}, ${hz.age} tuổi mụ): đại vận ở cung ${P[hz.dv].vi} (${P[hz.dv].dv.join("–")} tuổi), lưu niên ${hz.yname} ở cung ${P[hz.ln].vi}.` : ""];
  return head.join("\n") + "\n" + P.map((p) => `Cung ${p.vi} 「${p.zh}」 tại ${p.can} ${p.chi}${p.body ? " (Thân cư)" : ""}, đại vận ${p.dv.join("–")}: chính tinh: ${p.major.length ? st(p.major) : "vô chính diệu"}; phụ tinh: ${st(p.minor) || "—"}; sao khác: ${[...p.adj, ...(p.ext || [])].map((s) => s.vi).join(", ") || "—"}; vòng Bác sĩ: ${BAC_SI[p.bs] || "—"}; tràng sinh: ${p.cs}${p.tt?.length ? `; bị ${p.tt.join(" và ")} án ngữ` : ""}${p.luu?.length ? `; lưu niên: ${p.luu.map((x) => x.vi).join(", ")}` : ""}${p.thNow ? "; TIỂU HẠN năm nay" : ""}.`).join("\n");
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
      const v = run("vi-VN"), z = run("zh-CN"); const P = merge(v, z); const tt = addVN(P, z, v, +f.h, f.gender === "男");
      let hz = null;
      try { const h = v.horoscope(new Date()); hz = { dv: h.decadal.index, ln: h.yearly.index, age: h.age?.nominalAge, yname: `${h.yearly.heavenlyStem} ${h.yearly.earthlyBranch}` }; } catch {}
      setChart({ v, z, P, hz, tt }); setSel(P.findIndex((p) => p.zh === "命宫"));
      try { localStorage.setItem("tuvi_form", JSON.stringify(f)); } catch {}
      setTimeout(() => document.getElementById("laso")?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) { setErr("Ngày sinh không hợp lệ: " + (e.message || e)); }
  };
  const askAI = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/tu-vi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chart: chartText(chart.v, chart.P, chart.hz, f.name, chart.tt), year: new Date().getFullYear() }) });
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
      <div className="flex items-center gap-2 text-[13px] mb-3" style={{ color: C.mute }}><Link href="/huyen-hoc" className="hover:underline">‹ 玄门学宫</Link><span>/</span><Link href="/huyen-hoc/cong-cu" className="hover:underline">法器</Link><Link href="/huyen-hoc/bat-tu" className="ml-auto font-bold hover:underline" style={{ color: C.gold }}>Xem Bát tự 八字 ›</Link></div>
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
          <div className="-mx-2 md:mx-0">
            <div className="relative grid gap-[3px] md:gap-1" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))", gridTemplateRows: "repeat(4,1fr)" }}>
              {chart.tt && <><TTTag pair={chart.tt.tuan} label="Tuần" /><TTTag pair={chart.tt.triet} label="Triệt" /></>}
              {P.map((p) => <Cell key={p.i} p={p} sel={sel === p.i} onPick={setSel} dv={chart.hz?.dv === p.i} ln={chart.hz?.ln === p.i} />)}
              <div className="min-w-0 rounded-[6px] border p-1.5 md:p-3 flex flex-col items-center justify-center text-center gap-0.5 md:gap-1 text-[10.5px] md:text-[13px]" style={{ gridRow: "2 / span 2", gridColumn: "2 / span 2", background: "radial-gradient(circle at 50% 35%,#2B2619,#1E2126)", borderColor: C.goldDim }}>
                <div className="font-brush text-[20px] md:text-[30px] leading-none" style={{ color: C.gold }}>紫微斗数</div>
                {f.name && <div className="text-[13px] md:text-[17px] font-bold mt-1 leading-tight">{f.name}</div>}
                <div>{ch.gender} · {ch.solarDate} (DL)</div>
                <div>{ch.lunarDate}</div>
                <div style={{ color: C.mute }}>{ch.time} · {ch.timeRange}</div>
                <div className="font-zh text-[12px] md:text-[15px] mt-1" style={{ color: "#F3E7C8" }}>{chart.z.chineseDate}</div>
                <div className="grid grid-cols-[auto_auto] gap-x-2 md:gap-x-4 gap-y-0.5 mt-1 md:mt-2 text-left">
                  {chart.tt?.info && <><span style={{ color: C.mute }}>Âm dương</span><b>{chart.tt.info.amduong}</b>
                  <span style={{ color: C.mute }}>Bản mệnh</span><b>{chart.tt.info.menh}</b></>}
                  <span style={{ color: C.mute }}>Cục</span><b>{ch.fiveElementsClass}{chart.tt?.info ? <span className="block font-normal text-[0.9em]" style={{ color: C.mute }}>{chart.tt.info.cucRel}</span> : null}</b>
                  <span style={{ color: C.mute }}>Mệnh chủ</span><b>{chart.tt?.info?.menhChu || ch.soul}</b>
                  <span style={{ color: C.mute }}>Thân chủ</span><b>{chart.tt?.info?.thanChu || ch.body}</b>
                  <span style={{ color: C.mute }}>Mệnh / Thân cư</span><b>{ming?.chi} / {shen?.vi}</b>
                  {chart.tt?.info?.canLuong && <><span style={{ color: C.mute }}>Cân lượng</span><b>{chart.tt.info.canLuong}</b></>}
                  {chart.tt?.info?.laiNhan && <><span style={{ color: C.mute }}>Lai nhân</span><b>cung {chart.tt.info.laiNhan}</b></>}
                  {chart.hz && <><span style={{ color: C.mute }}>Năm nay</span><b>{chart.hz.yname} · {chart.hz.age} tuổi</b></>}
                  {chart.tt && <><span style={{ color: C.mute }}>Tuần / Triệt</span><b>{chart.tt.tuan.join("")} / {chart.tt.triet.join("")}</b></>}
                </div>
                <div className="hidden md:flex gap-1.5 flex-wrap justify-center mt-2 text-[10px]">{Object.values(MUTAGEN).map(([n, c]) => <span key={n} className="px-1.5 rounded font-bold" style={{ background: c, color: "#fff" }}>{n}</span>)}</div>
              </div>
            </div>
          </div>
          <p className="text-[12px] -mt-2" style={{ color: C.mute }}>ĐV = cung đại vận hiện tại · LN = cung lưu niên năm nay · <b style={{ color: "#B9AEF0" }}>Tuần</b> / <b style={{ color: "#E07A63" }}>Triệt</b> án ngữ hai cung hai bên nhãn · chữ xanh: cát tinh, đỏ: sát tinh, hồng: đào hoa · dưới vạch: vòng Bác sĩ (xanh nhạt) và vòng Thái Tuế · <i style={{ color: "#8AB8E6" }}>L.</i> = sao lưu niên năm nay · TH = tiểu hạn (năm có chi đó đi qua cung, ô vàng là năm nay) · Th. = nguyệt hạn tháng âm năm nay · độ sáng theo sách Việt: M miếu, V vượng, Đ đắc, B bình hoà, H hãm. Bấm vào một cung để xem luận giải.</p>

          <Panel>
            <H2 zh="命格">Tổng quan lá số</H2>
            <div className="grid sm:grid-cols-3 gap-2 text-[14px]">
              <div className="rounded-[8px] border p-3" style={{ borderColor: C.line, background: C.card }}><div className="text-[12px]" style={{ color: C.mute }}>Ngũ hành cục <span className="font-zh">{chart.z.fiveElementsClass}</span></div><b>{ch.fiveElementsClass}</b><div className="text-[13px] mt-1">{CLASS[chart.z.fiveElementsClass]}</div></div>
              <div className="rounded-[8px] border p-3" style={{ borderColor: C.line, background: C.card }}><div className="text-[12px]" style={{ color: C.mute }}>Mệnh chủ <span className="font-zh">命主</span></div><b>{chart.tt?.info?.menhChu || ch.soul}</b><div className="text-[13px] mt-1">Sao chủ của bản mệnh (sách Việt an theo chi năm sinh; sách Trung Quốc theo chi cung Mệnh: {ch.soul}) — nét tính cách gốc.</div></div>
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
