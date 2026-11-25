"use client";
// HUYỀN HỌC 玄学 — học tiếng Trung qua Âm dương Ngũ hành, Can Chi, Kinh Dịch, Bát tự, Phong thuỷ, Hoàng lịch
// Bài học + công cụ tra cứu; mọi kết quả đều hiện chữ Hán kèm pinyin để học
import { useEffect, useMemo, useState } from "react";
import GardenNav from "../../GardenNav";
import Link from "next/link";
import {
  WX, WX_ORDER, SHENG, KE, GAN, ZHI, ganOf, zhiOf, wxOf, GUA8, guaOf, guaByLines, GUA64, guaBy6,
  mingGua, YIJI, VOCAB, IDIOMS, SHISHEN,
} from "../../../lib/huyenhoc";
import { PY_DICT } from "../../../lib/hh/pydict";

const RED = "#9E2F22";
// pinyin-pro đọc sai một số chữ đa âm trong ngữ cảnh Kinh Dịch → sửa tay
const PYFIX = { 否: "pǐ", 屯: "zhūn", 贲: "bì", 噬嗑: "shì kè", 兑: "duì", 泽: "zé", 大畜: "dà xù", 小畜: "xiǎo xù", 长男: "zhǎng nán", 长女: "zhǎng nǚ", 长夏: "cháng xià", 乾: "qián", 中孚: "zhōng fú", 既济: "jì jì", 未济: "wèi jì", 观: "guān", 蛊: "gǔ", 遯: "dùn", 夬: "guài", 姤: "gòu", 艮: "gèn", 巽: "xùn", 坎: "kǎn", 坤: "kūn", 离: "lí", 震: "zhèn", 卦: "guà", 爻: "yáo", 煞: "shà", 冲: "chōng", 宜: "yí", 忌: "jì", 行: "xíng", 五行: "wǔ xíng", 属相: "shǔ xiang", 算命: "suàn mìng", 纳音: "nà yīn", 阳爻: "yáng yáo", 阴爻: "yīn yáo" };

let PY = null;
function usePy() {
  const [fn, setFn] = useState(() => PY);
  useEffect(() => { if (!PY) import("pinyin-pro").then((m) => { try { m.customPinyin(PY_DICT); } catch {} PY = m.pinyin; setFn(() => m.pinyin); }).catch(() => {}); }, []);
  return (t) => (PYFIX[t] ? PYFIX[t] : fn ? fn(t, { type: "string" }) : "");
}

// chữ Hán + pinyin nhỏ phía trên
function Zh({ t, py, big, className = "", color }) {
  const p = usePy();
  const s = py ?? p(t);
  return (
    <span className={"inline-flex flex-col items-center leading-tight align-bottom " + className}>
      <span className="text-[11px] text-[#8A7F6C] font-medium whitespace-nowrap">{s || " "}</span>
      <span className={(big ? "text-[26px] " : "text-[17px] ") + "font-zh font-bold"} style={color ? { color } : undefined}>{t}</span>
    </span>
  );
}
// câu tiếng Trung + pinyin + nghĩa
function Sent({ zh, vi, src }) {
  const p = usePy();
  return (
    <div className="rounded-[6px] bg-[#FBF8F1] border border-[#E2D6BC] px-3.5 py-2.5">
      <div className="font-zh text-[18px] font-bold text-[#1C1A17]">{zh}{src && <span className="ml-2 text-xs font-normal text-[#8A7F6C]">{src}</span>}</div>
      <div className="text-[13px] text-[#8A7F6C]">{p(zh)}</div>
      <div className="text-[14px] text-[#3D372D]">{vi}</div>
    </div>
  );
}
function Card({ title, zh, children, className = "" }) {
  return (
    <section className={"rounded-[8px] bg-[#FBF8F1] border border-[#D8CBAE] p-4 md:p-5 " + className}>
      {title && <h2 className="font-serif-vn text-[19px] font-extrabold mb-3 flex items-baseline gap-2">{zh && <span className="font-brush font-normal text-[24px]" style={{ color: RED }}>{zh}</span>}{title}</h2>}
      {children}
    </section>
  );
}
function P({ children }) { return <p className="text-[15px] leading-relaxed text-[#3D372D] mb-2.5">{children}</p>; }
function Vocab({ k }) {
  const p = usePy();
  return (
    <Card title="Từ vựng" zh="词">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {VOCAB[k].map(([zh, hv, vi]) => (
          <div key={zh} className="rounded-[6px] bg-white border border-[#E2D6BC] px-3 py-2">
            <div className="font-zh text-[19px] font-bold">{zh}</div>
            <div className="text-[13px] text-[#9E2F22]">{p(zh)}</div>
            <div className="text-[13px] text-[#3D372D]">{hv && <b>{hv}</b>}{hv && " · "}{vi}</div>
          </div>
        ))}
      </div>
      {IDIOMS[k] && <>
        <h3 className="font-bold mt-4 mb-2 text-[15px]">Thành ngữ 成语</h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {IDIOMS[k].map(([zh, vi]) => (
            <div key={zh} className="rounded-[6px] bg-white border border-[#E2D6BC] px-3 py-2">
              <div className="font-zh text-[18px] font-bold">{zh} <span className="text-[13px] font-normal text-[#9E2F22] font-sans">{p(zh)}</span></div>
              <div className="text-[13px] text-[#3D372D]">{vi}</div>
            </div>
          ))}
        </div>
      </>}
    </Card>
  );
}
function WxTag({ w, sm }) {
  if (!w) return null;
  return <span className={"inline-block rounded-[4px] font-zh font-bold " + (sm ? "px-1.5 text-[12px]" : "px-2 py-0.5 text-[13px]")} style={{ background: WX[w].soft, color: WX[w].color }}>{w}{!sm && " " + WX[w].hv}</span>;
}
const inp = "h-10 px-3 rounded-[6px] border border-[#D8CBAE] bg-white text-[15px] focus:outline-none focus:border-[#9E2F22]";
const btn = "h-10 px-4 rounded-[6px] font-bold text-[15px] text-white bg-[#9E2F22] hover:bg-[#86271C] disabled:opacity-50";
const btn2 = "h-10 px-3 rounded-[6px] font-bold text-[14px] border border-[#D8CBAE] bg-white hover:border-[#9E2F22]";

let LUNAR = null;
function useLunar() {
  const [L, setL] = useState(() => LUNAR);
  useEffect(() => { if (!LUNAR) import("lunar-javascript").then((m) => { LUNAR = m.default?.Solar ? m.default : m; setL(LUNAR); }).catch(() => {}); }, []);
  return L;
}

// =============== SVG ===============
function WuxingSvg() {
  const pos = {}; const order = ["火", "土", "金", "水", "木"];
  order.forEach((w, i) => { const a = (i * 72 - 90) * Math.PI / 180; pos[w] = [160 + 115 * Math.cos(a), 160 + 115 * Math.sin(a)]; });
  const seg = (a, b, r = 30) => { const [x1, y1] = pos[a], [x2, y2] = pos[b]; const d = Math.hypot(x2 - x1, y2 - y1); const ux = (x2 - x1) / d, uy = (y2 - y1) / d; return [x1 + ux * r, y1 + uy * r, x2 - ux * (r + 4), y2 - uy * (r + 4)]; };
  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-[340px] mx-auto" role="img" aria-label="Sơ đồ Ngũ hành tương sinh tương khắc">
      <defs>
        <marker id="ah1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#3F7D4E" /></marker>
        <marker id="ah2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="#B8432F" /></marker>
      </defs>
      {WX_ORDER.map((w) => { const [a, b, c, d] = seg(w, SHENG[w]); return <line key={"s" + w} x1={a} y1={b} x2={c} y2={d} stroke="#3F7D4E" strokeWidth="2.5" markerEnd="url(#ah1)" />; })}
      {WX_ORDER.map((w) => { const [a, b, c, d] = seg(w, KE[w]); return <line key={"k" + w} x1={a} y1={b} x2={c} y2={d} stroke="#B8432F" strokeWidth="1.6" strokeDasharray="5 4" markerEnd="url(#ah2)" />; })}
      {WX_ORDER.map((w) => (
        <g key={w}>
          <circle cx={pos[w][0]} cy={pos[w][1]} r="28" fill={WX[w].soft} stroke={WX[w].color} strokeWidth="2.5" />
          <text x={pos[w][0]} y={pos[w][1] + 2} textAnchor="middle" fontSize="22" fontWeight="700" fill={WX[w].color} className="font-zh">{w}</text>
          <text x={pos[w][0]} y={pos[w][1] + 17} textAnchor="middle" fontSize="9" fill={WX[w].color}>{WX[w].hv}</text>
        </g>
      ))}
    </svg>
  );
}
function Lines({ lines, moving = [], w = 54, gap = 7, h = 7, color = "#1C1A17" }) {
  // lines từ dưới lên → vẽ từ trên xuống
  const n = lines.length; const H = n * h + (n - 1) * gap;
  return (
    <svg width={w + 14} height={H} viewBox={`0 0 ${w + 14} ${H}`} aria-hidden="true">
      {[...lines].reverse().map((l, i) => {
        const y = i * (h + gap); const idx = n - 1 - i; const mv = moving.includes(idx);
        const c = mv ? RED : color;
        return (
          <g key={i}>
            {l ? <rect x="0" y={y} width={w} height={h} rx="1.5" fill={c} /> : <><rect x="0" y={y} width={w * 0.42} height={h} rx="1.5" fill={c} /><rect x={w * 0.58} y={y} width={w * 0.42} height={h} rx="1.5" fill={c} /></>}
            {mv && <text x={w + 4} y={y + h} fontSize="10" fill={RED}>{l ? "○" : "×"}</text>}
          </g>
        );
      })}
    </svg>
  );
}
function BaguaSvg({ onPick, sel }) {
  const at = { 离: 0, 坤: 1, 兑: 2, 乾: 3, 坎: 4, 艮: 5, 震: 6, 巽: 7 };
  return (
    <svg viewBox="0 0 340 340" className="w-full max-w-[360px] mx-auto" role="img" aria-label="Hậu thiên bát quái, phương Nam ở trên">
      <circle cx="170" cy="170" r="160" fill="#FBF8F1" stroke="#D8CBAE" />
      <circle cx="170" cy="170" r="38" fill="#fff" stroke="#D8CBAE" />
      {/* thái cực */}
      <g transform="translate(170 170)">
        <circle r="28" fill="#1C1A17" />
        <path d="M0 -28 A28 28 0 0 1 0 28 A14 14 0 0 1 0 0 A14 14 0 0 0 0 -28z" fill="#fff" />
        <circle cy="-14" r="4.5" fill="#1C1A17" /><circle cy="14" r="4.5" fill="#fff" />
      </g>
      {GUA8.map((g) => {
        const a = (at[g.zh] * 45 - 90) * Math.PI / 180; const x = 170 + 112 * Math.cos(a), y = 170 + 112 * Math.sin(a);
        const on = sel === g.zh;
        return (
          <g key={g.zh} transform={`translate(${x} ${y})`} onClick={() => onPick?.(g.zh)} style={{ cursor: "pointer" }}>
            <circle r="36" fill={on ? "#F3E3D2" : "transparent"} stroke={on ? RED : "transparent"} />
            <g transform="translate(-17 -27)">{[2, 1, 0].map((li, i) => g.lines[li] ? <rect key={i} x="0" y={i * 8} width="34" height="5" fill="#1C1A17" /> : <g key={i}><rect x="0" y={i * 8} width="14" height="5" fill="#1C1A17" /><rect x="20" y={i * 8} width="14" height="5" fill="#1C1A17" /></g>)}</g>
            <text y="16" textAnchor="middle" fontSize="17" fontWeight="700" fill={RED} className="font-zh">{g.zh}</text>
            <text y="29" textAnchor="middle" fontSize="9.5" fill="#6B6253">{g.houVi}</text>
          </g>
        );
      })}
    </svg>
  );
}

// =============== 1. ÂM DƯƠNG NGŨ HÀNH ===============
function TabWx() {
  return (
    <div className="flex flex-col gap-4">
      <Card title="Âm dương" zh="阴阳">
        <P>Người xưa thấy mọi sự vật đều có hai mặt đối lập mà nương nhau: sáng – tối, nóng – lạnh, động – tĩnh. Mặt sáng, nóng, động, hướng lên gọi là <b>阳 yáng</b>; mặt tối, lạnh, tĩnh, hướng xuống gọi là <b>阴 yīn</b>. Hai mặt này không đứng yên mà luôn chuyển hoá: cực dương sinh âm, cực âm sinh dương — như ngày nối đêm.</P>
        <div className="grid sm:grid-cols-2 gap-2 my-3">
          <div className="rounded-[6px] bg-white border border-[#E2D6BC] p-3"><b className="font-zh text-lg">阳</b> — {["日 mặt trời", "天 trời", "男 nam", "热 nóng", "动 động", "白天 ban ngày", "奇数 số lẻ"].join(" · ")}</div>
          <div className="rounded-[6px] bg-white border border-[#E2D6BC] p-3"><b className="font-zh text-lg">阴</b> — {["月 mặt trăng", "地 đất", "女 nữ", "冷 lạnh", "静 tĩnh", "夜晚 ban đêm", "偶数 số chẵn"].join(" · ")}</div>
        </div>
        <div className="grid gap-2">
          <Sent zh="一阴一阳之谓道。" vi="Một âm một dương, ấy gọi là Đạo." src="《系辞》" />
          <Sent zh="万物负阴而抱阳。" vi="Muôn vật cõng âm mà ôm dương." src="《道德经》" />
          <Sent zh="孤阴不生，独阳不长。" vi="Âm đơn độc không sinh, dương đơn độc không lớn." />
        </div>
      </Card>
      <Card title="Ngũ hành tương sinh, tương khắc" zh="五行">
        <div className="grid md:grid-cols-[340px_1fr] gap-4 items-center">
          <div>
            <WuxingSvg />
            <div className="flex justify-center gap-4 text-[13px] mt-1"><span><span className="inline-block w-5 h-[3px] bg-[#3F7D4E] align-middle mr-1" />相生 sinh</span><span><span className="inline-block w-5 border-t-2 border-dashed border-[#B8432F] align-middle mr-1" />相克 khắc</span></div>
          </div>
          <div>
            <P>Năm hành không phải năm “chất” mà là năm <b>trạng thái vận động</b>. Vòng ngoài là <b>相生 xiāngshēng</b> (sinh ra, nuôi dưỡng), ngôi sao bên trong là <b>相克 xiāngkè</b> (chế ngự). Có sinh mà không có khắc thì quá đà; có khắc mà không có sinh thì suy kiệt.</P>
            <div className="grid gap-1.5 text-[15px]">
              <div><b className="text-[#3F7D4E]">Sinh:</b> <span className="font-zh">木生火，火生土，土生金，金生水，水生木。</span></div>
              <div className="text-[13px] text-[#6B6253]">Gỗ cháy thành lửa · lửa đốt thành tro (đất) · đất chứa kim loại · kim loại ngưng tụ nước · nước nuôi cây.</div>
              <div><b className="text-[#B8432F]">Khắc:</b> <span className="font-zh">木克土，土克水，水克火，火克金，金克木。</span></div>
              <div className="text-[13px] text-[#6B6253]">Rễ cây xuyên đất · đất đắp đê ngăn nước · nước dập lửa · lửa nung chảy kim loại · dao rìu chặt cây.</div>
            </div>
          </div>
        </div>
      </Card>
      <Card title="Bảng quy loại Ngũ hành" zh="归类">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[14px] min-w-[560px]">
            <thead><tr className="text-left text-[#6B6253]">{["Hành", "方位 hướng", "季节 mùa", "颜色 màu", "五脏 tạng", "五味 vị", "情志 cảm xúc"].map((h) => <th key={h} className="px-2 py-1.5 font-semibold">{h}</th>)}</tr></thead>
            <tbody>
              {WX_ORDER.map((w) => { const x = WX[w]; return (
                <tr key={w} className="border-t border-[#E2D6BC]">
                  <td className="px-2 py-2"><WxTag w={w} /></td>
                  {[[x.dir, x.dirVi], [x.season, x.seasonVi], [x.colorZh, x.colorVi], [x.organ, x.organVi], [x.taste, x.tasteVi], [x.emo, x.emoVi]].map(([z, v], i) => <td key={i} className="px-2 py-2"><b className="font-zh text-[16px]">{z}</b> <span className="text-[#6B6253]">{v}</span></td>)}
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 mt-3">
          <Sent zh="他五行缺水，所以名字里带三点水。" vi="Mệnh anh ấy thiếu Thuỷ nên tên có bộ ba chấm thuỷ (氵)." />
          <Sent zh="这两个人水火不容。" vi="Hai người này như nước với lửa." />
        </div>
      </Card>
      <Vocab k="wx" />
    </div>
  );
}

// =============== 2. CAN CHI · CON GIÁP ===============
const NAYIN_CACHE = {};
function TabGz() {
  const L = useLunar();
  const [y, setY] = useState(2000);
  const p = usePy();
  const gi = (((y - 4) % 10) + 10) % 10, zi = (((y - 4) % 12) + 12) % 12;
  const g = GAN[gi], z = ZHI[zi], gz = g.zh + z.zh;
  const nayin = L ? L.LunarUtil.NAYIN[gz] : "";
  const chong = ZHI[(zi + 6) % 12];
  const HE6 = { 子: "丑", 丑: "子", 寅: "亥", 亥: "寅", 卯: "戌", 戌: "卯", 辰: "酉", 酉: "辰", 巳: "申", 申: "巳", 午: "未", 未: "午" };
  const SAN = [["申子辰", "水"], ["亥卯未", "木"], ["寅午戌", "火"], ["巳酉丑", "金"]].find(([s]) => s.includes(z.zh));
  const cycle = useMemo(() => Array.from({ length: 60 }, (_, i) => GAN[i % 10].zh + ZHI[i % 12].zh), []);
  const now = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-4">
      <Card title="Tra năm sinh → Can chi, con giáp, nạp âm" zh="查">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="text-[15px] font-semibold" htmlFor="gzy">Năm sinh</label>
          <input id="gzy" type="number" className={inp + " w-28"} value={y} min={1800} max={2200} onChange={(e) => setY(+e.target.value || 2000)} />
          <span className="text-[13px] text-[#6B6253]">Lưu ý: năm can chi bắt đầu từ Tết (âm lịch) hoặc Lập Xuân (~4/2), sinh tháng 1 dương lịch thường thuộc năm trước.</span>
        </div>
        <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-center">
          <div className="flex items-end gap-3 justify-center">
            <div className="text-center"><Zh t={g.zh} big color={WX[g.wx].color} /><div className="text-[13px]">{g.hv}</div></div>
            <div className="text-center"><Zh t={z.zh} big color={WX[z.wx].color} /><div className="text-[13px]">{z.hv}</div></div>
            <div className="text-center"><Zh t={z.sx} big color={RED} /><div className="text-[13px]">{z.sxVi}</div></div>
          </div>
          <div className="grid gap-1.5 text-[15px]">
            <div>Năm <b>{y}</b> là năm <b className="font-zh">{gz}</b> ({g.hv} {z.hv}) — <span className="font-zh">{y}年是{z.sx}年</span> <span className="text-[13px] text-[#8A7F6C]">{p(`${y}年是${z.sx}年`)}</span></div>
            <div>Can <b className="font-zh">{g.zh}</b>: <WxTag w={g.wx} /> {g.yy === "阳" ? "dương" : "âm"} · Chi <b className="font-zh">{z.zh}</b>: <WxTag w={z.wx} /> {z.yy === "阳" ? "dương" : "âm"}</div>
            {nayin && <div>Nạp âm 纳音: <b className="font-zh text-[17px]">{nayin}</b> <span className="text-[13px] text-[#8A7F6C]">{p(nayin)}</span> → mệnh <WxTag w={nayin.slice(-1)} /></div>}
            <div>Tam hợp 三合: <b className="font-zh">{SAN[0].split("").map((c) => zhiOf(c).sx).join("、")}</b> ({SAN[0]} hợp hoá <WxTag w={SAN[1]} sm />) · Lục hợp 六合: <b className="font-zh">{zhiOf(HE6[z.zh]).sx}</b> · Xung 冲: <b className="font-zh">{chong.sx}</b> ({chong.sxVi})</div>
            <div>Năm tuổi 本命年 gần nhất: {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => y + 12 * k).find((v) => v >= now)}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 mt-4">
          <Sent zh={`我属${z.sx}，今年是我的本命年吗？`} vi={`Tôi tuổi ${z.sxVi.split(" ")[0]}, năm nay có phải năm tuổi của tôi không?`} />
          <Sent zh="你属什么？" vi="Bạn tuổi con gì? (hỏi tuổi khéo léo)" />
        </div>
      </Card>
      <Card title="Mười Thiên can" zh="干">
        <P>Mười can dùng để đếm ngày từ thời nhà Thương. Can lẻ (甲丙戊庚壬) là dương, can chẵn là âm; cứ hai can một hành.</P>
        <div className="grid grid-cols-5 gap-2">
          {GAN.map((x) => <div key={x.zh} className="rounded-[6px] bg-white border border-[#E2D6BC] py-2 text-center"><Zh t={x.zh} big color={WX[x.wx].color} /><div className="text-[13px] font-semibold">{x.hv}</div><div className="text-[12px] text-[#6B6253]">{x.yy} {x.wx}</div></div>)}
        </div>
      </Card>
      <Card title="Mười hai Địa chi · 12 con giáp" zh="支">
        <P>Mười hai chi gắn với 12 con giáp 生肖, 12 tháng và 12 canh giờ 时辰 (mỗi canh 2 tiếng). Ở Việt Nam, chi 卯 là con Mèo, còn ở Trung Quốc là con Thỏ 兔 tù.</P>
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {ZHI.map((x) => <div key={x.zh} className={"rounded-[6px] border py-2 text-center " + (x.zh === z.zh ? "bg-[#F3E3D2] border-[#9E2F22]" : "bg-white border-[#E2D6BC]")}><div className="flex justify-center gap-2"><Zh t={x.zh} color={WX[x.wx].color} /><Zh t={x.sx} /></div><div className="text-[13px] font-semibold">{x.hv} · {x.sxVi}</div><div className="text-[12px] text-[#6B6253]">{x.hour} · tháng {x.month}</div></div>)}
        </div>
      </Card>
      <Card title="Lục thập hoa giáp" zh="甲子">
        <P>Ghép can và chi lần lượt (甲子, 乙丑, 丙寅…) được 60 cặp rồi quay lại — đó là chu kỳ 60 năm. Bấm một ô để xem năm tương ứng.</P>
        <div className="grid grid-cols-6 sm:grid-cols-10 gap-1">
          {cycle.map((c, i) => {
            const yr = 1984 + i; const on = c === gz;
            return <button key={c} onClick={() => setY(yr + 60 * Math.round((y - yr) / 60))} className={"rounded-[4px] border py-1 font-zh text-[15px] " + (on ? "bg-[#9E2F22] text-white border-[#9E2F22]" : "bg-white border-[#E2D6BC] hover:border-[#9E2F22]")} title={`${yr}, ${yr + 60}`}>{c}</button>;
          })}
        </div>
      </Card>
      <Vocab k="gz" />
    </div>
  );
}

// =============== 3. KINH DỊCH · BÁT QUÁI ===============
function GuaDetail({ g, moving }) {
  const p = usePy();
  const up = guaOf(g.up), lo = guaOf(g.lo);
  const namePy = PYFIX[g.zh] || p(g.zh);
  const fullPy = g.up === g.lo ? p(g.full.slice(0, 2)) + " " + p(g.full.slice(2)) : [up.img, lo.img].map((c) => PYFIX[c] || p(c)).join(" ") + " " + namePy;
  return (
    <div className="flex gap-4 items-start">
      <div className="pt-2"><Lines lines={g.lines} moving={moving} w={60} /></div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] text-[#6B6253]">Quẻ số {g.n}</div>
        <div className="flex items-end gap-2 flex-wrap"><Zh t={g.full} py={fullPy} big color={RED} /><span className="font-bold text-[16px] pb-1">{g.hv}</span></div>
        <div className="text-[13px] text-[#6B6253] mt-0.5">Trên <b className="font-zh">{up.zh}</b> {up.img} ({up.imgVi}) · dưới <b className="font-zh">{lo.zh}</b> {lo.img} ({lo.imgVi})</div>
        <div className="mt-2 font-zh text-[17px]">{g.zh}：{g.ci}</div>
        <div className="text-[13px] text-[#8A7F6C]">{p(g.ci)}</div>
        <div className="text-[15px] mt-1">{g.vi}</div>
      </div>
    </div>
  );
}
function Coins() {
  const [ls, setLs] = useState([]); // giá trị 6/7/8/9 từ dưới lên
  const [last, setLast] = useState(null);
  const toss = () => { const c = [0, 1, 2].map(() => (Math.random() < 0.5 ? 3 : 2)); setLast(c); setLs((v) => [...v, c.reduce((a, b) => a + b, 0)]); };
  const done = ls.length === 6;
  const base = ls.map((v) => (v === 7 || v === 9 ? 1 : 0));
  const mov = ls.map((v, i) => (v === 6 || v === 9 ? i : -1)).filter((i) => i >= 0);
  const chg = base.map((l, i) => (mov.includes(i) ? 1 - l : l));
  const NAME = { 6: ["老阴", "lão âm — động"], 7: ["少阳", "thiếu dương"], 8: ["少阴", "thiếu âm"], 9: ["老阳", "lão dương — động"] };
  const HAO = ["初", "二", "三", "四", "五", "上"];
  return (
    <Card title="Gieo quẻ ba đồng xu" zh="卜">
      <P>Cách 金钱卦: nghĩ về câu hỏi, gieo 3 đồng xu 6 lần, mỗi lần được một hào, xếp <b>từ dưới lên</b>. Mặt ngửa (字) = 3, mặt sấp = 2. Tổng 7 少阳 ⚊, 8 少阴 ⚋, 9 老阳 (dương động), 6 老阴 (âm động). Hào động sẽ đổi âm↔dương để thành <b>变卦</b> quẻ biến.</P>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <button className={btn} onClick={toss} disabled={done}>{done ? "Đã đủ 6 hào" : `Gieo hào ${HAO[ls.length]} (${ls.length + 1}/6)`}</button>
        {!done && <button className={btn2} onClick={() => { const v = [...ls]; while (v.length < 6) v.push([0, 1, 2].reduce((s) => s + (Math.random() < 0.5 ? 3 : 2), 0)); setLs(v); setLast(null); }}>Gieo nhanh cả 6</button>}
        {ls.length > 0 && <button className={btn2} onClick={() => { setLs([]); setLast(null); }}>Gieo lại</button>}
        {last && <span className="text-[14px]">Vừa gieo: {last.map((c, i) => <span key={i} className={"inline-grid place-items-center w-7 h-7 rounded-full mx-0.5 text-[12px] font-bold " + (c === 3 ? "bg-[#C9A24E] text-white" : "bg-[#E2D6BC]")}>{c === 3 ? "字" : "背"}</span>)}</span>}
      </div>
      {ls.length > 0 && (
        <div className="grid gap-1 mb-4 max-w-[420px]">
          {[...ls].map((v, i) => ({ v, i })).reverse().map(({ v, i }) => (
            <div key={i} className="flex items-center gap-3 text-[14px]">
              <span className="w-12 font-zh text-right">{HAO[i]}{v % 2 ? "九" : "六"}</span>
              <Lines lines={[v % 2]} moving={v === 6 || v === 9 ? [0] : []} w={70} />
              <span className="font-zh">{NAME[v][0]}</span><span className="text-[#6B6253]">{v} · {NAME[v][1]}</span>
            </div>
          ))}
        </div>
      )}
      {done && (
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-[6px] bg-white border border-[#E2D6BC] p-3"><div className="text-[13px] font-bold text-[#6B6253] mb-1">本卦 Quẻ chính</div><GuaDetail g={guaBy6(base)} moving={mov} /></div>
          {mov.length > 0
            ? <div className="rounded-[6px] bg-white border border-[#E2D6BC] p-3"><div className="text-[13px] font-bold text-[#6B6253] mb-1">变卦 Quẻ biến (hào động: {mov.map((i) => HAO[i]).join("、")})</div><GuaDetail g={guaBy6(chg)} /></div>
            : <div className="rounded-[6px] bg-white border border-[#E2D6BC] p-3 text-[14px]">Không có hào động → chỉ xem quẻ chính, không có quẻ biến.</div>}
        </div>
      )}
    </Card>
  );
}
function TabYj() {
  const [sel, setSel] = useState("乾");
  const [hx, setHx] = useState(11);
  const g8 = guaOf(sel);
  const p = usePy();
  return (
    <div className="flex flex-col gap-4">
      <Card title="Từ Thái cực đến Bát quái" zh="易">
        <P>Kinh Dịch 《易经》 là sách cổ nhất của Trung Hoa, dùng hai loại vạch: hào dương <b>⚊</b> (liền) và hào âm <b>⚋</b> (đứt). Ba hào chồng lên nhau tạo thành <b>8 quẻ đơn</b> (八卦); hai quẻ đơn chồng lên nhau tạo thành <b>64 quẻ kép</b> (六十四卦). “易” nghĩa là <i>biến đổi</i>.</P>
        <Sent zh="易有太极，是生两仪，两仪生四象，四象生八卦。" vi="Dịch có Thái cực, sinh ra Lưỡng nghi; Lưỡng nghi sinh Tứ tượng; Tứ tượng sinh Bát quái." src="《系辞》" />
      </Card>
      <Card title="Hậu thiên Bát quái" zh="卦">
        <div className="grid md:grid-cols-[360px_1fr] gap-4 items-center">
          <div><BaguaSvg sel={sel} onPick={setSel} /><div className="text-center text-[12px] text-[#6B6253]">Bản đồ cổ đặt phương Nam ở trên · bấm vào quẻ</div></div>
          <div>
            <div className="flex items-center gap-4 mb-3">
              <Lines lines={g8.lines} w={56} />
              <div><Zh t={g8.zh} big color={RED} /> <span className="font-bold text-[18px]">{g8.hv}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[14px]">
              {[["象 tượng", g8.img, g8.imgVi], ["五行", g8.wx, WX[g8.wx].hv], ["方位 (后天)", g8.hou, g8.houVi], ["家人 gia đình", g8.fam, g8.famVi], ["动物 con vật", g8.animal, ""], ["身体 cơ thể", g8.body, ""]].map(([k, zh, vi]) => (
                <div key={k} className="rounded-[6px] bg-white border border-[#E2D6BC] px-3 py-1.5"><div className="text-[12px] text-[#6B6253]">{k}</div><span className="font-zh text-[17px] font-bold">{zh}</span> <span className="text-[12px] text-[#8A7F6C]">{PYFIX[zh] || p(zh)}</span> {vi && <span>· {vi}</span>}</div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mt-4">
          {GUA8.map((x) => <button key={x.zh} onClick={() => setSel(x.zh)} className={"rounded-[6px] border py-2 flex flex-col items-center gap-1 " + (x.zh === sel ? "bg-[#F3E3D2] border-[#9E2F22]" : "bg-white border-[#E2D6BC]")}><Lines lines={x.lines} w={30} h={4} gap={4} /><span className="font-zh font-bold">{x.zh}{x.img}</span></button>)}
        </div>
        <div className="mt-3 text-[14px] text-[#3D372D]">Mẹo nhớ hình quẻ 八卦取象歌: <span className="font-zh">乾三连，坤六断；震仰盂，艮覆碗；离中虚，坎中满；兑上缺，巽下断。</span></div>
      </Card>
      <Coins />
      <Card title="64 quẻ" zh="六十四">
        <div className="rounded-[6px] bg-white border border-[#E2D6BC] p-3 mb-3"><GuaDetail g={GUA64[hx - 1]} /></div>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
          {GUA64.map((g) => (
            <button key={g.n} onClick={() => setHx(g.n)} className={"rounded-[4px] border py-1.5 flex flex-col items-center " + (g.n === hx ? "bg-[#F3E3D2] border-[#9E2F22]" : "bg-white border-[#E2D6BC] hover:border-[#9E2F22]")}>
              <Lines lines={g.lines} w={26} h={3} gap={2.5} />
              <span className="font-zh text-[14px] font-bold mt-1">{g.zh}</span><span className="text-[10px] text-[#8A7F6C]">{g.n}</span>
            </button>
          ))}
        </div>
      </Card>
      <Vocab k="yj" />
    </div>
  );
}

// =============== 4. BÁT TỰ ===============
function TabBz() {
  const L = useLunar();
  const p = usePy();
  const [d, setD] = useState("1995-08-15");
  const [t, setT] = useState("14:30");
  const [noTime, setNoTime] = useState(false);
  const R = useMemo(() => {
    if (!L || !/^\d{4}-\d\d-\d\d$/.test(d)) return null;
    const [y, m, dd] = d.split("-").map(Number); const [h, mi] = noTime ? [12, 0] : (t || "12:00").split(":").map(Number);
    try {
      const lu = L.Solar.fromYmdHms(y, m, dd, h || 0, mi || 0, 0).getLunar(); const e = lu.getEightChar();
      const cols = [
        ["年柱", "Năm", e.getYear(), e.getYearShiShenGan(), e.getYearHideGan(), e.getYearNaYin()],
        ["月柱", "Tháng", e.getMonth(), e.getMonthShiShenGan(), e.getMonthHideGan(), e.getMonthNaYin()],
        ["日柱", "Ngày", e.getDay(), "日主", e.getDayHideGan(), e.getDayNaYin()],
        ["时柱", "Giờ", e.getTime(), e.getTimeShiShenGan(), e.getTimeHideGan(), e.getTimeNaYin()],
      ].slice(0, noTime ? 3 : 4);
      const cnt = Object.fromEntries(WX_ORDER.map((w) => [w, 0]));
      cols.forEach((c) => { cnt[wxOf(c[2][0])]++; cnt[wxOf(c[2][1])]++; });
      return { lu, e, cols, cnt, dm: e.getDayGan() };
    } catch { return null; }
  }, [L, d, t, noTime]);
  return (
    <div className="flex flex-col gap-4">
      <Card title="Bát tự là gì?" zh="八字">
        <P>Mỗi thời điểm sinh được ghi bằng 4 cặp can chi — năm, tháng, ngày, giờ — gọi là <b>四柱 Tứ trụ</b>, tổng cộng <b>8 chữ</b>. Can của ngày sinh gọi là <b>日主</b>, tượng trưng cho bản thân; các chữ khác được gọi tên theo quan hệ sinh/khắc với nhật chủ (十神). Tháng trong bát tự tính theo <b>tiết khí</b>, không theo mùng 1 âm lịch.</P>
        <Sent zh="你的生辰八字是什么？" vi="Ngày giờ sinh (bát tự) của bạn là gì?" />
      </Card>
      <Card title="Lập tứ trụ" zh="排盘">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input type="date" className={inp} value={d} onChange={(e) => setD(e.target.value)} aria-label="Ngày sinh dương lịch" />
          <input type="time" className={inp} value={t} onChange={(e) => setT(e.target.value)} disabled={noTime} aria-label="Giờ sinh" />
          <label className="flex items-center gap-1.5 text-[14px]"><input type="checkbox" checked={noTime} onChange={(e) => setNoTime(e.target.checked)} /> Không rõ giờ</label>
        </div>
        {!L && <div className="text-[14px] text-[#6B6253]">Đang tải lịch…</div>}
        {R && <>
          <div className="text-[14px] mb-3">Âm lịch: <b className="font-zh">{R.lu.getYearInGanZhi()}年 {R.lu.getMonthInChinese()}月{R.lu.getDayInChinese()}</b> {!noTime && <>· giờ <b className="font-zh">{R.lu.getTimeZhi()}时</b></>} · tuổi <b className="font-zh">{R.lu.getYearShengXiao()}</b></div>
          <div className={"grid gap-2 " + (noTime ? "grid-cols-3" : "grid-cols-4")}>
            {R.cols.map(([zh, vi, gz, ss, hide, ny]) => (
              <div key={zh} className={"rounded-[6px] border text-center py-2 px-1 " + (zh === "日柱" ? "bg-[#F3E3D2] border-[#9E2F22]" : "bg-white border-[#E2D6BC]")}>
                <div className="text-[12px] text-[#6B6253]"><span className="font-zh">{zh}</span> · {vi}</div>
                <div className="text-[12px] mt-1 font-zh">{ss}</div><div className="text-[10px] text-[#8A7F6C]">{SHISHEN[ss]}</div>
                <Zh t={gz[0]} big color={WX[wxOf(gz[0])].color} />
                <div className="-mt-1"><Zh t={gz[1]} big color={WX[wxOf(gz[1])].color} /></div>
                <div className="text-[12px]">{ganOf(gz[0]).hv} {zhiOf(gz[1]).hv}</div>
                <div className="text-[11px] text-[#6B6253] mt-1">藏干 <span className="font-zh">{hide.join("")}</span></div>
                <div className="text-[11px] text-[#6B6253] font-zh">{ny}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            <div className="rounded-[6px] bg-white border border-[#E2D6BC] p-3">
              <div className="font-bold text-[14px] mb-2">Đếm ngũ hành trong {noTime ? 6 : 8} chữ</div>
              {WX_ORDER.map((w) => (
                <div key={w} className="flex items-center gap-2 mb-1"><WxTag w={w} sm /><div className="flex-1 h-3 rounded bg-[#F1EBDD] overflow-hidden"><div className="h-full" style={{ width: `${(R.cnt[w] / (noTime ? 6 : 8)) * 100}%`, background: WX[w].color }} /></div><span className="w-4 text-right text-[13px]">{R.cnt[w]}</span></div>
              ))}
              {WX_ORDER.filter((w) => !R.cnt[w]).length > 0 && <div className="mt-2 text-[14px]">Câu nói thường gặp: <b className="font-zh">五行缺{WX_ORDER.filter((w) => !R.cnt[w]).join("")}</b> <span className="text-[12px] text-[#8A7F6C]">{p("五行缺" + WX_ORDER.filter((w) => !R.cnt[w]).join(""))}</span> — “thiếu {WX_ORDER.filter((w) => !R.cnt[w]).map((w) => WX[w].hv).join(", ")}” (chỉ đếm bề mặt, chưa xét tàng can).</div>}
            </div>
            <div className="rounded-[6px] bg-white border border-[#E2D6BC] p-3 text-[14px]">
              <div className="font-bold mb-1">Nhật chủ <span className="font-zh text-[18px]" style={{ color: WX[wxOf(R.dm)].color }}>{R.dm}</span> {ganOf(R.dm).hv} — {ganOf(R.dm).yy} {wxOf(R.dm)}</div>
              <div>Hành sinh ra mình (印): <WxTag w={WX_ORDER.find((w) => SHENG[w] === wxOf(R.dm))} sm /> · mình sinh ra (食伤): <WxTag w={SHENG[wxOf(R.dm)]} sm /></div>
              <div>Mình khắc (财): <WxTag w={KE[wxOf(R.dm)]} sm /> · khắc mình (官杀): <WxTag w={WX_ORDER.find((w) => KE[w] === wxOf(R.dm))} sm /> · cùng hành (比劫): <WxTag w={wxOf(R.dm)} sm /></div>
              <div className="text-[12px] text-[#6B6253] mt-2">Thập thần chỉ là tên gọi quan hệ; luận vượng suy, dụng thần cần xét cả mùa sinh và tàng can — trang này dừng ở mức học thuật ngữ.</div>
            </div>
          </div>
        </>}
      </Card>
      <Card title="Thập thần" zh="十神">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[13px]">
          {[["比肩", "劫财", "cùng hành"], ["食神", "伤官", "mình sinh ra"], ["偏财", "正财", "mình khắc"], ["七杀", "正官", "khắc mình"], ["偏印", "正印", "sinh ra mình"]].map(([a, b, v]) => (
            <div key={a} className="rounded-[6px] bg-white border border-[#E2D6BC] p-2"><div className="font-zh font-bold text-[15px]">{a} · {b}</div><div>{SHISHEN[a]} · {SHISHEN[b]}</div><div className="text-[#6B6253]">{v} (cùng/khác âm dương)</div></div>
          ))}
        </div>
      </Card>
      <Vocab k="bz" />
    </div>
  );
}

// =============== 5. PHONG THUỶ ===============
function TabFs() {
  const L = useLunar();
  const p = usePy();
  const [d, setD] = useState("1990-06-15");
  const [male, setMale] = useState(true);
  const yr = useMemo(() => {
    const [y, m, dd] = d.split("-").map(Number); if (!y) return null;
    if (!L) return m <= 1 || (m === 2 && dd < 4) ? y - 1 : y;
    const lc = L.Lunar.fromYmd(y, 1, 1).getJieQiTable()["立春"]; const s = lc.toYmd();
    return d < s ? y - 1 : y;
  }, [d, L]);
  const r = yr ? mingGua(yr, male) : null;
  const LUO = [[4, "巽"], [9, "离"], [2, "坤"], [3, "震"], [5, "中"], [7, "兑"], [8, "艮"], [1, "坎"], [6, "乾"]];
  return (
    <div className="flex flex-col gap-4">
      <Card title="Phong thuỷ là gì?" zh="风水">
        <P>“Phong thuỷ” 风水 là thuật chọn nơi ở dựa vào thế đất, hướng gió, dòng nước. Câu gốc trong 《葬书》: <span className="font-zh">气乘风则散，界水则止。</span> — “khí gặp gió thì tan, gặp nước thì dừng”, nên mục tiêu là <b className="font-zh">藏风聚气</b> (giữ gió tụ khí).</P>
        <div className="grid sm:grid-cols-2 gap-2">
          <Sent zh="这房子坐北朝南，采光很好。" vi="Căn nhà này toạ Bắc hướng Nam, lấy sáng rất tốt." />
          <Sent zh="左青龙，右白虎，前朱雀，后玄武。" vi="Trái Thanh Long, phải Bạch Hổ, trước Chu Tước, sau Huyền Vũ." />
        </div>
      </Card>
      <Card title="Cửu cung Lạc thư" zh="九宫">
        <div className="grid md:grid-cols-[260px_1fr] gap-4 items-center">
          <div className="grid grid-cols-3 gap-1 w-[240px] mx-auto">
            {LUO.map(([n, g]) => <div key={n} className={"aspect-square rounded-[4px] border grid place-items-center text-center " + (r && r.k === n ? "bg-[#9E2F22] text-white border-[#9E2F22]" : "bg-white border-[#E2D6BC]")}><div><div className="text-[22px] font-bold">{n}</div><div className="font-zh text-[15px]">{g}</div></div></div>)}
          </div>
          <div>
            <P>Lạc thư 洛书 là ô vuông 3×3 mà mọi hàng, cột, đường chéo đều cộng bằng <b>15</b>. Mỗi số gắn với một quẻ và một hướng (Nam ở trên). Khẩu quyết: <span className="font-zh">戴九履一，左三右七，二四为肩，六八为足，五居中央。</span></P>
            <div className="text-[13px] text-[#8A7F6C]">{p("戴九履一，左三右七，二四为肩，六八为足，五居中央。")}</div>
            <div className="text-[14px]">“Đội 9 đạp 1, trái 3 phải 7, 2 và 4 là vai, 6 và 8 là chân, 5 ở giữa.”</div>
          </div>
        </div>
      </Card>
      <Card title="Tính mệnh quái (Bát trạch)" zh="命卦">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input type="date" className={inp} value={d} onChange={(e) => setD(e.target.value)} aria-label="Ngày sinh" />
          <div className="flex rounded-[6px] border border-[#D8CBAE] overflow-hidden">
            {[[true, "Nam 男"], [false, "Nữ 女"]].map(([v, l]) => <button key={l} onClick={() => setMale(v)} className={"h-10 px-4 text-[14px] font-bold " + (male === v ? "bg-[#9E2F22] text-white" : "bg-white")}>{l}</button>)}
          </div>
          {yr && <span className="text-[13px] text-[#6B6253]">Tính theo năm {yr} (đổi năm từ Lập Xuân)</span>}
        </div>
        {r && <>
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <Lines lines={r.gua.lines} w={46} />
            <div className="text-[15px]">Mệnh quái số <b>{r.k}</b>: quẻ <b className="font-zh text-[20px]" style={{ color: RED }}>{r.gua.zh}</b> {r.gua.hv} → <b className="font-zh">{r.east ? "东四命" : "西四命"}</b> ({r.east ? "Đông tứ mệnh" : "Tây tứ mệnh"}) <span className="text-[13px] text-[#8A7F6C]">{p(r.east ? "东四命" : "西四命")}</span></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {[true, false].map((good) => (
              <div key={String(good)} className="rounded-[6px] bg-white border border-[#E2D6BC] p-3">
                <div className="font-bold mb-2" style={{ color: good ? "#3F7D4E" : "#B8432F" }}>{good ? "4 hướng tốt 吉方" : "4 hướng xấu 凶方"}</div>
                {r.dirs.filter((x) => x.good === good).map((x) => (
                  <div key={x.zh} className="flex items-baseline gap-2 py-1 border-t border-[#F1EBDD] first:border-0 text-[14px]">
                    <b className="font-zh text-[16px] w-12">{x.zh}</b><span className="w-20 text-[#6B6253]">{x.hv}</span><b className="font-zh">{x.dir}</b><span>{x.dirVi}</span><span className="text-[12px] text-[#6B6253] ml-auto text-right">{x.vi}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="text-[13px] text-[#6B6253] mt-2">Đông tứ mệnh hợp nhà 坎离震巽; Tây tứ mệnh hợp nhà 乾坤艮兑. Thực tế thường dùng hướng tốt để kê bàn làm việc, đầu giường, cửa chính.</div>
        </>}
      </Card>
      <Vocab k="fs" />
    </div>
  );
}

// =============== 6. HOÀNG LỊCH ===============
const pad = (n) => String(n).padStart(2, "0");
const ymd = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
function Chips({ list, good }) {
  const p = usePy();
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((x) => (
        <span key={x} className="rounded-[4px] border px-2 py-1 text-center" style={{ borderColor: good ? "#BFD5BF" : "#E5C3BB", background: good ? "#F1F7EF" : "#FBF0EC" }}>
          <span className="block font-zh font-bold text-[15px]">{x}</span>
          <span className="block text-[11px] text-[#8A7F6C]">{p(x)}</span>
          {YIJI[x] && <span className="block text-[12px]">{YIJI[x]}</span>}
        </span>
      ))}
    </div>
  );
}
function TabHl() {
  const L = useLunar();
  const p = usePy();
  const [d, setD] = useState(() => ymd(new Date()));
  const shift = (k) => { const [y, m, dd] = d.split("-").map(Number); setD(ymd(new Date(y, m - 1, dd + k))); };
  const R = useMemo(() => {
    if (!L || !/^\d{4}-\d\d-\d\d$/.test(d)) return null;
    const [y, m, dd] = d.split("-").map(Number);
    try {
      const s = L.Solar.fromYmd(y, m, dd), lu = s.getLunar();
      const jq = lu.getJieQi();
      return { s, lu, jq, next: lu.getNextJieQi(true) };
    } catch { return null; }
  }, [L, d]);
  const WEEK = ["日", "一", "二", "三", "四", "五", "六"];
  return (
    <div className="flex flex-col gap-4">
      <Card title="Hoàng lịch là gì?" zh="黄历">
        <P>Hoàng lịch (老黄历) ghi cho mỗi ngày: can chi, việc <b>宜 yí</b> (nên làm) và <b>忌 jì</b> (nên tránh), tuổi bị <b>冲</b> xung, hướng <b>煞</b>, hướng các vị thần may mắn… Người Trung Quốc ngày nay vẫn hay “xem lịch” khi cưới hỏi, chuyển nhà, khai trương.</P>
        <Sent zh="今天宜嫁娶，忌动土。" vi="Hôm nay nên cưới gả, kiêng động thổ." />
      </Card>
      <Card>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button className={btn2} onClick={() => shift(-1)} aria-label="Ngày trước">‹</button>
          <input type="date" className={inp} value={d} onChange={(e) => e.target.value && setD(e.target.value)} aria-label="Chọn ngày" />
          <button className={btn2} onClick={() => shift(1)} aria-label="Ngày sau">›</button>
          <button className={btn2} onClick={() => setD(ymd(new Date()))}>Hôm nay</button>
        </div>
        {!R && <div className="text-[14px] text-[#6B6253]">Đang tải lịch…</div>}
        {R && <>
          <div className="grid md:grid-cols-[240px_1fr] gap-4">
            <div className="rounded-[8px] bg-[#9E2F22] text-[#FBF3E4] p-4 text-center">
              <div className="text-[13px] opacity-90">{R.s.getYear()}年{R.s.getMonth()}月 · 星期{WEEK[R.s.getWeek()]}</div>
              <div className="text-[64px] font-extrabold leading-none my-1">{R.s.getDay()}</div>
              <div className="font-zh text-[20px] font-bold">农历{R.lu.getMonthInChinese()}月{R.lu.getDayInChinese()}</div>
              <div className="text-[12px] opacity-90">{p(`农历${R.lu.getMonthInChinese()}月${R.lu.getDayInChinese()}`)}</div>
              <div className="font-zh mt-2 text-[15px]">{R.lu.getYearInGanZhi()}年 【{R.lu.getYearShengXiao()}年】</div>
              <div className="font-zh text-[15px]">{R.lu.getMonthInGanZhi()}月 {R.lu.getDayInGanZhi()}日</div>
              {R.jq && <div className="mt-2 inline-block rounded bg-[#FBF3E4] text-[#9E2F22] px-2 font-zh font-bold">今日{R.jq}</div>}
              <div className="text-[12px] mt-2 opacity-90">Tiết khí kế: <span className="font-zh">{R.next.getName()}</span> {R.next.getSolar().toYmd().slice(5)}</div>
            </div>
            <div className="flex flex-col gap-3">
              <div><div className="font-bold mb-1.5" style={{ color: "#3F7D4E" }}>宜 Nên</div><Chips list={R.lu.getDayYi()} good /></div>
              <div><div className="font-bold mb-1.5" style={{ color: "#B8432F" }}>忌 Kiêng</div><Chips list={R.lu.getDayJi()} /></div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 text-[14px]">
            {[
              ["冲煞", `冲${R.lu.getDayChongDesc()} 煞${R.lu.getDaySha()}`, `Xung tuổi ${R.lu.getDayChongShengXiao()} · hướng sát ${R.lu.getDaySha()}`],
              ["值神", `${R.lu.getDayTianShen()}（${R.lu.getDayTianShenType()}）`, R.lu.getDayTianShenLuck() === "吉" ? "Ngày Hoàng đạo — tốt" : "Ngày Hắc đạo — xấu"],
              ["建除", R.lu.getZhiXing() + "日", "Thập nhị trực"],
              ["星宿", R.lu.getXiu() + "宿 " + R.lu.getXiuLuck(), "Nhị thập bát tú"],
              ["喜神", R.lu.getPositionXiDesc(), "Hỷ thần (vui vẻ)"],
              ["财神", R.lu.getPositionCaiDesc(), "Tài thần (tiền bạc)"],
              ["福神", R.lu.getPositionFuDesc(), "Phúc thần (phúc lộc)"],
              ["纳音", R.lu.getDayNaYin(), "Nạp âm của ngày"],
            ].map(([k, v, vi]) => (
              <div key={k} className="rounded-[6px] bg-white border border-[#E2D6BC] px-3 py-2"><div className="text-[12px] text-[#6B6253] font-zh">{k} <span className="font-sans">{p(k)}</span></div><div className="font-zh font-bold text-[16px]">{v}</div><div className="text-[12px] text-[#6B6253]">{vi}</div></div>
            ))}
          </div>
          <div className="mt-3 text-[13px] rounded-[6px] bg-white border border-[#E2D6BC] px-3 py-2"><b>彭祖百忌</b> (kiêng kỵ theo can chi ngày): <span className="font-zh">{R.lu.getPengZuGan()}　{R.lu.getPengZuZhi()}</span></div>
          <div className="mt-3">
            <div className="font-bold text-[14px] mb-1.5">Giờ tốt xấu trong ngày 时辰吉凶</div>
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1">
              {R.lu.getTimes().slice(0, 12).map((x, i) => { const ok = x.getTianShenLuck() === "吉"; return (
                <div key={i} className="rounded-[4px] border text-center py-1" style={{ borderColor: ok ? "#BFD5BF" : "#E5C3BB", background: ok ? "#F1F7EF" : "#FBF0EC" }}>
                  <div className="font-zh font-bold">{x.getGanZhi()}</div><div className="text-[11px] text-[#6B6253]">{ZHI[i].hour}</div><div className="font-zh text-[12px]" style={{ color: ok ? "#3F7D4E" : "#B8432F" }}>{x.getTianShenLuck()}</div>
                </div>
              ); })}
            </div>
          </div>
        </>}
      </Card>
      <Vocab k="hl" />
    </div>
  );
}

// =============== TRANG ===============
const TABS = [
  ["wx", "阴阳五行", "Âm dương · Ngũ hành", TabWx],
  ["gz", "干支生肖", "Can chi · Con giáp", TabGz],
  ["yj", "易经八卦", "Kinh Dịch · Bát quái", TabYj],
  ["bz", "八字", "Bát tự", TabBz],
  ["fs", "风水", "Phong thuỷ", TabFs],
  ["hl", "黄历", "Hoàng lịch", TabHl],
];
export default function HuyenHocPage() {
  const [tab, setTab] = useState("wx");
  useEffect(() => { const f = () => { const h = window.location.hash.slice(1); if (TABS.some((t) => t[0] === h)) setTab(h); }; f(); window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  const go = (k) => { setTab(k); try { history.replaceState(null, "", "#" + k); } catch {} window.scrollTo({ top: 0, behavior: "smooth" }); };
  const T = TABS.find((t) => t[0] === tab)[3];
  return (
    <div className="min-h-screen bg-[#EFE7D6] text-[#1C1A17]" style={{ fontFamily: '"Be Vietnam Pro","Noto Sans SC",system-ui,sans-serif' }}>
      <GardenNav active="home" title="Pháp khí · Huyền học" />
      <main className="max-w-[1100px] mx-auto px-3 md:px-6 pt-5 pb-28 md:pb-14">
        <div className="flex items-end gap-3 mb-1">
          <span className="font-brush text-[44px] leading-none" style={{ color: RED }} aria-hidden="true">玄</span>
          <div><p className="tt-eyebrow">玄门学宫 · 法器</p><h1 className="font-serif-vn text-[26px] md:text-[30px] font-extrabold tracking-tight">Công cụ tra cứu <span className="font-zh text-[20px] text-[#6B6253]">法器</span></h1></div>
        </div>
        <Link href="/huyen-hoc" className="inline-flex items-center gap-1 text-[14px] font-bold text-[#9E2F22] mb-2 hover:underline">‹ Về 玄门学宫 · lộ trình bài học</Link>
        <Link href="/huyen-hoc/tu-vi" className="flex items-center gap-3 rounded-[8px] bg-[#1C1A17] text-[#F3EEE2] px-4 py-3 mb-3 hover:bg-[#2A2622]"><span className="font-brush text-[26px] text-[#E6B656]" aria-hidden="true">紫</span><span className="flex-1"><b>紫微斗数 · Lập lá số Tử vi</b><span className="block text-[12px] opacity-80">An sao 12 cung, luận giải từng cung và luận giải chi tiết bằng AI</span></span><span aria-hidden="true">›</span></Link>
        <p className="text-[13px] text-[#6B6253] mb-4">Nội dung mang tính văn hoá – tham khảo để học từ vựng và hiểu người Trung Quốc; không dùng thay cho lời khuyên chuyên môn khi ra quyết định quan trọng.</p>
        <nav className="flex gap-1.5 overflow-x-auto pb-2 mb-3 -mx-3 px-3" aria-label="Chủ đề huyền học">
          {TABS.map(([k, zh, vi]) => (
            <button key={k} onClick={() => go(k)} className={"shrink-0 rounded-[6px] border px-3 py-1.5 text-left " + (tab === k ? "bg-[#1C1A17] text-[#F3EEE2] border-[#1C1A17]" : "bg-white border-[#D8CBAE] hover:border-[#9E2F22]")}>
              <span className="block font-zh font-bold text-[15px]">{zh}</span><span className="block text-[11px] opacity-80">{vi}</span>
            </button>
          ))}
        </nav>
        <T />
      </main>
    </div>
  );
}
