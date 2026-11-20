// DỮ LIỆU TAB HUYỀN HỌC 玄学 — học tiếng Trung qua Âm dương Ngũ hành, Can Chi, Kinh Dịch, Bát tự, Phong thuỷ, Hoàng lịch
// Mỗi mục: zh (chữ Hán) · hv (Hán Việt) · vi (nghĩa)

export const WX = {
  木: { hv: "Mộc", color: "#3F7D4E", soft: "#E3EEDF", dir: "东", dirVi: "Đông", season: "春", seasonVi: "Xuân", colorZh: "青", colorVi: "xanh", organ: "肝", organVi: "gan", taste: "酸", tasteVi: "chua", emo: "怒", emoVi: "giận", trait: "sinh trưởng, vươn lên" },
  火: { hv: "Hoả", color: "#B8432F", soft: "#F5E0D9", dir: "南", dirVi: "Nam", season: "夏", seasonVi: "Hạ", colorZh: "赤", colorVi: "đỏ", organ: "心", organVi: "tim", taste: "苦", tasteVi: "đắng", emo: "喜", emoVi: "vui", trait: "nóng, bốc lên" },
  土: { hv: "Thổ", color: "#A8812F", soft: "#F3E9CF", dir: "中", dirVi: "Trung tâm", season: "长夏", seasonVi: "Cuối hạ", colorZh: "黄", colorVi: "vàng", organ: "脾", organVi: "tỳ", taste: "甘", tasteVi: "ngọt", emo: "思", emoVi: "lo nghĩ", trait: "nuôi dưỡng, chứa đựng" },
  金: { hv: "Kim", color: "#7A7F87", soft: "#E8E9EA", dir: "西", dirVi: "Tây", season: "秋", seasonVi: "Thu", colorZh: "白", colorVi: "trắng", organ: "肺", organVi: "phổi", taste: "辛", tasteVi: "cay", emo: "悲", emoVi: "buồn", trait: "thu liễm, cứng rắn" },
  水: { hv: "Thuỷ", color: "#2F5E86", soft: "#DCE6EF", dir: "北", dirVi: "Bắc", season: "冬", seasonVi: "Đông", colorZh: "黑", colorVi: "đen", organ: "肾", organVi: "thận", taste: "咸", tasteVi: "mặn", emo: "恐", emoVi: "sợ", trait: "mát, chảy xuống" },
};
export const WX_ORDER = ["木", "火", "土", "金", "水"];
export const SHENG = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" };
export const KE = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" };

export const GAN = [
  { zh: "甲", hv: "Giáp", wx: "木", yy: "阳" }, { zh: "乙", hv: "Ất", wx: "木", yy: "阴" },
  { zh: "丙", hv: "Bính", wx: "火", yy: "阳" }, { zh: "丁", hv: "Đinh", wx: "火", yy: "阴" },
  { zh: "戊", hv: "Mậu", wx: "土", yy: "阳" }, { zh: "己", hv: "Kỷ", wx: "土", yy: "阴" },
  { zh: "庚", hv: "Canh", wx: "金", yy: "阳" }, { zh: "辛", hv: "Tân", wx: "金", yy: "阴" },
  { zh: "壬", hv: "Nhâm", wx: "水", yy: "阳" }, { zh: "癸", hv: "Quý", wx: "水", yy: "阴" },
];
export const ZHI = [
  { zh: "子", hv: "Tý", sx: "鼠", sxVi: "Chuột", wx: "水", yy: "阳", hour: "23–1h", month: "11" },
  { zh: "丑", hv: "Sửu", sx: "牛", sxVi: "Trâu", wx: "土", yy: "阴", hour: "1–3h", month: "12" },
  { zh: "寅", hv: "Dần", sx: "虎", sxVi: "Hổ", wx: "木", yy: "阳", hour: "3–5h", month: "1" },
  { zh: "卯", hv: "Mão", sx: "兔", sxVi: "Thỏ (VN: Mèo)", wx: "木", yy: "阴", hour: "5–7h", month: "2" },
  { zh: "辰", hv: "Thìn", sx: "龙", sxVi: "Rồng", wx: "土", yy: "阳", hour: "7–9h", month: "3" },
  { zh: "巳", hv: "Tỵ", sx: "蛇", sxVi: "Rắn", wx: "火", yy: "阴", hour: "9–11h", month: "4" },
  { zh: "午", hv: "Ngọ", sx: "马", sxVi: "Ngựa", wx: "火", yy: "阳", hour: "11–13h", month: "5" },
  { zh: "未", hv: "Mùi", sx: "羊", sxVi: "Dê", wx: "土", yy: "阴", hour: "13–15h", month: "6" },
  { zh: "申", hv: "Thân", sx: "猴", sxVi: "Khỉ", wx: "金", yy: "阳", hour: "15–17h", month: "7" },
  { zh: "酉", hv: "Dậu", sx: "鸡", sxVi: "Gà", wx: "金", yy: "阴", hour: "17–19h", month: "8" },
  { zh: "戌", hv: "Tuất", sx: "狗", sxVi: "Chó", wx: "土", yy: "阳", hour: "19–21h", month: "9" },
  { zh: "亥", hv: "Hợi", sx: "猪", sxVi: "Lợn", wx: "水", yy: "阴", hour: "21–23h", month: "10" },
];
export const ganOf = (c) => GAN.find((g) => g.zh === c);
export const zhiOf = (c) => ZHI.find((z) => z.zh === c);
export const wxOf = (c) => (ganOf(c) || zhiOf(c) || {}).wx;

// ---------- Bát quái: lines từ dưới lên, 1 = hào dương ----------
export const GUA8 = [
  { zh: "乾", hv: "Càn", img: "天", imgVi: "Trời", lines: [1, 1, 1], wx: "金", fam: "父", famVi: "cha", hou: "西北", houVi: "Tây Bắc", xian: "南", animal: "马", body: "首" },
  { zh: "兑", hv: "Đoài", img: "泽", imgVi: "Đầm", lines: [1, 1, 0], wx: "金", fam: "少女", famVi: "con gái út", hou: "西", houVi: "Tây", xian: "东南", animal: "羊", body: "口" },
  { zh: "离", hv: "Ly", img: "火", imgVi: "Lửa", lines: [1, 0, 1], wx: "火", fam: "中女", famVi: "con gái giữa", hou: "南", houVi: "Nam", xian: "东", animal: "雉", body: "目" },
  { zh: "震", hv: "Chấn", img: "雷", imgVi: "Sấm", lines: [1, 0, 0], wx: "木", fam: "长男", famVi: "con trai cả", hou: "东", houVi: "Đông", xian: "东北", animal: "龙", body: "足" },
  { zh: "巽", hv: "Tốn", img: "风", imgVi: "Gió", lines: [0, 1, 1], wx: "木", fam: "长女", famVi: "con gái cả", hou: "东南", houVi: "Đông Nam", xian: "西南", animal: "鸡", body: "股" },
  { zh: "坎", hv: "Khảm", img: "水", imgVi: "Nước", lines: [0, 1, 0], wx: "水", fam: "中男", famVi: "con trai giữa", hou: "北", houVi: "Bắc", xian: "西", animal: "豕", body: "耳" },
  { zh: "艮", hv: "Cấn", img: "山", imgVi: "Núi", lines: [0, 0, 1], wx: "土", fam: "少男", famVi: "con trai út", hou: "东北", houVi: "Đông Bắc", xian: "西北", animal: "狗", body: "手" },
  { zh: "坤", hv: "Khôn", img: "地", imgVi: "Đất", lines: [0, 0, 0], wx: "土", fam: "母", famVi: "mẹ", hou: "西南", houVi: "Tây Nam", xian: "北", animal: "牛", body: "腹" },
];
export const guaByLines = (l) => GUA8.find((g) => g.lines.join("") === l.join(""));
export const guaOf = (c) => GUA8.find((g) => g.zh === c);

// 64 quẻ theo thứ tự Văn Vương: [tên, Hán Việt, quẻ trên, quẻ dưới, 卦辞 (trích), nghĩa]
const H = [
  ["乾", "Càn", "乾", "乾", "元亨利贞。", "Sáng tạo, cương kiện; tự cường không ngừng"],
  ["坤", "Khôn", "坤", "坤", "元亨，利牝马之贞。", "Nhu thuận, bao dung; đức dày chở muôn vật"],
  ["屯", "Truân", "坎", "震", "元亨利贞，勿用有攸往，利建侯。", "Khó khăn buổi đầu, gian nan khởi sự"],
  ["蒙", "Mông", "艮", "坎", "亨。匪我求童蒙，童蒙求我。", "Non nớt, mông muội; cần học hỏi"],
  ["需", "Nhu", "坎", "乾", "有孚，光亨，贞吉，利涉大川。", "Chờ đợi đúng thời"],
  ["讼", "Tụng", "乾", "坎", "有孚窒惕，中吉，终凶。", "Tranh tụng, kiện cáo; nên dừng đúng lúc"],
  ["师", "Sư", "坤", "坎", "贞，丈人吉，无咎。", "Quân đội, tổ chức; cần người dẫn dắt"],
  ["比", "Tỷ", "坎", "坤", "吉。原筮，元永贞，无咎。", "Gần gũi, liên kết, đoàn kết"],
  ["小畜", "Tiểu Súc", "巽", "乾", "亨。密云不雨，自我西郊。", "Tích luỹ nhỏ, kiềm chế tạm thời"],
  ["履", "Lý", "乾", "兑", "履虎尾，不咥人，亨。", "Bước đi thận trọng, giữ lễ"],
  ["泰", "Thái", "坤", "乾", "小往大来，吉亨。", "Thông suốt, hanh thông"],
  ["否", "Bĩ", "乾", "坤", "否之匪人，不利君子贞，大往小来。", "Bế tắc, trên dưới không thông"],
  ["同人", "Đồng Nhân", "乾", "离", "同人于野，亨，利涉大川。", "Hoà đồng với người"],
  ["大有", "Đại Hữu", "离", "乾", "元亨。", "Có nhiều, thịnh vượng"],
  ["谦", "Khiêm", "坤", "艮", "亨，君子有终。", "Khiêm tốn thì trọn vẹn"],
  ["豫", "Dự", "震", "坤", "利建侯行师。", "Vui vẻ, chuẩn bị sẵn sàng"],
  ["随", "Tuỳ", "兑", "震", "元亨利贞，无咎。", "Đi theo, thuận theo thời"],
  ["蛊", "Cổ", "艮", "巽", "元亨，利涉大川。", "Đổ nát cần sửa sang"],
  ["临", "Lâm", "坤", "兑", "元亨利贞，至于八月有凶。", "Đến gần, giám sát"],
  ["观", "Quan", "巽", "坤", "盥而不荐，有孚颙若。", "Quan sát, chiêm ngưỡng"],
  ["噬嗑", "Phệ Hạp", "离", "震", "亨，利用狱。", "Cắn hợp; trừ bỏ trở ngại, xử phạt"],
  ["贲", "Bí", "艮", "离", "亨，小利有攸往。", "Trang sức, văn vẻ"],
  ["剥", "Bác", "艮", "坤", "不利有攸往。", "Bóc mòn, suy thoái"],
  ["复", "Phục", "坤", "震", "亨。出入无疾，朋来无咎。", "Trở lại, hồi phục"],
  ["无妄", "Vô Vọng", "乾", "震", "元亨利贞。", "Không càn bậy, chân thật"],
  ["大畜", "Đại Súc", "艮", "乾", "利贞，不家食吉，利涉大川。", "Tích chứa lớn"],
  ["颐", "Di", "艮", "震", "贞吉。观颐，自求口实。", "Nuôi dưỡng (thân và tâm)"],
  ["大过", "Đại Quá", "兑", "巽", "栋桡，利有攸往，亨。", "Quá mức, gánh nặng lớn"],
  ["坎", "Khảm", "坎", "坎", "习坎，有孚，维心亨。", "Hiểm trở chồng chất; giữ lòng tin"],
  ["离", "Ly", "离", "离", "利贞，亨，畜牝牛吉。", "Sáng sủa, nương tựa"],
  ["咸", "Hàm", "兑", "艮", "亨，利贞，取女吉。", "Cảm ứng, rung động"],
  ["恒", "Hằng", "震", "巽", "亨，无咎，利贞，利有攸往。", "Bền lâu, kiên trì"],
  ["遯", "Độn", "乾", "艮", "亨，小利贞。", "Lui ẩn đúng lúc"],
  ["大壮", "Đại Tráng", "震", "乾", "利贞。", "Mạnh mẽ lớn; chớ cậy sức"],
  ["晋", "Tấn", "离", "坤", "康侯用锡马蕃庶，昼日三接。", "Tiến lên, thăng tiến"],
  ["明夷", "Minh Di", "坤", "离", "利艰贞。", "Ánh sáng bị che; ẩn mình giữ chính"],
  ["家人", "Gia Nhân", "巽", "离", "利女贞。", "Người trong nhà, gia đạo"],
  ["睽", "Khuê", "离", "兑", "小事吉。", "Chia lìa, trái ý"],
  ["蹇", "Kiển", "坎", "艮", "利西南，不利东北，利见大人。", "Gian nan, bước khó"],
  ["解", "Giải", "震", "坎", "利西南。", "Giải toả, cởi bỏ"],
  ["损", "Tổn", "艮", "兑", "有孚，元吉，无咎。", "Bớt đi, hy sinh"],
  ["益", "Ích", "巽", "震", "利有攸往，利涉大川。", "Thêm vào, có lợi"],
  ["夬", "Quải", "兑", "乾", "扬于王庭。", "Quyết đoán, dứt khoát"],
  ["姤", "Cấu", "乾", "巽", "女壮，勿用取女。", "Gặp gỡ bất ngờ"],
  ["萃", "Tuỵ", "兑", "坤", "亨，王假有庙。", "Tụ họp"],
  ["升", "Thăng", "坤", "巽", "元亨，用见大人，勿恤。", "Đi lên từng bước"],
  ["困", "Khốn", "兑", "坎", "亨，贞大人吉，无咎。", "Khốn cùng; giữ chí"],
  ["井", "Tỉnh", "坎", "巽", "改邑不改井。", "Cái giếng; nuôi người không cạn"],
  ["革", "Cách", "兑", "离", "巳日乃孚，元亨利贞，悔亡。", "Đổi mới, cải cách"],
  ["鼎", "Đỉnh", "离", "巽", "元吉，亨。", "Cái vạc; lập cái mới"],
  ["震", "Chấn", "震", "震", "亨。震来虩虩，笑言哑哑。", "Sấm động; kinh sợ rồi bình tĩnh"],
  ["艮", "Cấn", "艮", "艮", "艮其背，不获其身。", "Dừng lại đúng chỗ"],
  ["渐", "Tiệm", "巽", "艮", "女归吉，利贞。", "Tiến dần dần"],
  ["归妹", "Quy Muội", "震", "兑", "征凶，无攸利。", "Em gái về nhà chồng; chớ vội"],
  ["丰", "Phong", "震", "离", "亨，王假之，勿忧，宜日中。", "Thịnh lớn; như mặt trời giữa trưa"],
  ["旅", "Lữ", "离", "艮", "小亨，旅贞吉。", "Đi xa, lữ khách"],
  ["巽", "Tốn", "巽", "巽", "小亨，利有攸往，利见大人。", "Thuận theo, thấm vào như gió"],
  ["兑", "Đoài", "兑", "兑", "亨，利贞。", "Vui vẻ, trò chuyện"],
  ["涣", "Hoán", "巽", "坎", "亨，王假有庙，利涉大川。", "Tan tác; cần gom lại"],
  ["节", "Tiết", "坎", "兑", "亨，苦节不可贞。", "Tiết chế vừa phải"],
  ["中孚", "Trung Phu", "巽", "兑", "豚鱼吉，利涉大川。", "Thành tín từ bên trong"],
  ["小过", "Tiểu Quá", "震", "艮", "亨利贞，可小事，不可大事。", "Hơi quá; làm việc nhỏ"],
  ["既济", "Ký Tế", "坎", "离", "亨小，利贞，初吉终乱。", "Đã xong; giữ gìn kẻo loạn"],
  ["未济", "Vị Tế", "离", "坎", "亨，小狐汔济，濡其尾，无攸利。", "Chưa xong; còn đường tiến"],
];
const PURE = { 乾: "乾为天", 坤: "坤为地", 坎: "坎为水", 离: "离为火", 震: "震为雷", 艮: "艮为山", 巽: "巽为风", 兑: "兑为泽" };
export const GUA64 = H.map(([zh, hv, up, lo, ci, vi], i) => ({
  n: i + 1, zh, hv, up, lo, ci, vi,
  full: up === lo ? PURE[up] : guaOf(up).img + guaOf(lo).img + zh,
  lines: [...guaOf(lo).lines, ...guaOf(up).lines],
}));
export const guaBy6 = (l) => GUA64.find((g) => g.lines.join("") === l.join(""));

// ---------- Phong thuỷ: 命卦 (Bát trạch) ----------
const D8 = { N: ["北", "Bắc"], NE: ["东北", "Đông Bắc"], E: ["东", "Đông"], SE: ["东南", "Đông Nam"], S: ["南", "Nam"], SW: ["西南", "Tây Nam"], W: ["西", "Tây"], NW: ["西北", "Tây Bắc"] };
export const STARS = [
  { zh: "生气", hv: "Sinh Khí", good: true, vi: "tài lộc, sức sống — hướng tốt nhất" },
  { zh: "天医", hv: "Thiên Y", good: true, vi: "sức khoẻ, quý nhân" },
  { zh: "延年", hv: "Diên Niên", good: true, vi: "hoà thuận, tình cảm, tuổi thọ" },
  { zh: "伏位", hv: "Phục Vị", good: true, vi: "bình yên, vững vàng" },
  { zh: "祸害", hv: "Hoạ Hại", good: false, vi: "thị phi, rắc rối nhỏ" },
  { zh: "六煞", hv: "Lục Sát", good: false, vi: "trắc trở tình cảm, kiện tụng" },
  { zh: "五鬼", hv: "Ngũ Quỷ", good: false, vi: "hao tài, tranh cãi" },
  { zh: "绝命", hv: "Tuyệt Mệnh", good: false, vi: "xấu nhất" },
];
const KUA_DIR = {
  1: ["SE", "E", "S", "N", "W", "NW", "NE", "SW"], 2: ["NE", "W", "NW", "SW", "E", "S", "SE", "N"],
  3: ["S", "N", "SE", "E", "SW", "NE", "NW", "W"], 4: ["N", "S", "E", "SE", "NW", "W", "SW", "NE"],
  6: ["W", "NE", "SW", "NW", "SE", "N", "E", "S"], 7: ["NW", "SW", "NE", "W", "N", "SE", "S", "E"],
  8: ["SW", "NW", "W", "NE", "S", "E", "N", "SE"], 9: ["E", "SE", "N", "S", "NE", "SW", "W", "NW"],
};
const KUA_GUA = { 1: "坎", 2: "坤", 3: "震", 4: "巽", 6: "乾", 7: "兑", 8: "艮", 9: "离" };
// year: năm tính theo Lập Xuân; male: true/false
export function mingGua(year, male) {
  const r = ((year % 9) + 9) % 9;
  let k = male ? (11 - r) % 9 : (r + 4) % 9;
  if (k === 0) k = 9;
  if (k === 5) k = male ? 2 : 8;
  const east = [1, 3, 4, 9].includes(k);
  return { k, gua: guaOf(KUA_GUA[k]), east, dirs: KUA_DIR[k].map((d, i) => ({ ...STARS[i], dir: D8[d][0], dirVi: D8[d][1] })) };
}

// ---------- Hoàng lịch: nghĩa các việc 宜/忌 ----------
export const YIJI = {
  祭祀: "cúng tế", 祈福: "cầu phúc", 求嗣: "cầu con", 开光: "khai quang (tượng)", 斋醮: "lập đàn cúng", 出行: "xuất hành", 入宅: "vào nhà mới", 移徙: "chuyển nhà",
  嫁娶: "cưới gả", 纳采: "dạm ngõ", 订盟: "đính ước", 问名: "hỏi tên (lễ hỏi)", 纳婿: "đón rể", 冠笄: "lễ trưởng thành", 会亲友: "gặp họ hàng bạn bè", 进人口: "thêm người",
  开市: "khai trương", 交易: "giao dịch", 立券: "lập khế ước", 纳财: "thu tiền", 出货财: "xuất hàng", 置产: "mua tài sản", 开仓: "mở kho", 雇佣: "thuê người",
  修造: "sửa chữa xây dựng", 动土: "động thổ", 破土: "phá thổ (đào mộ)", 起基: "đặt móng", 定磉: "đặt chân cột", 竖柱: "dựng cột", 上梁: "cất nóc", 盖屋: "lợp nhà",
  安门: "lắp cửa", 修门: "sửa cửa", 作灶: "làm bếp", 安床: "kê giường", 扫舍: "quét dọn nhà", 拆卸: "tháo dỡ", 破屋: "phá nhà", 坏垣: "phá tường", 补垣: "vá tường",
  修饰垣墙: "sửa tường", 塞穴: "lấp hang hốc", 平治道涂: "sửa đường", 造桥: "làm cầu", 掘井: "đào giếng", 开池: "đào ao", 开渠: "khơi mương", 放水: "tháo nước",
  筑堤: "đắp đê", 造仓: "làm kho", 造畜稠: "làm chuồng", 纳畜: "mua gia súc", 牧养: "chăn nuôi", 教牛马: "luyện trâu ngựa", 栽种: "trồng trọt", 伐木: "đốn gỗ",
  取渔: "đánh cá", 结网: "đan lưới", 畋猎: "săn bắn", 捕捉: "bắt bắt", 安葬: "an táng", 行丧: "đưa tang", 入殓: "nhập liệm", 移柩: "di quan", 启钻: "cải táng",
  修坟: "sửa mộ", 立碑: "dựng bia", 开生坟: "làm sinh phần", 合寿木: "đóng thọ mộc", 除服: "bỏ tang", 成服: "mặc tang", 谢土: "tạ đất", 安香: "an vị bát hương",
  出火: "dời bàn thờ", 理发: "cắt tóc", 沐浴: "tắm gội", 裁衣: "may áo", 治病: "chữa bệnh", 求医: "tìm thầy thuốc", 针灸: "châm cứu", 探病: "thăm bệnh",
  整手足甲: "cắt móng", 入学: "nhập học", 习艺: "học nghề", 赴任: "nhậm chức", 词讼: "kiện tụng", 解除: "giải trừ, dọn dẹp", 分居: "ở riêng", 安机械: "lắp máy móc",
  造车器: "đóng xe", 造船: "đóng thuyền", 乘船: "đi thuyền", 挂匾: "treo biển", 塑绘: "đắp vẽ tượng", 雕刻: "chạm khắc", 造庙: "xây miếu", 开厕: "làm nhà vệ sinh",
  安碓磑: "đặt cối xay", 合帐: "may màn", 经络: "dệt vải", 割蜜: "lấy mật ong", 断蚁: "diệt mối", 作梁: "làm xà", 架马: "dựng giàn", 开柱眼: "đục lỗ cột", 合脊: "lợp nóc",
  归宁: "con gái về thăm nhà", 归岫: "về núi", 普渡: "lễ phổ độ", 馀事勿取: "ngoài ra chớ làm gì", 诸事不宜: "mọi việc không nên", 无: "không có",
};

// ---------- Từ vựng & thành ngữ theo chủ đề ----------
export const VOCAB = {
  wx: [
    ["阴阳", "Âm dương", "hai mặt đối lập mà thống nhất"], ["五行", "Ngũ hành", "năm hành: Mộc Hoả Thổ Kim Thuỷ"], ["相生", "tương sinh", "sinh ra, nuôi dưỡng nhau"],
    ["相克", "tương khắc", "chế ngự nhau"], ["太极", "Thái cực", "nguồn gốc ban đầu"], ["两仪", "Lưỡng nghi", "âm và dương"], ["平衡", "bình hành", "cân bằng"],
    ["对立", "đối lập", "đối lập"], ["转化", "chuyển hoá", "biến đổi sang nhau"], ["属性", "thuộc tính", "thuộc tính"], ["元素", "nguyên tố", "yếu tố"], ["循环", "tuần hoàn", "vòng lặp"],
  ],
  gz: [
    ["天干", "Thiên can", "10 can"], ["地支", "Địa chi", "12 chi"], ["干支", "Can chi", "can + chi"], ["生肖", "sinh tiêu", "con giáp"], ["属相", "thuộc tướng", "tuổi con gì"],
    ["本命年", "bản mệnh niên", "năm tuổi"], ["六十甲子", "Lục thập hoa giáp", "chu kỳ 60 năm"], ["纳音", "nạp âm", "mệnh theo năm (vd 海中金)"], ["时辰", "thời thần", "giờ (2 tiếng)"],
    ["农历", "nông lịch", "âm lịch"], ["节气", "tiết khí", "24 tiết khí"], ["属什么？", "", "Bạn tuổi con gì?"],
  ],
  yj: [
    ["易经", "Dịch kinh", "Kinh Dịch"], ["八卦", "Bát quái", "8 quẻ"], ["卦", "quái", "quẻ"], ["爻", "hào", "vạch của quẻ"], ["阳爻", "dương hào", "vạch liền ⚊"], ["阴爻", "âm hào", "vạch đứt ⚋"],
    ["本卦", "bản quái", "quẻ chính"], ["变卦", "biến quái", "quẻ biến"], ["动爻", "động hào", "hào động"], ["卦辞", "quái từ", "lời quẻ"], ["占卜", "chiêm bốc", "bói toán"], ["吉凶", "cát hung", "tốt xấu"],
  ],
  bz: [
    ["八字", "Bát tự", "8 chữ năm-tháng-ngày-giờ"], ["四柱", "Tứ trụ", "4 cột"], ["日主", "nhật chủ", "can ngày = bản thân"], ["命理", "mệnh lý", "học thuyết về số mệnh"],
    ["十神", "Thập thần", "10 quan hệ với nhật chủ"], ["喜用神", "hỷ dụng thần", "hành có lợi"], ["缺", "khuyết", "thiếu (vd 五行缺水)"], ["旺", "vượng", "mạnh"], ["弱", "nhược", "yếu"], ["算命", "toán mệnh", "xem số"],
  ],
  fs: [
    ["风水", "Phong thuỷ", "gió nước"], ["命卦", "mệnh quái", "quẻ mệnh"], ["东四命", "Đông tứ mệnh", "nhóm mệnh Đông"], ["西四命", "Tây tứ mệnh", "nhóm mệnh Tây"], ["方位", "phương vị", "phương hướng"],
    ["朝向", "triều hướng", "hướng nhà"], ["坐北朝南", "toạ Bắc hướng Nam", "lưng Bắc mặt Nam"], ["罗盘", "la bàn", "la bàn phong thuỷ"], ["九宫", "Cửu cung", "9 ô"], ["明堂", "minh đường", "khoảng sân trước nhà"],
  ],
  hl: [
    ["黄历", "Hoàng lịch", "lịch xem ngày"], ["宜", "nghi", "nên làm"], ["忌", "kỵ", "kiêng"], ["冲", "xung", "xung khắc với tuổi"], ["煞", "sát", "hướng sát"], ["择日", "trạch nhật", "chọn ngày"],
    ["吉日", "cát nhật", "ngày tốt"], ["黄道", "Hoàng đạo", "ngày/giờ tốt"], ["黑道", "Hắc đạo", "ngày/giờ xấu"], ["喜神", "Hỷ thần", "thần vui"], ["财神", "Tài thần", "thần tài"], ["福神", "Phúc thần", "thần phúc"],
  ],
};
export const IDIOMS = {
  wx: [["水火不容", "nước lửa không dung nhau — xung khắc"], ["水到渠成", "nước chảy thành mương — thuận theo tự nhiên"], ["木已成舟", "gỗ đã thành thuyền — việc đã rồi"], ["火上浇油", "đổ dầu vào lửa"], ["金玉满堂", "vàng ngọc đầy nhà"], ["土崩瓦解", "đất lở ngói tan — sụp đổ hoàn toàn"], ["阴差阳错", "âm sai dương lệch — trớ trêu ngẫu nhiên"]],
  gz: [["鼠目寸光", "mắt chuột tầm ngắn — thiển cận"], ["对牛弹琴", "đàn gảy tai trâu"], ["虎头蛇尾", "đầu hổ đuôi rắn — đầu voi đuôi chuột"], ["守株待兔", "ôm cây đợi thỏ"], ["画龙点睛", "vẽ rồng điểm mắt"], ["画蛇添足", "vẽ rắn thêm chân"], ["马到成功", "ngựa đến là thành công"], ["亡羊补牢", "mất bò mới lo làm chuồng"], ["闻鸡起舞", "nghe gà gáy dậy múa kiếm — chăm chỉ"], ["猴年马月", "năm khỉ tháng ngựa — chẳng biết bao giờ"]],
  yj: [["自强不息", "tự cường không ngừng (象传·乾)"], ["厚德载物", "đức dày chở muôn vật (象传·坤)"], ["否极泰来", "hết bĩ đến thái — hết khổ đến sướng"], ["谦谦君子", "người quân tử khiêm nhường (谦卦)"], ["革故鼎新", "bỏ cũ lập mới (革·鼎)"], ["穷则变，变则通", "cùng tắc biến, biến tắc thông (系辞)"], ["见仁见智", "người nhân thấy nhân, người trí thấy trí"]],
  fs: [["藏风聚气", "giữ gió tụ khí"], ["背山面水", "tựa núi nhìn sông"], ["左青龙，右白虎", "trái Thanh Long, phải Bạch Hổ"], ["风水宝地", "đất phong thuỷ quý"], ["紫气东来", "khí tía từ phương Đông — điềm lành"]],
  hl: [["黄道吉日", "ngày hoàng đạo tốt lành"], ["良辰吉日", "giờ đẹp ngày lành"], ["诸事不宜", "mọi việc đều không nên"], ["百无禁忌", "trăm việc không kiêng"], ["趋吉避凶", "theo lành tránh dữ"]],
};

// Hán Việt cho thập thần
export const SHISHEN = { 比肩: "Tỷ kiên", 劫财: "Kiếp tài", 食神: "Thực thần", 伤官: "Thương quan", 偏财: "Thiên tài", 正财: "Chính tài", 七杀: "Thất sát", 正官: "Chính quan", 偏印: "Thiên ấn", 正印: "Chính ấn", 日主: "Nhật chủ" };
export const SX_ZH = { 鼠: "Chuột", 牛: "Trâu", 虎: "Hổ", 兔: "Thỏ/Mèo", 龙: "Rồng", 蛇: "Rắn", 马: "Ngựa", 羊: "Dê", 猴: "Khỉ", 鸡: "Gà", 狗: "Chó", 猪: "Lợn" };
