// 塔罗牌 — dữ liệu 78 lá Tarot (Rider–Waite) song ngữ Trung – Việt: tên, từ khoá xuôi/ngược, ý nghĩa.
// Bộ Ẩn chính (大阿尔卡那) 22 lá có lời giải đầy đủ; bộ Ẩn phụ (小阿尔卡那) 56 lá có từ khoá + ý chính.

export const MAJOR = [
  { n: 0, zh: "愚者", en: "The Fool", vi: "Kẻ Khờ", g: "◯", kw: ["khởi đầu mới", "tự do", "liều lĩnh ngây thơ"], rk: ["bốc đồng", "thiếu chuẩn bị", "sợ bắt đầu"],
    up: "Một chặng đường mới mở ra. Bạn đang đứng trước điều chưa biết với tâm thế nhẹ nhõm, sẵn sàng thử. Lá này khuyến khích bước đi dù chưa nắm hết mọi thứ.",
    rev: "Hăng hái nhưng thiếu tính toán, hoặc ngược lại là chần chừ không dám bắt đầu. Nên nhìn kỹ rủi ro trước khi nhảy." },
  { n: 1, zh: "魔术师", en: "The Magician", vi: "Nhà Ảo Thuật", g: "∞", kw: ["hành động", "đủ công cụ", "biến ý tưởng thành thật"], rk: ["lãng phí năng lực", "thao túng", "nói nhiều làm ít"],
    up: "Bạn có đủ kỹ năng và nguồn lực để làm điều mình muốn. Đây là lúc tập trung ý chí và bắt tay vào làm.",
    rev: "Năng lực có nhưng phân tán, hoặc có người dùng lời lẽ khéo để dẫn dắt bạn. Kiểm tra lại động cơ của mình và người khác." },
  { n: 2, zh: "女祭司", en: "The High Priestess", vi: "Nữ Tư Tế", g: "☾", kw: ["trực giác", "bí ẩn", "tĩnh lặng lắng nghe"], rk: ["bỏ qua trực giác", "bí mật bị che", "rối trí"],
    up: "Câu trả lời nằm ở bên trong. Hãy chậm lại, quan sát và tin vào cảm nhận; chưa phải lúc nói ra hết.",
    rev: "Bạn đang lờ đi tiếng nói bên trong, hoặc có thông tin còn bị giấu. Cần thời gian yên tĩnh để nhìn rõ." },
  { n: 3, zh: "皇后", en: "The Empress", vi: "Hoàng Hậu", g: "♀", kw: ["sung túc", "nuôi dưỡng", "sáng tạo"], rk: ["phụ thuộc", "bỏ bê bản thân", "trì trệ"],
    up: "Thời kỳ đơm hoa kết trái: công sức được đền đáp, các mối quan hệ ấm áp, sức sáng tạo dồi dào.",
    rev: "Chăm lo cho người khác mà quên mình, hoặc ôm đồm quá mức. Cần cân bằng lại việc cho và nhận." },
  { n: 4, zh: "皇帝", en: "The Emperor", vi: "Hoàng Đế", g: "♔", kw: ["trật tự", "quyền lực", "kỷ luật"], rk: ["độc đoán", "cứng nhắc", "mất kiểm soát"],
    up: "Cấu trúc và kỷ luật mang lại kết quả. Đặt kế hoạch rõ ràng, giữ vững nguyên tắc, nhận vai trò dẫn dắt.",
    rev: "Kiểm soát quá chặt hoặc gặp người áp đặt. Cũng có thể là thiếu kỷ luật khiến mọi thứ lỏng lẻo." },
  { n: 5, zh: "教皇", en: "The Hierophant", vi: "Giáo Hoàng", g: "✠", kw: ["truyền thống", "thầy dẫn dắt", "học hỏi"], rk: ["phá lệ", "giáo điều", "tự tìm lối riêng"],
    up: "Đi theo con đường đã được kiểm chứng, học từ người có kinh nghiệm, tôn trọng quy tắc chung.",
    rev: "Khuôn phép cũ không còn hợp; bạn muốn tự tìm cách riêng. Hoặc đang bị ràng buộc bởi lề lối cứng nhắc." },
  { n: 6, zh: "恋人", en: "The Lovers", vi: "Tình Nhân", g: "♡", kw: ["tình yêu", "hoà hợp", "lựa chọn quan trọng"], rk: ["mất cân bằng", "lựa chọn sai", "bất đồng giá trị"],
    up: "Sự gắn kết chân thành và một lựa chọn cần đi theo giá trị thật của bạn. Trong tình cảm: hai người đồng điệu.",
    rev: "Mâu thuẫn trong quan hệ hoặc trong chính mình. Lựa chọn đang bị chi phối bởi cảm xúc nhất thời." },
  { n: 7, zh: "战车", en: "The Chariot", vi: "Cỗ Xe", g: "⛉", kw: ["quyết tâm", "chiến thắng", "làm chủ hướng đi"], rk: ["mất phương hướng", "nóng vội", "bị cản trở"],
    up: "Ý chí mạnh đưa bạn vượt chướng ngại. Giữ tập trung, điều khiển các lực trái chiều về cùng một hướng.",
    rev: "Mỗi phần trong bạn kéo một hướng. Dừng lại xác định đích đến trước khi tăng tốc." },
  { n: 8, zh: "力量", en: "Strength", vi: "Sức Mạnh", g: "♌", kw: ["can đảm", "kiên nhẫn", "mềm mà mạnh"], rk: ["tự ti", "mất bình tĩnh", "yếu lòng"],
    up: "Sức mạnh thật đến từ sự bình tĩnh và lòng trắc ẩn. Kiên nhẫn sẽ thuần phục được khó khăn.",
    rev: "Nghi ngờ bản thân hoặc để cảm xúc lấn át. Hãy dịu dàng với chính mình để lấy lại sức." },
  { n: 9, zh: "隐士", en: "The Hermit", vi: "Ẩn Sĩ", g: "✧", kw: ["chiêm nghiệm", "tìm câu trả lời bên trong", "một mình"], rk: ["cô lập", "trốn tránh", "lạc lối"],
    up: "Lúc cần lùi lại, suy ngẫm và tìm hiểu sâu. Một mình không phải cô đơn mà để nhìn rõ hơn.",
    rev: "Rút lui quá lâu thành cô lập. Có thể đã đến lúc chia sẻ và kết nối lại." },
  { n: 10, zh: "命运之轮", en: "Wheel of Fortune", vi: "Bánh Xe Số Phận", g: "☸", kw: ["vận may", "bước ngoặt", "chu kỳ"], rk: ["vận xui tạm thời", "cưỡng lại thay đổi", "lặp vòng cũ"],
    up: "Vòng quay đang chuyển theo hướng có lợi. Nắm bắt cơ hội vì thời thế đang thay đổi.",
    rev: "Giai đoạn trầm trong chu kỳ. Điều không kiểm soát được thì buông, tập trung vào việc mình làm được." },
  { n: 11, zh: "正义", en: "Justice", vi: "Công Lý", g: "⚖", kw: ["công bằng", "sự thật", "nhân – quả"], rk: ["bất công", "né trách nhiệm", "thiên lệch"],
    up: "Kết quả tương xứng với việc đã làm. Quyết định cần sáng suốt, trung thực, cân nhắc hai phía.",
    rev: "Có sự thiếu công bằng hoặc chưa nhìn nhận trách nhiệm của mình. Cẩn thận chuyện giấy tờ, cam kết." },
  { n: 12, zh: "倒吊人", en: "The Hanged Man", vi: "Người Treo Ngược", g: "⟂", kw: ["tạm dừng", "đổi góc nhìn", "hy sinh"], rk: ["trì hoãn vô ích", "bế tắc", "hy sinh không đáng"],
    up: "Mọi thứ tạm đứng yên để bạn nhìn từ góc khác. Buông bớt kiểm soát sẽ thấy lối ra.",
    rev: "Chờ đợi đã quá lâu mà không thay đổi gì. Cần quyết định thay vì treo lơ lửng." },
  { n: 13, zh: "死神", en: "Death", vi: "Tử Thần", g: "✝", kw: ["kết thúc", "chuyển hoá", "khép lại để mở ra"], rk: ["níu kéo cái cũ", "sợ thay đổi", "chuyển biến chậm"],
    up: "Không phải điềm chết chóc: đây là sự kết thúc một giai đoạn để cái mới bắt đầu. Buông cái đã hết thời.",
    rev: "Bạn đang níu điều nên kết thúc. Càng cưỡng lại, quá trình chuyển đổi càng kéo dài." },
  { n: 14, zh: "节制", en: "Temperance", vi: "Tiết Chế", g: "⧖", kw: ["cân bằng", "điều hoà", "từ từ mà chắc"], rk: ["thái quá", "mất cân bằng", "vội vàng"],
    up: "Kết hợp hài hoà các yếu tố, giữ chừng mực. Kiên nhẫn để mọi thứ tự vào đúng chỗ.",
    rev: "Đang làm quá một việc gì đó (làm việc, chi tiêu, cảm xúc). Cần điều chỉnh lại nhịp sống." },
  { n: 15, zh: "恶魔", en: "The Devil", vi: "Ác Quỷ", g: "⛧", kw: ["ràng buộc", "cám dỗ", "thói quen xấu"], rk: ["thoát ràng buộc", "tỉnh ngộ", "lấy lại tự do"],
    up: "Có thứ đang trói buộc bạn: thói quen, ham muốn, một mối quan hệ độc hại. Xiềng xích thường lỏng hơn bạn nghĩ.",
    rev: "Bạn bắt đầu nhận ra và gỡ bỏ ràng buộc. Một bước tiến tới tự do." },
  { n: 16, zh: "高塔", en: "The Tower", vi: "Tòa Tháp", g: "⚡", kw: ["biến động bất ngờ", "sụp đổ", "thức tỉnh"], rk: ["tránh được đổ vỡ lớn", "thay đổi âm ỉ", "sợ biến động"],
    up: "Một thay đổi đột ngột làm lung lay nền tảng cũ. Đau nhưng giúp xây lại trên nền vững hơn.",
    rev: "Biến động đang âm ỉ hoặc bạn cố trì hoãn nó. Đối mặt sớm thì đỡ thiệt hơn." },
  { n: 17, zh: "星星", en: "The Star", vi: "Ngôi Sao", g: "★", kw: ["hy vọng", "chữa lành", "cảm hứng"], rk: ["mất niềm tin", "nản lòng", "kỳ vọng xa vời"],
    up: "Sau giông bão là bình yên. Niềm tin và hy vọng trở lại, mọi thứ đang được chữa lành.",
    rev: "Bạn tạm mất niềm tin vào bản thân hay tương lai. Bắt đầu từ những việc nhỏ để thắp lại hy vọng." },
  { n: 18, zh: "月亮", en: "The Moon", vi: "Mặt Trăng", g: "☽", kw: ["mơ hồ", "lo âu", "ảo ảnh"], rk: ["sáng tỏ dần", "vượt nỗi sợ", "sự thật lộ ra"],
    up: "Mọi thứ chưa rõ ràng, dễ bị nỗi lo và tưởng tượng dẫn dắt. Đừng vội kết luận.",
    rev: "Màn sương tan dần, điều bị che giấu lộ ra. Nỗi sợ giảm bớt." },
  { n: 19, zh: "太阳", en: "The Sun", vi: "Mặt Trời", g: "☉", kw: ["thành công", "niềm vui", "rõ ràng"], rk: ["niềm vui bị trì hoãn", "lạc quan quá", "mây che tạm thời"],
    up: "Một trong những lá tốt nhất: thành công, sức sống, mọi việc minh bạch và vui vẻ.",
    rev: "Điều tốt vẫn đến nhưng chậm hơn hoặc nhỏ hơn mong đợi. Giữ thái độ tích cực nhưng thực tế." },
  { n: 20, zh: "审判", en: "Judgement", vi: "Phán Xét", g: "♫", kw: ["thức tỉnh", "tổng kết", "tiếng gọi mới"], rk: ["tự trách", "không chịu nhìn lại", "bỏ lỡ cơ hội"],
    up: "Lúc nhìn lại hành trình, rút bài học và đáp lại tiếng gọi cho giai đoạn mới.",
    rev: "Tự phán xét bản thân quá khắt khe, hoặc né tránh việc nhìn lại. Tha thứ để bước tiếp." },
  { n: 21, zh: "世界", en: "The World", vi: "Thế Giới", g: "⊕", kw: ["hoàn thành", "viên mãn", "trọn vẹn"], rk: ["chưa trọn", "thiếu bước cuối", "trì hoãn kết thúc"],
    up: "Một chu kỳ khép lại trọn vẹn. Thành quả, sự hoà hợp, có thể là chuyến đi xa hay bước lên tầm mới.",
    rev: "Gần tới đích nhưng còn thiếu mảnh cuối. Hoàn tất việc dang dở trước khi bắt đầu việc mới." },
];

export const SUITS = {
  wands: { zh: "权杖", vi: "Gậy", el: "Hoả 火", area: "hành động, đam mê, sự nghiệp", c: "#E07A63" },
  cups: { zh: "圣杯", vi: "Cốc", el: "Thuỷ 水", area: "cảm xúc, tình cảm, các mối quan hệ", c: "#6FA8DC" },
  swords: { zh: "宝剑", vi: "Kiếm", el: "Phong 风", area: "suy nghĩ, lời nói, mâu thuẫn", c: "#B8C2CC" },
  pentacles: { zh: "星币", vi: "Tiền", el: "Thổ 土", area: "tiền bạc, công việc, vật chất, sức khoẻ", c: "#D4AF5F" },
};
export const RANKS = [
  ["一", "Át", "Ace"], ["二", "2", "Two"], ["三", "3", "Three"], ["四", "4", "Four"], ["五", "5", "Five"], ["六", "6", "Six"], ["七", "7", "Seven"],
  ["八", "8", "Eight"], ["九", "9", "Nine"], ["十", "10", "Ten"], ["侍从", "Tiểu Đồng", "Page"], ["骑士", "Hiệp Sĩ", "Knight"], ["王后", "Nữ Hoàng", "Queen"], ["国王", "Vua", "King"],
];
// [xuôi, ngược] cho từng lá theo thứ tự RANKS
const MINOR_KW = {
  wands: [
    ["cảm hứng mới, khởi đầu dự án", "chậm khởi động, thiếu động lực"], ["lên kế hoạch, nhìn xa", "sợ rủi ro, kế hoạch dở dang"], ["mở rộng, chờ kết quả", "trì hoãn, tầm nhìn hạn hẹp"],
    ["ăn mừng, ổn định, mái ấm", "bất ổn trong nhà, thiếu gắn kết"], ["cạnh tranh, va chạm", "tránh xung đột, mâu thuẫn ngầm"], ["được công nhận, thắng lợi", "tự cao, thất vọng vì không được ghi nhận"],
    ["giữ vững lập trường", "mệt mỏi, muốn buông"], ["tiến triển nhanh, tin tức đến", "chậm trễ, vội vàng sai"], ["kiên trì, phòng thủ", "kiệt sức, đa nghi"],
    ["gánh nặng, ôm quá nhiều", "buông bớt, chia sẻ việc"], ["tin vui, nhiệt huyết khám phá", "thiếu định hướng, tin xấu nhỏ"], ["hăng hái, dấn thân", "nóng nảy, bốc đồng"],
    ["tự tin, ấm áp, cuốn hút", "ghen tị, đòi hỏi"], ["lãnh đạo, tầm nhìn", "độc đoán, kỳ vọng quá cao"],
  ],
  cups: [
    ["tình cảm mới, cảm xúc tràn đầy", "kìm nén cảm xúc, trống rỗng"], ["đôi lứa, kết nối hai người", "rạn nứt, mất cân bằng"], ["bạn bè, tụ họp vui vẻ", "tiệc tùng quá đà, người thứ ba"],
    ["chán nản, bỏ lỡ cơ hội", "nhận ra điều mới, thức tỉnh"], ["mất mát, tiếc nuối", "chấp nhận, hồi phục"], ["kỷ niệm, hoài niệm ngây thơ", "sống mãi trong quá khứ"],
    ["nhiều lựa chọn, mơ mộng", "tỉnh táo, chọn được hướng"], ["rời bỏ để tìm điều sâu hơn", "sợ rời đi, níu kéo"], ["mãn nguyện, ước nguyện thành", "tự mãn, hưởng thụ quá mức"],
    ["hạnh phúc gia đình, viên mãn", "bất hoà trong nhà"], ["tin vui tình cảm, nhạy cảm", "non nớt cảm xúc"], ["lãng mạn, lời mời", "thất thường, hứa suông"],
    ["thấu cảm, dịu dàng", "phụ thuộc cảm xúc, bất an"], ["điềm tĩnh, bao dung", "thao túng cảm xúc, lạnh lùng"],
  ],
  swords: [
    ["sáng suốt, đột phá trong suy nghĩ", "rối trí, hiểu lầm"], ["do dự, bế tắc", "thông tin quá tải, buộc phải chọn"], ["đau lòng, tổn thương", "hồi phục, tha thứ"],
    ["nghỉ ngơi, hồi sức", "kiệt sức, bồn chồn"], ["tranh chấp, thắng mà mất", "hoà giải, buông bỏ"], ["chuyển đi, vượt qua khó khăn", "mắc kẹt, việc chưa giải quyết"],
    ["mưu mẹo, lén lút", "lộ chuyện, thú nhận"], ["tự trói buộc, cảm giác bế tắc", "thoát ra, nhìn thấy lối"], ["lo âu, mất ngủ", "lo âu giảm, hy vọng"],
    ["chạm đáy, kết thúc đau đớn", "hồi phục, điều tệ nhất đã qua"], ["tò mò, ham học, cảnh giác", "nói nhiều, đa nghi"], ["quyết liệt, nhanh nhạy", "hấp tấp, gây hấn"],
    ["sắc sảo, độc lập, thẳng thắn", "lạnh lùng, cay nghiệt"], ["lý trí, công tâm, uy tín", "lạm quyền, thao túng"],
  ],
  pentacles: [
    ["cơ hội tài chính, khởi đầu vững", "lỡ cơ hội, kế hoạch tài chính kém"], ["xoay xở, cân bằng nhiều việc", "quá tải, mất cân đối thu chi"], ["hợp tác, tay nghề được công nhận", "làm việc nhóm kém, thiếu chất lượng"],
    ["giữ của, an toàn", "keo kiệt, bám víu vật chất"], ["khó khăn tài chính, thiếu thốn", "hồi phục, được giúp đỡ"], ["cho và nhận, hào phóng", "nợ nần, cho đi có điều kiện"],
    ["kiên nhẫn chờ thu hoạch", "nóng vội, đầu tư sai"], ["chăm chỉ, rèn kỹ năng", "làm cho có, cầu toàn"], ["tự chủ, sung túc", "phụ thuộc, tiêu xài quá tay"],
    ["gia sản, ổn định lâu dài", "tranh chấp tài sản, bất ổn"], ["ham học, cơ hội học tập", "lười biếng, thiếu kế hoạch"], ["cần mẫn, đáng tin", "trì trệ, nhàm chán"],
    ["chu đáo, thực tế, vun vén", "lo toan quá mức, mất cân bằng"], ["thành đạt, giàu có, vững vàng", "tham lam, cứng nhắc"],
  ],
};

export const DECK = [
  ...MAJOR.map((m) => ({ id: "m" + m.n, major: true, ...m, name: `${m.zh} · ${m.vi}` })),
  ...Object.entries(SUITS).flatMap(([s, S]) => RANKS.map(([rz, rv, re], i) => {
    const [u, r] = MINOR_KW[s][i];
    return { id: s + i, suit: s, rank: i, zh: S.zh + rz, vi: `${rv} ${S.vi}`, en: `${re} of ${s[0].toUpperCase() + s.slice(1)}`, kw: u.split(", "), rk: r.split(", "),
      up: `${u[0].toUpperCase() + u.slice(1)}. Bộ ${S.vi} (${S.zh}, ${S.el}) nói về ${S.area}.`, rev: `${r[0].toUpperCase() + r.slice(1)}.`, name: `${S.zh}${rz} · ${rv} ${S.vi}` };
  })),
];

export const SPREADS = [
  { id: "one", zh: "单张牌", vi: "Một lá", note: "Thông điệp cho hôm nay hoặc câu hỏi nhanh", pos: [["指引", "Thông điệp"]] },
  { id: "three", zh: "时间之流", vi: "Quá khứ – Hiện tại – Tương lai", note: "Trải bài 3 lá phổ biến nhất", pos: [["过去", "Quá khứ"], ["现在", "Hiện tại"], ["未来", "Tương lai"]] },
  { id: "advice", zh: "问题解决", vi: "Tình huống – Trở ngại – Lời khuyên", note: "Khi cần hướng giải quyết một việc", pos: [["现状", "Tình huống"], ["阻碍", "Trở ngại"], ["建议", "Lời khuyên"]] },
  { id: "love", zh: "爱情牌阵", vi: "Tình cảm", note: "Hai người và mối quan hệ", pos: [["你", "Bạn"], ["对方", "Người ấy"], ["关系现状", "Mối quan hệ hiện tại"], ["阻碍", "Trở ngại"], ["发展", "Hướng phát triển"]] },
  { id: "celtic", zh: "凯尔特十字", vi: "Thập tự Celtic", note: "Trải bài 10 lá, xem toàn cảnh một vấn đề lớn", pos: [["现状", "Hiện tại"], ["挑战", "Thử thách"], ["根源", "Gốc rễ"], ["过去", "Quá khứ gần"], ["目标", "Mục tiêu / điều tốt nhất có thể"], ["近未来", "Tương lai gần"], ["自我", "Bản thân"], ["环境", "Môi trường xung quanh"], ["希望与恐惧", "Hy vọng và lo sợ"], ["结果", "Kết quả"]] },
];

export const TOPICS = [["综合", "Tổng quát"], ["爱情", "Tình cảm"], ["事业", "Công việc"], ["财运", "Tài chính"], ["学业", "Học tập"], ["健康", "Sức khoẻ"]];

// từ vựng tiếng Trung về Tarot
export const TAROT_VOCAB = [
  ["塔罗牌", "bài Tarot"], ["占卜", "bói, xem quẻ"], ["抽牌", "rút bài"], ["洗牌", "xáo bài"], ["牌阵", "trải bài (cách bày lá)"], ["正位", "lá xuôi"], ["逆位", "lá ngược"],
  ["大阿尔卡那", "bộ Ẩn chính (22 lá)"], ["小阿尔卡那", "bộ Ẩn phụ (56 lá)"], ["宫廷牌", "lá hoàng gia (Tiểu đồng, Hiệp sĩ, Nữ hoàng, Vua)"], ["权杖", "Gậy"], ["圣杯", "Cốc"], ["宝剑", "Kiếm"], ["星币", "Tiền"],
  ["解牌", "giải bài"], ["运势", "vận thế"], ["直觉", "trực giác"], ["指引", "chỉ dẫn"],
];
