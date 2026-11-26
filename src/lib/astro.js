// 星盘 · Bản đồ sao chiêm tinh phương Tây (hoàng đạo nhiệt đới, nhà Placidus).
// Vị trí hành tinh: astronomy-engine (địa tâm, hoàng đạo thật của ngày). Cung mọc/MC/nhà: công thức chuẩn từ giờ sao địa phương.
import * as A from "astronomy-engine";

export const SIGNS = [
  { k: "aries", g: "♈", zh: "白羊座", vi: "Bạch Dương", el: "fire", mo: "card", ruler: "mars" },
  { k: "taurus", g: "♉", zh: "金牛座", vi: "Kim Ngưu", el: "earth", mo: "fixed", ruler: "venus" },
  { k: "gemini", g: "♊", zh: "双子座", vi: "Song Tử", el: "air", mo: "mut", ruler: "mercury" },
  { k: "cancer", g: "♋", zh: "巨蟹座", vi: "Cự Giải", el: "water", mo: "card", ruler: "moon" },
  { k: "leo", g: "♌", zh: "狮子座", vi: "Sư Tử", el: "fire", mo: "fixed", ruler: "sun" },
  { k: "virgo", g: "♍", zh: "处女座", vi: "Xử Nữ", el: "earth", mo: "mut", ruler: "mercury" },
  { k: "libra", g: "♎", zh: "天秤座", vi: "Thiên Bình", el: "air", mo: "card", ruler: "venus" },
  { k: "scorpio", g: "♏", zh: "天蝎座", vi: "Bọ Cạp (Thiên Yết)", el: "water", mo: "fixed", ruler: "pluto", ruler2: "mars" },
  { k: "sagittarius", g: "♐", zh: "射手座", vi: "Nhân Mã", el: "fire", mo: "mut", ruler: "jupiter" },
  { k: "capricorn", g: "♑", zh: "摩羯座", vi: "Ma Kết", el: "earth", mo: "card", ruler: "saturn" },
  { k: "aquarius", g: "♒", zh: "水瓶座", vi: "Bảo Bình", el: "air", mo: "fixed", ruler: "uranus", ruler2: "saturn" },
  { k: "pisces", g: "♓", zh: "双鱼座", vi: "Song Ngư", el: "water", mo: "mut", ruler: "neptune", ruler2: "jupiter" },
];
export const ELEM = { fire: { vi: "Lửa", zh: "火象", c: "#E07A63" }, earth: { vi: "Đất", zh: "土象", c: "#C9A86A" }, air: { vi: "Khí", zh: "风象", c: "#8AB8E6" }, water: { vi: "Nước", zh: "水象", c: "#6FA8DC" } };
export const MODE = { card: { vi: "Tiên phong (Thống lĩnh)", zh: "基本宫" }, fixed: { vi: "Kiên định (Cố định)", zh: "固定宫" }, mut: { vi: "Linh hoạt (Biến đổi)", zh: "变动宫" } };
export const PLANETS = [
  { k: "sun", body: "Sun", g: "☉", zh: "太阳", vi: "Mặt Trời", w: 3 },
  { k: "moon", body: "Moon", g: "☽", zh: "月亮", vi: "Mặt Trăng", w: 3 },
  { k: "mercury", body: "Mercury", g: "☿", zh: "水星", vi: "Sao Thuỷ", w: 2 },
  { k: "venus", body: "Venus", g: "♀", zh: "金星", vi: "Sao Kim", w: 2 },
  { k: "mars", body: "Mars", g: "♂", zh: "火星", vi: "Sao Hoả", w: 2 },
  { k: "jupiter", body: "Jupiter", g: "♃", zh: "木星", vi: "Sao Mộc", w: 1 },
  { k: "saturn", body: "Saturn", g: "♄", zh: "土星", vi: "Sao Thổ", w: 1 },
  { k: "uranus", body: "Uranus", g: "♅", zh: "天王星", vi: "Sao Thiên Vương", w: 0.5 },
  { k: "neptune", body: "Neptune", g: "♆", zh: "海王星", vi: "Sao Hải Vương", w: 0.5 },
  { k: "pluto", body: "Pluto", g: "♇", zh: "冥王星", vi: "Sao Diêm Vương", w: 0.5 },
  { k: "node", g: "☊", zh: "北交点", vi: "La Hầu (Bắc Giao Điểm)", w: 0 },
];
export const ASPECTS = [
  { k: "conj", a: 0, orb: 8, zh: "合相", vi: "Hợp", g: "☌", c: "#7CC48A" },
  { k: "sext", a: 60, orb: 5, zh: "六分相", vi: "Lục hợp", g: "⚹", c: "#6FA8DC" },
  { k: "sq", a: 90, orb: 7, zh: "四分相（刑）", vi: "Vuông", g: "□", c: "#E07A63" },
  { k: "tri", a: 120, orb: 7, zh: "三分相（拱）", vi: "Tam hợp", g: "△", c: "#6FA8DC" },
  { k: "opp", a: 180, orb: 8, zh: "对分相（冲）", vi: "Đối", g: "☍", c: "#E07A63" },
];

const D = Math.PI / 180;
export const norm = (x) => ((x % 360) + 360) % 360;
export const signOf = (lon) => SIGNS[Math.floor(norm(lon) / 30)];
export const degIn = (lon) => { const d = norm(lon) % 30; const m = Math.floor((d - Math.floor(d)) * 60); return `${Math.floor(d)}°${String(m).padStart(2, "0")}′`; };

function eclOfDate(body, date) {
  const t = A.MakeTime(date);
  const v = A.GeoVector(body, t, true);
  const r = A.RotateVector(A.Rotation_EQJ_ECT(t), v);
  return norm(A.SphereFromVector(r).lon);
}
function obliquity(date) { const T = (A.MakeTime(date).tt) / 36525; return 23.4392911 - 0.0130042 * T; }
function meanNode(date) { const T = (A.MakeTime(date).tt) / 36525; return norm(125.04452 - 1934.136261 * T + 0.0020708 * T * T); }

// RA → điểm hoàng đạo; độ xích vĩ của điểm hoàng đạo
const lonFromRA = (ra, e) => norm(Math.atan2(Math.sin(ra * D), Math.cos(ra * D) * Math.cos(e * D)) / D);
const decOf = (lon, e) => Math.asin(Math.sin(e * D) * Math.sin(lon * D)) / D;

function placidus(ramc, lat, e) {
  const cusp = (f, day) => { // f = phần cung bán nhật/bán dạ
    let lon = lonFromRA(ramc + (day ? 1 : 3) * 30, e);
    for (let i = 0; i < 30; i++) {
      const dec = decOf(lon, e);
      const x = -Math.tan(lat * D) * Math.tan(dec * D);
      const dsa = Math.acos(Math.max(-1, Math.min(1, x))) / D; const nsa = 180 - dsa;
      const ra = day ? ramc + f * dsa : ramc + 180 - f * nsa;
      const nl = lonFromRA(ra, e); if (Math.abs(nl - lon) < 1e-6) break; lon = nl;
    }
    return lon;
  };
  const h11 = cusp(1 / 3, true), h12 = cusp(2 / 3, true), h2 = cusp(2 / 3, false), h3 = cusp(1 / 3, false);
  return { h11, h12, h2, h3 };
}

// date: Date UTC; lat/lon độ (Đông +)
export function chart(date, lat, lon) {
  const e = obliquity(date);
  const lst = norm((A.SiderealTime(A.MakeTime(date)) * 15) + lon);
  const ramc = lst;
  const mc = norm(Math.atan2(Math.sin(ramc * D), Math.cos(ramc * D) * Math.cos(e * D)) / D);
  const asc = norm(Math.atan2(Math.cos(ramc * D), -(Math.sin(ramc * D) * Math.cos(e * D) + Math.tan(lat * D) * Math.sin(e * D))) / D);
  const p = placidus(ramc, lat, e);
  const cusps = [asc, p.h2, p.h3, norm(mc + 180), norm(p.h11 + 180), norm(p.h12 + 180), norm(asc + 180), norm(p.h2 + 180), norm(p.h3 + 180), mc, p.h11, p.h12];
  const houseOf = (l) => { for (let i = 0; i < 12; i++) { const a = cusps[i], b = cusps[(i + 1) % 12]; const span = norm(b - a); if (norm(l - a) < span) return i + 1; } return 1; };
  const next = new Date(date.getTime() + 86400000);
  const pl = PLANETS.map((P) => {
    let L, L2;
    if (P.k === "node") { L = meanNode(date); L2 = meanNode(next); }
    else { L = eclOfDate(P.body, date); L2 = eclOfDate(P.body, next); }
    const speed = ((L2 - L + 540) % 360) - 180;
    return { ...P, lon: L, sign: signOf(L), deg: degIn(L), house: houseOf(L), retro: P.k !== "sun" && P.k !== "moon" && P.k !== "node" && speed < 0 };
  });
  const points = [...pl, { k: "asc", g: "AC", zh: "上升点", vi: "Cung Mọc (ASC)", lon: asc, w: 3 }, { k: "mc", g: "MC", zh: "天顶", vi: "Thiên Đỉnh (MC)", lon: mc, w: 1 }].map((x) => ({ ...x, sign: signOf(x.lon), deg: degIn(x.lon) }));
  // góc chiếu
  const asp = []; const main = points.filter((x) => x.k !== "node");
  for (let i = 0; i < main.length; i++) for (let j = i + 1; j < main.length; j++) {
    const a = main[i], b = main[j]; if ((a.k === "asc" && b.k === "mc") || (a.k === "mc" && b.k === "asc")) continue;
    const d = Math.abs(((a.lon - b.lon + 540) % 360) - 180);
    for (const S of ASPECTS) {
      const lum = [a.k, b.k].some((k) => k === "sun" || k === "moon");
      const orb = S.orb - (lum ? 0 : 1.5) - ([a.k, b.k].some((k) => k === "asc" || k === "mc") ? 2 : 0);
      if (Math.abs(d - S.a) <= orb) { asp.push({ a, b, t: S, orb: Math.abs(d - S.a) }); break; }
    }
  }
  return { points, planets: pl, cusps, asc, mc, aspects: asp.sort((x, y) => x.orb - y.orb), houseOf };
}

// Phần "trội": nguyên tố, tính chất, hành tinh, cung, nhà, bán cầu
export function dominance(c) {
  const el = { fire: 0, earth: 0, air: 0, water: 0 }, mo = { card: 0, fixed: 0, mut: 0 }, sg = {}, hs = {};
  const W = { sun: 3, moon: 3, asc: 3, mercury: 2, venus: 2, mars: 2, jupiter: 1, saturn: 1, uranus: 0.5, neptune: 0.5, pluto: 0.5, mc: 1 };
  c.points.forEach((p) => { const w = W[p.k] || 0; if (!w) return; el[p.sign.el] += w; mo[p.sign.mo] += w; sg[p.sign.k] = (sg[p.sign.k] || 0) + w; });
  c.planets.filter((p) => p.k !== "node").forEach((p) => { hs[p.house] = (hs[p.house] || 0) + (W[p.k] || 0); });
  const ascRuler = signOf(c.asc).ruler;
  const ps = {};
  c.planets.filter((p) => p.k !== "node").forEach((p) => {
    let s = W[p.k] || 0;
    if ([1, 4, 7, 10].includes(p.house)) s += 2;
    if (p.sign.ruler === p.k || p.sign.ruler2 === p.k) s += 2;
    if (p.k === ascRuler) s += 3;
    if (p.k === signOf(c.planets[0].lon).ruler) s += 1;
    s += c.aspects.filter((a) => a.a.k === p.k || a.b.k === p.k).length * 0.5;
    ps[p.k] = s;
  });
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const tot = (o) => Object.values(o).reduce((a, b) => a + b, 0) || 1;
  const above = c.planets.filter((p) => p.k !== "node" && p.house >= 7).length, east = c.planets.filter((p) => p.k !== "node" && (p.house >= 10 || p.house <= 3)).length;
  return { el, mo, elPct: Object.fromEntries(Object.entries(el).map(([k, v]) => [k, Math.round((v / tot(el)) * 100)])), moPct: Object.fromEntries(Object.entries(mo).map(([k, v]) => [k, Math.round((v / tot(mo)) * 100)])), planet: top(ps), sign: top(sg), house: top(hs), ascRuler, above, east };
}
