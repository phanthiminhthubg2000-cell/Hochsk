// 八字 · Tứ trụ: lập tứ trụ (lunar-javascript), đếm ngũ hành, xét nhật chủ vượng/nhược, tìm dụng thần – hỷ thần – kỵ thần
// theo phép Phù ức (扶抑) kèm Điều hậu (调候), và gợi ý bổ sung ngũ hành. Phương pháp giản lược để học và tham khảo.

export const CAN_VI = { 甲: "Giáp", 乙: "Ất", 丙: "Bính", 丁: "Đinh", 戊: "Mậu", 己: "Kỷ", 庚: "Canh", 辛: "Tân", 壬: "Nhâm", 癸: "Quý" };
export const CHI_VI = { 子: "Tý", 丑: "Sửu", 寅: "Dần", 卯: "Mão", 辰: "Thìn", 巳: "Tỵ", 午: "Ngọ", 未: "Mùi", 申: "Thân", 酉: "Dậu", 戌: "Tuất", 亥: "Hợi" };
export const gzVi = (gz) => (gz ? `${CAN_VI[gz[0]] || ""} ${CHI_VI[gz[1]] || ""}`.trim() : "");
const GAN_WX = { 甲: "木", 乙: "木", 丙: "火", 丁: "火", 戊: "土", 己: "土", 庚: "金", 辛: "金", 壬: "水", 癸: "水" };
const ZHI_WX = { 子: "水", 丑: "土", 寅: "木", 卯: "木", 辰: "土", 巳: "火", 午: "火", 未: "土", 申: "金", 酉: "金", 戌: "土", 亥: "水" };
const YANG = new Set(["甲", "丙", "戊", "庚", "壬"]);
export const WX_ORDER = ["木", "火", "土", "金", "水"];
const GEN = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };    // sinh
const CTL = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };    // khắc
const mother = (e) => WX_ORDER.find((x) => GEN[x] === e);           // hành sinh ra e (Ấn)
const killer = (e) => WX_ORDER.find((x) => CTL[x] === e);           // hành khắc e (Quan sát)

export const SHISHEN_VI = { 比肩: "Tỷ Kiên", 劫财: "Kiếp Tài", 食神: "Thực Thần", 伤官: "Thương Quan", 偏财: "Thiên Tài", 正财: "Chính Tài", 七杀: "Thất Sát", 正官: "Chính Quan", 偏印: "Thiên Ấn", 正印: "Chính Ấn", 日主: "Nhật Chủ" };
export const DISHI_VI = { 长生: "Trường Sinh", 沐浴: "Mộc Dục", 冠带: "Quan Đới", 临官: "Lâm Quan", 帝旺: "Đế Vượng", 衰: "Suy", 病: "Bệnh", 死: "Tử", 墓: "Mộ", 绝: "Tuyệt", 胎: "Thai", 养: "Dưỡng" };
export const NAYIN_VI = { 海中金: "Hải Trung Kim", 炉中火: "Lư Trung Hoả", 大林木: "Đại Lâm Mộc", 路旁土: "Lộ Bàng Thổ", 剑锋金: "Kiếm Phong Kim", 山头火: "Sơn Đầu Hoả", 涧下水: "Giản Hạ Thuỷ", 城头土: "Thành Đầu Thổ", 白蜡金: "Bạch Lạp Kim", 杨柳木: "Dương Liễu Mộc", 泉中水: "Tuyền Trung Thuỷ", 屋上土: "Ốc Thượng Thổ", 霹雳火: "Tích Lịch Hoả", 松柏木: "Tùng Bách Mộc", 长流水: "Trường Lưu Thuỷ", 沙中金: "Sa Trung Kim", 山下火: "Sơn Hạ Hoả", 平地木: "Bình Địa Mộc", 壁上土: "Bích Thượng Thổ", 金箔金: "Kim Bạch Kim", 覆灯火: "Phúc Đăng Hoả", 天河水: "Thiên Hà Thuỷ", 大驿土: "Đại Dịch Thổ", 钗钏金: "Thoa Xuyến Kim", 桑柘木: "Tang Đố Mộc", 大溪水: "Đại Khê Thuỷ", 沙中土: "Sa Trung Thổ", 天上火: "Thiên Thượng Hoả", 石榴木: "Thạch Lựu Mộc", 大海水: "Đại Hải Thuỷ" };

// Gợi ý theo từng hành (dùng khi cần bổ sung / cần tránh)
export const WX = {
  木: { vi: "Mộc", c: "#7CC48A", color: "xanh lá, xanh lục", dir: "Đông", season: "mùa xuân", num: "3, 8", organ: "gan, mật, gân", job: "giáo dục, xuất bản, viết lách, thiết kế, thời trang, nông lâm, cây cảnh, dược thảo, văn hoá – nghệ thuật", item: "cây xanh trong nhà, đồ gỗ, tranh rừng cây, giấy – sách", habit: "đi bộ trong công viên, trồng cây, đọc sách, dậy sớm, giãn cơ", food: "rau lá xanh, đồ chua vừa phải" },
  火: { vi: "Hoả", c: "#E07A63", color: "đỏ, hồng, cam, tím", dir: "Nam", season: "mùa hè", num: "2, 7", organ: "tim, mạch máu, mắt", job: "truyền thông, quảng cáo, điện – điện tử, năng lượng, ẩm thực, biểu diễn, làm đẹp, công nghệ hiển thị", item: "đèn ấm, nến, đồ màu đỏ, tranh mặt trời", habit: "tắm nắng sáng, vận động ra mồ hôi, giao lưu, thể hiện bản thân", food: "đồ ấm nóng, vị đắng nhẹ (trà, ca cao)" },
  土: { vi: "Thổ", c: "#C9A86A", color: "vàng, nâu, be, màu đất", dir: "Trung tâm, Đông Bắc, Tây Nam", season: "cuối mỗi mùa", num: "5, 0", organ: "dạ dày, lá lách, tiêu hoá", job: "bất động sản, xây dựng, nông nghiệp, gốm sứ, kho vận, quản lý hành chính, bảo hiểm, tư vấn", item: "đồ gốm sứ, đá tự nhiên, pha lê vàng, chậu đất", habit: "ăn uống đúng giờ, giữ nếp sinh hoạt ổn định, làm vườn, giữ chữ tín", food: "ngũ cốc, khoai, bí, vị ngọt tự nhiên" },
  金: { vi: "Kim", c: "#D8DEE6", color: "trắng, bạc, xám, ánh kim", dir: "Tây, Tây Bắc", season: "mùa thu", num: "4, 9", organ: "phổi, da, đường hô hấp", job: "tài chính, ngân hàng, kế toán, luật, cơ khí, kim hoàn, máy móc, công nghệ phần cứng, quân đội – an ninh", item: "đồ kim loại, chuông gió, đồng hồ kim loại, trang sức bạc", habit: "dọn dẹp gọn gàng, tập thở – hít thở sâu, làm việc có kỷ luật và quy trình", food: "đồ màu trắng (lê, củ cải, ngân nhĩ), vị cay nhẹ" },
  水: { vi: "Thuỷ", c: "#6FA8DC", color: "đen, xanh dương, xanh navy", dir: "Bắc", season: "mùa đông", num: "1, 6", organ: "thận, bàng quang, tai, xương", job: "vận tải, du lịch, thương mại – xuất nhập khẩu, thuỷ sản, đồ uống, logistics, ngoại ngữ – phiên dịch, tư vấn, nghiên cứu", item: "bể cá, đài phun nước nhỏ, tranh sông nước, đồ màu đen – xanh dương", habit: "uống đủ nước, bơi lội, ngủ đủ giấc, nghỉ ngơi, thiền tĩnh", food: "đồ màu đen (đậu đen, mè đen), hải sản, vị mặn vừa phải" },
};

const tenGod = (dm, g) => {
  const a = GAN_WX[dm], b = GAN_WX[g], same = YANG.has(dm) === YANG.has(g);
  if (a === b) return same ? "比肩" : "劫财";
  if (GEN[a] === b) return same ? "食神" : "伤官";
  if (CTL[a] === b) return same ? "偏财" : "正财";
  if (CTL[b] === a) return same ? "七杀" : "正官";
  return same ? "偏印" : "正印";
};
export const wxOf = (x) => GAN_WX[x] || ZHI_WX[x];

// ec: EightChar của lunar-javascript; gender 1 nam, 0 nữ
export function analyze(ec, gender, lunar) {
  const P = [
    ["Năm", "年柱", ec.getYearGan(), ec.getYearZhi(), ec.getYearHideGan(), ec.getYearNaYin(), ec.getYearDiShi()],
    ["Tháng", "月柱", ec.getMonthGan(), ec.getMonthZhi(), ec.getMonthHideGan(), ec.getMonthNaYin(), ec.getMonthDiShi()],
    ["Ngày", "日柱", ec.getDayGan(), ec.getDayZhi(), ec.getDayHideGan(), ec.getDayNaYin(), ec.getDayDiShi()],
    ["Giờ", "时柱", ec.getTimeGan(), ec.getTimeZhi(), ec.getTimeHideGan(), ec.getTimeNaYin(), ec.getTimeDiShi()],
  ];
  const dm = P[2][2], E = GAN_WX[dm];
  const pillars = P.map(([vi, zh, g, z, hide, ny, ds], i) => ({
    vi, zh, gan: g, zhi: z, gz: g + z, gzVi: gzVi(g + z), ganWx: GAN_WX[g], zhiWx: ZHI_WX[z],
    god: i === 2 ? "日主" : tenGod(dm, g), hide: hide.map((h) => ({ g: h, wx: GAN_WX[h], god: tenGod(dm, h) })),
    nayin: ny, nayinVi: NAYIN_VI[ny] || ny, dishi: ds, dishiVi: DISHI_VI[ds] || ds,
  }));

  // điểm ngũ hành: can lộ 1; tàng can theo khí (bản – trung – dư); chi tháng nhân 2 (nắm lệnh)
  const W = { 1: [1], 2: [0.7, 0.3], 3: [0.6, 0.3, 0.1] };
  const score = Object.fromEntries(WX_ORDER.map((e) => [e, 0]));
  pillars.forEach((p, i) => {
    if (i !== 2) score[p.ganWx] += 1;
    const w = W[p.hide.length] || W[3]; const mul = i === 1 ? 2 : 1;
    p.hide.forEach((h, k) => (score[h.wx] += (w[k] || 0) * mul));
  });
  const total = WX_ORDER.reduce((s, e) => s + score[e], 0);
  // tỉ lệ hiển thị: tính cả can ngày (nhật chủ)
  const pct = Object.fromEntries(WX_ORDER.map((e) => [e, Math.round(((score[e] + (e === E ? 1 : 0)) / (total + 1)) * 100)]));
  // đếm "lộ" (8 chữ, tính chi theo bản khí) để xét khuyết
  const shown = Object.fromEntries(WX_ORDER.map((e) => [e, 0]));
  pillars.forEach((p) => { shown[p.ganWx]++; shown[p.zhiWx]++; });
  const hidden = Object.fromEntries(WX_ORDER.map((e) => [e, pillars.some((p) => p.hide.some((h) => h.wx === e))]));
  const lack = WX_ORDER.filter((e) => !shown[e]);
  const strongest = [...WX_ORDER].sort((a, b) => pct[b] - pct[a])[0];

  // nhật chủ vượng / nhược
  const M = mother(E), K = killer(E), C = GEN[E], R = CTL[E];
  const grp = { ty: score[E], an: score[M], thuc: score[C], tai: score[R], quan: score[K] };
  const ratio = (grp.ty + grp.an) / total;
  const monthWx = ZHI_WX[pillars[1].zhi];
  const deLenh = monthWx === E || monthWx === M;                         // đắc lệnh
  const deDia = pillars.some((p, i) => i !== 1 && p.hide[0] && (p.hide[0].wx === E || p.hide[0].wx === M)); // đắc địa (có gốc)
  const deThe = [0, 1, 3].filter((i) => [E, M].includes(pillars[i].ganWx)).length >= 2; // đắc thế
  const level = ratio >= 0.58 ? "vượng" : ratio >= 0.5 ? "hơi vượng" : ratio >= 0.42 ? "hơi nhược" : "nhược";
  const strong = ratio >= 0.5;

  // dụng thần theo phù ức
  let dung, hy, ky, why;
  if (!strong) {
    if (grp.tai >= grp.quan && grp.tai >= grp.thuc) { dung = E; hy = M; why = `Nhật chủ ${level}, Tài (${WX[R].vi}) nặng nhất làm hao thân → dùng Tỷ Kiếp (${WX[E].vi}) giúp thân gánh Tài, Ấn (${WX[M].vi}) là hỷ thần.`; }
    else { dung = M; hy = E; why = `Nhật chủ ${level}, ${grp.quan >= grp.thuc ? `Quan Sát (${WX[K].vi})` : `Thực Thương (${WX[C].vi})`} tiết/khắc thân mạnh → dùng Ấn (${WX[M].vi}) sinh thân${grp.quan >= grp.thuc ? " và hoá Sát" : ", chế Thương"}, Tỷ Kiếp (${WX[E].vi}) là hỷ thần.`; }
    ky = [K, R, C].filter((x) => x !== dung && x !== hy);
  } else {
    if (grp.an > grp.ty) { dung = R; hy = C; why = `Nhật chủ ${level}, Ấn (${WX[M].vi}) quá dày → dùng Tài (${WX[R].vi}) chế Ấn, Thực Thương (${WX[C].vi}) là hỷ thần.`; }
    else if (grp.quan < 0.6) { dung = C; hy = R; why = `Nhật chủ ${level}, Tỷ Kiếp (${WX[E].vi}) nhiều → dùng Thực Thương (${WX[C].vi}) tiết bớt khí, Tài (${WX[R].vi}) là hỷ thần.`; }
    else { dung = K; hy = R; why = `Nhật chủ ${level}, Tỷ Kiếp (${WX[E].vi}) nhiều → dùng Quan Sát (${WX[K].vi}) chế thân, Tài (${WX[R].vi}) sinh Quan là hỷ thần.`; }
    ky = [E, M].filter((x) => x !== dung && x !== hy);
  }
  // điều hậu: sinh mùa đông cần Hoả, mùa hè cần Thuỷ
  const mz = pillars[1].zhi;
  const tiaohou = "亥子丑".includes(mz) && pct["火"] < 15 ? "火" : "巳午未".includes(mz) && pct["水"] < 15 ? "水" : null;

  // đại vận
  let yun = null;
  try {
    const y = ec.getYun(gender);
    const rate = (gz) => { const a = [wxOf(gz[0]), wxOf(gz[1])]; const s = a.reduce((t, e) => t + (e === dung ? 2 : e === hy ? 1 : ky.includes(e) ? -1.5 : 0), 0); return s >= 2 ? "tốt" : s >= 0.5 ? "khá" : s <= -2 ? "cần thận trọng" : "bình"; };
    yun = { start: `${y.getStartYear()} năm ${y.getStartMonth()} tháng`, list: y.getDaYun().filter((d) => d.getGanZhi()).slice(0, 9).map((d) => ({ gz: d.getGanZhi(), gzVi: gzVi(d.getGanZhi()), from: d.getStartAge(), to: d.getEndAge(), year: d.getStartYear(), rate: rate(d.getGanZhi()), god: tenGod(dm, d.getGanZhi()[0]) })) };
  } catch {}

  return {
    pillars, dm, dmVi: CAN_VI[dm], E, yinyang: YANG.has(dm) ? "Dương" : "Âm",
    score, pct, shown, hidden, lack, strongest, ratio: Math.round(ratio * 100), level, strong, deLenh, deDia, deThe, grp,
    dung, hy, ky, why, tiaohou, yun, xunkong: ec.getDayXunKong(), mingGong: ec.getMingGong(), taiYuan: ec.getTaiYuan(),
    yearNayin: pillars[0].nayin, yearNayinVi: pillars[0].nayinVi, lunar,
  };
}

// tóm tắt gửi AI
export function baziText(a, name, gender) {
  const W2 = (e) => `${WX[e].vi} ${e}`;
  return [
    `Đương số: ${name || "—"}, ${gender === 1 ? "nam" : "nữ"}, âm lịch: ${a.lunar}.`,
    `Tứ trụ: ${a.pillars.map((p) => `${p.vi} ${p.gz} (${p.gzVi}; can ${SHISHEN_VI[p.god]}; tàng ${p.hide.map((h) => `${h.g}-${SHISHEN_VI[h.god]}`).join(" ")}; nạp âm ${p.nayinVi}; ${p.dishiVi})`).join(" | ")}.`,
    `Nhật chủ ${a.dm} (${a.dmVi}, ${a.yinyang} ${WX[a.E].vi}). Ngũ hành %: ${WX_ORDER.map((e) => `${WX[e].vi} ${a.pct[e]}`).join(", ")}. Khuyết (không lộ trong 8 chữ): ${a.lack.map((e) => WX[e].vi).join(", ") || "không"}.`,
    `Thân ${a.level} (lực sinh trợ ${a.ratio}%; ${a.deLenh ? "đắc lệnh" : "thất lệnh"}, ${a.deDia ? "đắc địa" : "không có gốc mạnh"}, ${a.deThe ? "đắc thế" : "không đắc thế"}).`,
    `Theo phép phù ức: dụng thần ${W2(a.dung)}, hỷ thần ${W2(a.hy)}, kỵ thần ${a.ky.map(W2).join(", ")}.${a.tiaohou ? ` Điều hậu cần thêm ${W2(a.tiaohou)}.` : ""}`,
    `Mệnh niên (nạp âm năm): ${a.yearNayinVi}. Không vong ngày: ${a.xunkong}.`,
    a.yun ? `Đại vận (khởi ${a.yun.start} sau sinh): ${a.yun.list.map((d) => `${d.from}–${d.to} tuổi ${d.gz} (${d.rate})`).join("; ")}.` : "",
  ].join("\n");
}
