// Tử vi đẩu số 紫微斗数 — từ điển sao & cung để luận giải cơ bản (tham khảo văn hoá)
// Khoá theo tên tiếng Trung giản thể của thư viện iztro.

export const PALACE = {
  命宫: { vi: "Mệnh", y: "Bản thân: tính cách, tài năng, khí chất và hướng đi chung của cả đời. Là cung quan trọng nhất, luận cùng Tài Bạch – Quan Lộc – Thiên Di (tam phương tứ chính)." },
  兄弟: { vi: "Huynh Đệ", y: "Anh chị em, bạn thân, đồng nghiệp ngang hàng; cũng xem khả năng hợp tác và dòng tiền mặt nhỏ." },
  夫妻: { vi: "Phu Thê", y: "Tình duyên, hôn nhân, kiểu người dễ thu hút và cách mình đối xử trong quan hệ lứa đôi." },
  子女: { vi: "Tử Tức", y: "Con cái, học trò, người dưới; cũng nói về khả năng sáng tạo và đời sống tình cảm riêng tư." },
  财帛: { vi: "Tài Bạch", y: "Tiền bạc: cách kiếm tiền, thái độ với tiền, khả năng giữ của." },
  疾厄: { vi: "Tật Ách", y: "Thể chất, những điểm yếu sức khoẻ cần giữ gìn, và trạng thái tâm lý dưới áp lực." },
  迁移: { vi: "Thiên Di", y: "Ra ngoài xã hội, đi xa, môi trường bên ngoài; cách người khác nhìn mình." },
  仆役: { vi: "Nô Bộc", y: "Bạn bè, cấp dưới, khách hàng, các mối quan hệ xã giao." },
  交友: { vi: "Giao Hữu", y: "Bạn bè, cấp dưới, khách hàng, các mối quan hệ xã giao." },
  官禄: { vi: "Quan Lộc", y: "Sự nghiệp, học hành, cách làm việc và lĩnh vực hợp với mình." },
  田宅: { vi: "Điền Trạch", y: "Nhà cửa, bất động sản, môi trường sống và gia đình gốc." },
  福德: { vi: "Phúc Đức", y: "Đời sống tinh thần, sở thích, khả năng hưởng thụ và phúc phần tổ tiên." },
  父母: { vi: "Phụ Mẫu", y: "Cha mẹ, bề trên, thầy cô, cấp trên; cũng xem giấy tờ, học vấn ban đầu." },
};

// 14 chính tinh: hv, hành, hoá khí, nét chính, điểm mạnh, cần lưu ý
export const MAJOR = {
  紫微: { hv: "Tử Vi", wx: "Âm Thổ", hq: "化气为尊 · Đế tinh", t: "Đứng đầu các sao, tượng ông vua: tôn quý, có khí chất lãnh đạo, coi trọng thể diện.", g: "Có uy, biết tổ chức, được người tin cậy giao việc lớn.", b: "Dễ cô độc trên cao, tự ái, thích được nể; cần Tả Phù Hữu Bật, Thiên Khôi Thiên Việt phò tá mới phát huy hết." },
  天机: { hv: "Thiên Cơ", wx: "Âm Mộc", hq: "化气为善 · Mưu thần", t: "Sao trí tuệ, mưu lược, động não liên tục, giỏi lên kế hoạch.", g: "Nhanh nhạy, học giỏi, hợp nghề tham mưu, kỹ thuật, nghiên cứu, giáo dục.", b: "Hay lo nghĩ, dễ thay đổi ý định, thần kinh căng thẳng." },
  太阳: { hv: "Thái Dương", wx: "Dương Hoả", hq: "化气为贵 · Quan lộc chủ", t: "Mặt trời: quang minh, nhiệt tình, hào phóng, thích chiếu sáng cho người khác.", g: "Có danh, hợp công việc công cộng, quản lý, truyền thông; quý ở cung sáng (Dần – Ngọ).", b: "Vất vả vì người, cho đi nhiều mà ít giữ; ở cung tối (Thân – Tý) dễ lao lực, thiếu được ghi nhận." },
  武曲: { hv: "Vũ Khúc", wx: "Âm Kim", hq: "化气为财 · Tài tinh", t: "Sao tài chính: cương quyết, thực tế, hành động nhanh.", g: "Giỏi quản lý tiền, kinh doanh, tài chính, kỹ thuật, quân cảnh.", b: "Cứng nhắc, ít mềm mỏng trong tình cảm, dễ cô đơn." },
  天同: { hv: "Thiên Đồng", wx: "Dương Thuỷ", hq: "化气为福 · Phúc tinh", t: "Phúc tinh: hiền hoà, lạc quan, dễ thích nghi, biết hưởng thụ.", g: "Được lòng người, tâm thái tốt, hợp ngành dịch vụ, nghệ thuật, chăm sóc.", b: "Thiếu chí tiến thủ, dễ an phận hoặc trì hoãn; cần áp lực vừa phải mới bật lên." },
  廉贞: { hv: "Liêm Trinh", wx: "Âm Hoả", hq: "化气为囚 · Thứ đào hoa", t: "Vừa nguyên tắc vừa đa tình, mạnh mẽ, có cá tính.", g: "Quyết đoán, giỏi xử lý việc khó, hợp chính trị, pháp luật, kỹ thuật, nghệ thuật.", b: "Nóng nảy, dễ vướng thị phi, cần giữ chừng mực trong tình cảm và giấy tờ." },
  天府: { hv: "Thiên Phủ", wx: "Dương Thổ", hq: "化气为令 · Kho tàng", t: "Kho lẫm: vững vàng, bao dung, giỏi giữ và quản lý.", g: "Ổn định, đáng tin, hợp hành chính, tài chính, quản trị.", b: "Bảo thủ, thích an toàn, đôi khi thiếu đột phá." },
  太阴: { hv: "Thái Âm", wx: "Âm Thuỷ", hq: "化气为富 · Điền trạch chủ", t: "Mặt trăng: dịu dàng, tinh tế, giàu cảm xúc, thiên về tích luỹ.", g: "Có duyên với nhà đất, tích luỹ tài sản, nghệ thuật; quý ở cung sáng (Dậu – Sửu).", b: "Đa sầu đa cảm, hay giữ trong lòng; ở cung tối dễ lo âu." },
  贪狼: { hv: "Tham Lang", wx: "Dương Thuỷ (Mộc)", hq: "化气为桃花 · Chính đào hoa", t: "Đa tài đa nghệ, giỏi giao tế, nhiều ham muốn và hứng thú.", g: "Linh hoạt, hợp kinh doanh, ngoại giao, giải trí, ẩm thực, huyền học.", b: "Dễ tham nhiều mà không chuyên, cần tiết chế hưởng thụ." },
  巨门: { hv: "Cự Môn", wx: "Âm Thuỷ", hq: "化气为暗 · Ám tinh", t: "Sao lời nói: phân tích sắc bén, hoài nghi, thích tìm đến tận cùng.", g: "Hợp nghề dùng miệng: giáo viên, luật sư, MC, tư vấn, nghiên cứu.", b: "Dễ thị phi khẩu thiệt, hay nghi ngờ; nói ít mà chắc sẽ tốt hơn." },
  天相: { hv: "Thiên Tướng", wx: "Dương Thuỷ", hq: "化气为印 · Ấn tinh", t: "Sao ấn: công bằng, chu đáo, trọng nghĩa, phụ tá xuất sắc.", g: "Biết phục vụ, hoà giải, hợp hành chính, nhân sự, ngoại giao.", b: "Dễ bị người khác ảnh hưởng, ngại va chạm." },
  天梁: { hv: "Thiên Lương", wx: "Dương Thổ", hq: "化气为荫 · Ấm tinh", t: "Bậc trưởng lão: che chở, nguyên tắc, có khả năng giải nguy.", g: "Hợp y, giáo dục, pháp luật, bảo hiểm, công tác xã hội; gặp nạn hay có người giúp.", b: "Thích dạy bảo, đôi khi cô độc hoặc cố chấp." },
  七杀: { hv: "Thất Sát", wx: "Âm Kim (Hoả)", hq: "化气为将 · Tướng tinh", t: "Đại tướng ra trận: dũng cảm, dám nghĩ dám làm, thích tự lập.", g: "Mạnh về khai phá, khởi nghiệp, quân sự, thể thao, kỹ thuật.", b: "Nóng vội, cuộc đời nhiều thăng trầm; cần kiên nhẫn và kế hoạch dài hạn." },
  破军: { hv: "Phá Quân", wx: "Âm Thuỷ", hq: "化气为耗 · Hao tinh", t: "Tiên phong phá cũ lập mới, không chịu khuôn khổ.", g: "Sáng tạo, cải cách, hợp ngành đổi mới, kinh doanh mạo hiểm.", b: "Dễ hao tán, thay đổi nhiều; nên giữ một khoản dự phòng." },
};

// Phụ tinh thường gặp
export const MINOR = {
  左辅: ["Tả Phù", "cát", "Quý nhân phò trợ, được người giúp sức, giỏi hợp tác."],
  右弼: ["Hữu Bật", "cát", "Quý nhân phò trợ, khéo léo, được bạn bè hỗ trợ."],
  文昌: ["Văn Xương", "cát", "Học vấn, thi cử, văn chương, giấy tờ thuận."],
  文曲: ["Văn Khúc", "cát", "Tài ăn nói, năng khiếu nghệ thuật, học ngoại ngữ."],
  天魁: ["Thiên Khôi", "cát", "Quý nhân nam / bề trên giúp đỡ, có cơ hội thăng tiến."],
  天钺: ["Thiên Việt", "cát", "Quý nhân nữ / âm thầm giúp đỡ, có duyên thi cử."],
  禄存: ["Lộc Tồn", "cát", "Lộc tích luỹ, giữ của tốt, tính cẩn thận."],
  天马: ["Thiên Mã", "trung", "Di chuyển, thay đổi, đi xa; gặp Lộc là 'Lộc Mã giao trì' — càng đi càng có tiền."],
  擎羊: ["Kình Dương", "sát", "Mũi dao: quyết liệt, cạnh tranh; dễ va chạm, cần cẩn thận vật sắc."],
  陀罗: ["Đà La", "sát", "Trì trệ, dây dưa, việc hay kéo dài; cần kiên nhẫn."],
  火星: ["Hoả Tinh", "sát", "Nóng nảy, bộc phát; cũng mang lại bứt phá nhanh."],
  铃星: ["Linh Tinh", "sát", "Nóng âm ỉ, lo lắng ngầm; dễ bực bội trong lòng."],
  地空: ["Địa Không", "sát", "Ý tưởng khác người, dễ hao hụt vật chất; hợp tư duy sáng tạo, tôn giáo, triết học."],
  地劫: ["Địa Kiếp", "sát", "Biến động bất ngờ về tiền bạc; nên tránh đầu cơ."],
  红鸾: ["Hồng Loan", "đào", "Duyên tình, hỷ sự, cưới hỏi."],
  天喜: ["Thiên Hỷ", "đào", "Tin vui, hỷ sự, con cái."],
  天姚: ["Thiên Diêu", "đào", "Đào hoa, duyên dáng, nghệ thuật; cần giữ chừng mực."],
  咸池: ["Hàm Trì", "đào", "Đào hoa, giao du, thích hưởng thụ."],
  天刑: ["Thiên Hình", "sát", "Kỷ luật, pháp luật, y khoa; cẩn thận kiện tụng, phẫu thuật."],
  华盖: ["Hoa Cái", "trung", "Tài hoa, thích tôn giáo, triết học, nghệ thuật; hơi cô độc."],
  天哭: ["Thiên Khốc", "sát", "Buồn phiền, lo âu nhẹ."],
  天虚: ["Thiên Hư", "sát", "Trống trải, việc dễ hư danh."],
  孤辰: ["Cô Thần", "sát", "Thích độc lập, tình cảm hơi lạnh."],
  寡宿: ["Quả Tú", "sát", "Ưa yên tĩnh, ít bạn tri kỷ."],
  解神: ["Giải Thần", "cát", "Hoá giải tai ách, gặp khó có lối thoát."],
  年解: ["Niên Giải", "cát", "Giải trừ rắc rối trong năm."],
  天德: ["Thiên Đức", "cát", "Phúc đức, gặp dữ hoá lành."],
  月德: ["Nguyệt Đức", "cát", "Phúc đức, tâm thiện, được che chở."],
  恩光: ["Ân Quang", "cát", "Được ân huệ, khen thưởng."],
  天贵: ["Thiên Quý", "cát", "Được quý trọng, có danh dự."],
  三台: ["Tam Thai", "cát", "Địa vị, thăng tiến từng bậc."],
  八座: ["Bát Toạ", "cát", "Địa vị, chỗ ngồi vững."],
  龙池: ["Long Trì", "cát", "Tài nghệ, khéo tay, văn chương."],
  凤阁: ["Phượng Các", "cát", "Danh tiếng, thẩm mỹ, nghệ thuật."],
  天官: ["Thiên Quan", "cát", "Quan lộc, được cất nhắc."],
  天福: ["Thiên Phúc", "cát", "Phúc lộc, hưởng thụ."],
  天巫: ["Thiên Vu", "trung", "Duyên với tôn giáo, thừa kế."],
  天月: ["Thiên Nguyệt", "sát", "Sức khoẻ nhỏ, bệnh vặt."],
  阴煞: ["Âm Sát", "sát", "Tiểu nhân ngầm, việc khuất tất."],
  破碎: ["Phá Toái", "sát", "Hao tổn lặt vặt, đồ vật dễ hỏng."],
  蜚廉: ["Phi Liêm", "sát", "Thị phi, lời đồn."],
  天伤: ["Thiên Thương", "sát", "Hao tổn, buồn phiền (ở Nô Bộc)."],
  天使: ["Thiên Sứ", "sát", "Trắc trở, lo lắng (ở Tật Ách)."],
  旬空: ["Tuần Không", "trung", "Làm giảm lực sao trong cung: sao xấu bớt xấu, sao tốt bớt tốt."],
  截路: ["Triệt Lộ", "trung", "Chặn đường: việc dễ đứt quãng, nhất là nửa đầu đời."],
  空亡: ["Không Vong", "trung", "Hư không, việc dễ hụt."],
  天空: ["Thiên Không", "sát", "Ý tưởng cao xa, dễ hụt kế hoạch."],
  天厨: ["Thiên Trù", "cát", "Lộc ăn uống, nấu nướng."],
  天才: ["Thiên Tài", "cát", "Năng khiếu, thông minh."],
  天寿: ["Thiên Thọ", "cát", "Sống thọ, điềm tĩnh."],
  封诰: ["Phong Cáo", "cát", "Danh dự, bằng khen."],
  台辅: ["Thai Phụ", "cát", "Địa vị, chức vụ."],
};

export const MUTAGEN = {
  禄: ["Hoá Lộc", "#3F9A5C", "Thuận lợi, tài lộc, duyên — sao được 'bôi trơn'."],
  权: ["Hoá Quyền", "#C9832E", "Quyền lực, chủ động, nắm quyền quyết định."],
  科: ["Hoá Khoa", "#3A78B5", "Danh tiếng, học vấn, quý nhân, giải nguy nhẹ nhàng."],
  忌: ["Hoá Kỵ", "#C2413B", "Trở ngại, chấp niệm, nơi cần chú ý và học bài học."],
};

export const BRIGHT = { 庙: "Miếu", 旺: "Vượng", 得: "Đắc", 利: "Lợi", 平: "Bình", 不: "Bất", 陷: "Hãm" };
export const BRIGHT_NOTE = { 庙: "rất mạnh", 旺: "mạnh", 得: "khá", 利: "khá", 平: "trung bình", 不: "yếu", 陷: "hãm — sao yếu, nét xấu dễ lộ" };

export const CLASS = {
  水二局: "Thuỷ nhị cục — thông minh, linh hoạt; đại vận khởi từ 2 tuổi.",
  木三局: "Mộc tam cục — hướng thiện, phát triển từ từ; đại vận khởi từ 3 tuổi.",
  金四局: "Kim tứ cục — cương nghị, quyết đoán; đại vận khởi từ 4 tuổi.",
  土五局: "Thổ ngũ cục — trầm ổn, đáng tin; đại vận khởi từ 5 tuổi.",
  火六局: "Hoả lục cục — nhiệt tình, bộc trực; đại vận khởi từ 6 tuổi.",
};

// ---------- Sao an theo trường phái Tử vi Việt Nam (iztro không có / an khác) ----------
const ZHI = "子丑寅卯辰巳午未申酉戌亥", GAN = "甲乙丙丁戊己庚辛壬癸";
const at = (i) => ZHI[((i % 12) + 12) % 12];
// Tuần Trung Không Vong: hai chi trống của tuần giáp chứa năm sinh
export function tuanPair(yg, yz) { const s = (ZHI.indexOf(yz) - GAN.indexOf(yg) + 12) % 12; return [at(s - 2), at(s - 1)]; }
// Triệt Lộ Không Vong theo can năm: Giáp Kỷ Thân Dậu, Ất Canh Ngọ Mùi, Bính Tân Thìn Tỵ, Đinh Nhâm Dần Mão, Mậu Quý Tý Sửu
export function trietPair(yg) { return [["申", "酉"], ["午", "未"], ["辰", "巳"], ["寅", "卯"], ["子", "丑"]][GAN.indexOf(yg) % 5]; }
export const TUAN_TRIET = {
  Tuần: ["旬空", "Tuần Trung Không Vong: án ngữ hai cung, làm sao trong cung giảm lực — sao xấu bớt xấu, sao tốt bớt tốt; ảnh hưởng mạnh nửa sau cuộc đời (sau 30 tuổi)."],
  Triệt: ["截空", "Triệt Lộ Không Vong: chặn ngang hai cung, như dao cắt — việc dễ đứt quãng, phải làm lại; ảnh hưởng mạnh nửa đầu cuộc đời (trước 30 tuổi), về sau nhẹ dần."],
};
// Vòng Thái Tuế (an theo chi năm sinh, đi thuận)
export const THAI_TUE = [["Thái Tuế", "太岁"], ["Thiếu Dương", "少阳"], ["Tang Môn", "丧门"], ["Thiếu Âm", "少阴"], ["Quan Phù", "官符"], ["Tử Phù", "死符"], ["Tuế Phá", "岁破"], ["Long Đức", "龙德"], ["Bạch Hổ", "白虎"], ["Phúc Đức", "福德"], ["Điếu Khách", "吊客"], ["Trực Phù", "直符"]];
// Vòng Lộc Tồn (Bác sĩ) — iztro trả về boshi12, chỉ đổi tên cho đúng cách gọi Việt
export const BAC_SI = { 博士: "Bác Sĩ", 力士: "Lực Sĩ", 青龙: "Thanh Long", 小耗: "Tiểu Hao", 将军: "Tướng Quân", 奏书: "Tấu Thư", 飞廉: "Phi Liêm", 喜神: "Hỷ Thần", 病符: "Bệnh Phù", 大耗: "Đại Hao", 伏兵: "Phục Binh", 官府: "Quan Phủ" };
// Các sao lẻ khác của trường phái Việt
export function vnStars({ yg, yz, lm, hour, locTon, male, yao, fengge }) {
  const out = {}; const add = (z, vi, zh, k) => (out[z] = out[z] || []).push({ vi, zh, k });
  const yi = ZHI.indexOf(yz);
  THAI_TUE.forEach(([vi, zh], i) => add(at(yi + i), vi, zh, ["Thái Tuế", "Long Đức", "Phúc Đức"].includes(vi) ? "cát" : ["Tang Môn", "Bạch Hổ", "Điếu Khách", "Quan Phù", "Tuế Phá"].includes(vi) ? "sát" : "trung"));
  add("辰", "Thiên La", "天罗", "sát"); add("戌", "Địa Võng", "地网", "sát");
  add("酉戌未申巳午卯辰亥寅"[GAN.indexOf(yg)], "Lưu Hà", "流霞", "sát");
  if (locTon) { const l = ZHI.indexOf(locTon); add(at(l + 8), "Quốc Ấn", "国印", "cát"); add(at(l - 7), "Đường Phù", "唐符", "cát"); }
  if (lm) { add(at(yi - (lm - 1) + (hour % 12)), "Đẩu Quân", "斗君", "trung"); add(at(8 + lm - 1), "Thiên Giải", "天解", "cát"); add(at(7 + lm - 1), "Địa Giải", "地解", "cát"); }
  const g3 = (m) => m[Math.floor(["申子辰", "寅午戌", "巳酉丑", "亥卯未"].findIndex((x) => x.includes(yz)))];
  add(g3("巳亥寅申"), "Kiếp Sát", "劫煞", "sát");
  add(at(9 + yi), "Thiên Đức", "天德", "cát"); add(at(5 + yi), "Nguyệt Đức", "月德", "cát");
  add("巳午申酉申酉亥子寅卯"[GAN.indexOf(yg)], "Văn Tinh", "文星", "cát");
  if (yao) add(yao, "Thiên Y", "天医", "cát");
  if (fengge) add(fengge, "Giải Thần", "解神", "cát");
  return out;
}

// Khôi – Việt, Hoả – Linh an theo sách Việt (khác bản Trung Quốc ở can Canh và ở chiều Hoả/Linh theo âm dương nam nữ)
export function vnMinor({ yg, yz, hour, male }) {
  const gi = GAN.indexOf(yg), yi = ZHI.indexOf(yz), h = hour % 12;
  const kv = [["丑", "未"], ["子", "申"], ["亥", "酉"], ["亥", "酉"], ["丑", "未"], ["子", "申"], ["午", "寅"], ["午", "寅"], ["卯", "巳"], ["卯", "巳"]][gi];
  const grp = ["申子辰", "寅午戌", "巳酉丑", "亥卯未"].findIndex((x) => x.includes(yz));
  const [hs, ls] = [["寅", "戌"], ["丑", "卯"], ["卯", "戌"], ["酉", "戌"]][grp];
  const thuan = (male && gi % 2 === 0) || (!male && gi % 2 === 1);            // Dương nam / Âm nữ
  const hoa = at(ZHI.indexOf(hs) + (thuan ? h : -h)), linh = at(ZHI.indexOf(ls) + (thuan ? -h : h));
  return { 天魁: kv[0], 天钺: kv[1], 火星: hoa, 铃星: linh, _yi: yi };
}

// Độ sáng theo bảng Việt (M miếu, V vượng, Đ đắc, B bình hoà, H hãm) — thứ tự Tý → Hợi
const VBR = {
  紫微: "BĐMBVMMĐMBVB", 廉贞: "VĐVHMHVĐVHMH", 天同: "VHMĐHĐHHMHHĐ", 武曲: "VMVĐMHVMVĐMH", 太阳: "HĐVVVMMĐHHHH", 天机: "ĐĐHMMVĐĐVMMH", 天府: "MBMBVĐMĐMBVĐ",
  太阴: "VĐHHHHHĐVMMM", 贪狼: "HMĐHVHHMĐHVH", 巨门: "VHVMHHVHĐMHĐ", 天相: "VĐMHVĐVĐMHVĐ", 天梁: "VĐVVMHMĐVHMH", 七杀: "MĐMHHVMĐMHHV", 破军: "MVHHĐHMVHHĐH",
  擎羊: "HĐ·HĐ·HĐ·HĐ·", 陀罗: "·ĐHHĐH·ĐHHĐH", 火星: "HHĐĐĐĐĐ·HHHH", 铃星: "HHĐĐĐĐĐ·HHHH", 地空: "HHĐHHĐHHĐHHĐ", 地劫: "HHĐHHĐHHĐHHĐ",
  文昌: "·Đ···Đ···Đ··", 文曲: "·Đ···Đ···Đ··", 天马: "··Đ·····Đ···", 天刑: "HHĐĐHHHHĐĐHH", 丧门: "HHĐĐHHHHĐĐHH", 天虚: "ĐH·ĐH·ĐH·ĐH·", 天哭: "ĐH·ĐH·ĐH·ĐH·", 天姚: "··ĐĐ·····ĐĐ·",
};
export const vnBright = (zh, zhi) => { const c = VBR[zh]?.[ZHI.indexOf(zhi)]; return c && c !== "·" ? c : ""; };

// Sao lưu niên của năm xem
export function luuStars(year) {
  const gi = (year - 4) % 10, zi = (year - 4) % 12, out = {}; const add = (z, vi, zh) => (out[z] = out[z] || []).push({ vi: "L." + vi, zh: "流" + zh, luu: 1 });
  const loc = ZHI.indexOf("寅卯巳午巳午申酉亥子"[gi]);
  add(at(zi), "Thái Tuế", "太岁"); add(at(zi + 2), "Tang Môn", "丧门"); add(at(zi + 8), "Bạch Hổ", "白虎");
  add(at(6 - zi), "Thiên Khốc", "天哭"); add(at(6 + zi), "Thiên Hư", "天虚");
  add(at(loc), "Lộc Tồn", "禄存"); add(at(loc + 1), "Kình Dương", "擎羊"); add(at(loc - 1), "Đà La", "陀罗");
  add("寅申亥巳"[["申子辰", "寅午戌", "巳酉丑", "亥卯未"].findIndex((x) => x.includes(ZHI[zi]))], "Thiên Mã", "天马");
  return { out, gz: GAN[gi] + ZHI[zi] };
}

// Tiểu hạn: năm sinh khởi ở Thìn (Dần Ngọ Tuất) / Tuất (Thân Tý Thìn) / Mùi (Tỵ Dậu Sửu) / Sửu (Hợi Mão Mùi); nam thuận, nữ nghịch
export function tieuHan(yz, male) {
  const st = ZHI.indexOf("戌辰未丑"[["申子辰", "寅午戌", "巳酉丑", "亥卯未"].findIndex((x) => x.includes(yz))]); const yi = ZHI.indexOf(yz);
  const map = {}; for (let k = 0; k < 12; k++) map[at(st + (male ? k : -k))] = at(yi + k); return map; // cung → chi năm tiểu hạn
}
// Nguyệt hạn: từ cung tiểu hạn năm xem đếm nghịch đến tháng sinh, rồi thuận đến giờ sinh = tháng Giêng; các tháng sau đi thuận
export function nguyetHan(thPalace, lm, hour) { const s = ZHI.indexOf(thPalace) - (lm - 1) + (hour % 12); const m = {}; for (let k = 0; k < 12; k++) m[at(s + k)] = k + 1; return m; }

const NAYIN = "海中金 炉中火 大林木 路旁土 剑锋金 山头火 涧下水 城头土 白蜡金 杨柳木 泉中水 屋上土 霹雳火 松柏木 长流水 沙中金 山下火 平地木 壁上土 金箔金 覆灯火 天河水 大驿土 钗钏金 桑柘木 大溪水 沙中土 天上火 石榴木 大海水".split(" ");
const jiazi = (g, z) => { for (let i = 0; i < 60; i++) if (i % 10 === GAN.indexOf(g) && i % 12 === ZHI.indexOf(z)) return i; return 0; };
export const napAm = (g, z) => NAYIN[Math.floor(jiazi(g, z) / 2)];
export const NAYIN_NOTE = { 海中金: ["Hải Trung Kim", "Vàng trong biển"], 炉中火: ["Lư Trung Hoả", "Lửa trong lò"], 大林木: ["Đại Lâm Mộc", "Gỗ rừng già"], 路旁土: ["Lộ Bàng Thổ", "Đất ven đường"], 剑锋金: ["Kiếm Phong Kim", "Vàng mũi kiếm"], 山头火: ["Sơn Đầu Hoả", "Lửa trên núi"], 涧下水: ["Giản Hạ Thuỷ", "Nước dưới khe"], 城头土: ["Thành Đầu Thổ", "Đất trên thành"], 白蜡金: ["Bạch Lạp Kim", "Vàng trong nến trắng"], 杨柳木: ["Dương Liễu Mộc", "Gỗ cây dương liễu"], 泉中水: ["Tuyền Trung Thuỷ", "Nước giữa dòng suối"], 屋上土: ["Ốc Thượng Thổ", "Đất trên nóc nhà"], 霹雳火: ["Tích Lịch Hoả", "Lửa sấm sét"], 松柏木: ["Tùng Bách Mộc", "Gỗ tùng bách"], 长流水: ["Trường Lưu Thuỷ", "Dòng nước lớn"], 沙中金: ["Sa Trung Kim", "Vàng trong cát"], 山下火: ["Sơn Hạ Hoả", "Lửa dưới chân núi"], 平地木: ["Bình Địa Mộc", "Cây ở đồng bằng"], 壁上土: ["Bích Thượng Thổ", "Đất trên vách"], 金箔金: ["Kim Bạch Kim", "Vàng pha bạch kim"], 覆灯火: ["Phúc Đăng Hoả", "Lửa ngọn đèn"], 天河水: ["Thiên Hà Thuỷ", "Nước trên trời"], 大驿土: ["Đại Dịch Thổ", "Đất cát lớn"], 钗钏金: ["Thoa Xuyến Kim", "Vàng trang sức"], 桑柘木: ["Tang Đố Mộc", "Gỗ cây dâu"], 大溪水: ["Đại Khê Thuỷ", "Nước dưới khe lớn"], 沙中土: ["Sa Trung Thổ", "Đất lẫn trong cát"], 天上火: ["Thiên Thượng Hoả", "Lửa trên trời"], 石榴木: ["Thạch Lựu Mộc", "Gỗ cây thạch lựu"], 大海水: ["Đại Hải Thuỷ", "Nước đại dương"] };
// Cân lượng (xưng cốt — bảng Viên Thiên Cương), đơn vị chỉ (1 lượng = 10 chỉ)
const CL_Y = [12, 9, 6, 7, 12, 5, 9, 8, 7, 8, 15, 9, 16, 8, 8, 19, 12, 6, 8, 7, 5, 15, 6, 16, 15, 7, 9, 12, 10, 7, 15, 6, 5, 14, 14, 9, 7, 7, 9, 12, 8, 7, 13, 5, 14, 5, 9, 17, 5, 7, 12, 8, 8, 6, 19, 6, 8, 16, 10, 6];
const CL_M = [6, 7, 18, 9, 5, 16, 9, 15, 18, 8, 9, 5];
const CL_D = [5, 10, 8, 15, 16, 15, 8, 16, 8, 16, 9, 17, 8, 17, 10, 8, 9, 18, 5, 15, 10, 9, 8, 9, 15, 18, 7, 8, 16, 6];
const CL_H = [16, 6, 7, 10, 9, 16, 10, 8, 8, 9, 6, 6];
export function canLuong(yg, yz, lm, ld, hour) { const t = CL_Y[jiazi(yg, yz)] + CL_M[Math.abs(lm) - 1] + CL_D[ld - 1] + CL_H[hour % 12]; return `${Math.floor(t / 10)} lượng ${t % 10} chỉ`; }
// Mệnh chủ theo chi năm sinh (sách Việt); Thân chủ theo chi năm sinh
export const menhChuVN = (yz) => ({ 子: "Tham Lang", 丑: "Cự Môn", 亥: "Cự Môn", 寅: "Lộc Tồn", 戌: "Lộc Tồn", 卯: "Văn Khúc", 酉: "Văn Khúc", 辰: "Liêm Trinh", 申: "Liêm Trinh", 巳: "Vũ Khúc", 未: "Vũ Khúc", 午: "Phá Quân" })[yz];
export const thanChuVN = (yz) => ({ 子: "Linh Tinh", 午: "Linh Tinh", 丑: "Thiên Tướng", 未: "Thiên Tướng", 寅: "Thiên Lương", 申: "Thiên Lương", 卯: "Thiên Đồng", 酉: "Thiên Đồng", 辰: "Văn Xương", 戌: "Văn Xương", 巳: "Thiên Cơ", 亥: "Thiên Cơ" })[yz];
export const ZHI_YANG = (z) => ZHI.indexOf(z) % 2 === 0;
export const WX_REL = (a, b) => { const G = { 木: "火", 火: "土", 土: "金", 金: "水", 水: "木" }, K = { 木: "土", 土: "水", 水: "火", 火: "金", 金: "木" }; return a === b ? "bình hoà" : G[a] === b ? "sinh" : G[b] === a ? "được sinh bởi" : K[a] === b ? "khắc" : "bị khắc bởi"; };
Object.assign(MINOR, {
  天罗: ["Thiên La", "sát", "Lưới trời: gò bó, dễ vướng thị phi, kiện tụng."], 地网: ["Địa Võng", "sát", "Lưới đất: bị trói buộc, việc khó thoát ra."],
  流霞: ["Lưu Hà", "sát", "Chủ rủi ro về máu huyết, sông nước; nên cẩn thận khi đi lại."], 国印: ["Quốc Ấn", "cát", "Ấn của nhà nước: chủ chức quyền, được giao trọng trách."],
  唐符: ["Đường Phù", "cát", "Chủ danh giá, chức vị, nhà cửa khang trang."], 斗君: ["Đẩu Quân", "trung", "Nguyệt tướng: dùng xem vận từng tháng trong năm (tháng Giêng khởi tại cung này)."],
  天解: ["Thiên Giải", "cát", "Giải trừ tai ách, gặp nạn có người giúp."], 地解: ["Địa Giải", "cát", "Giải trừ tai ách, hoá giải hung tinh."],
  太岁: ["Thái Tuế", "trung", "Đứng đầu vòng Thái Tuế: chủ lời nói, lý lẽ, dễ tranh cãi nhưng có uy."], 少阳: ["Thiếu Dương", "cát", "Thông minh, vui vẻ, gặp may nhỏ."],
  丧门: ["Tang Môn", "sát", "Chủ buồn phiền, tang chế, hao tổn tinh thần."], 少阴: ["Thiếu Âm", "cát", "Hiền hoà, kín đáo, được giúp ngầm."],
  官符: ["Quan Phù", "sát", "Chủ giấy tờ, kiện tụng, va chạm pháp lý."], 死符: ["Tử Phù", "sát", "Chủ buồn rầu, ốm đau nhẹ."], 岁破: ["Tuế Phá", "sát", "Phá hao, việc dễ đổ vỡ, tính ngang."],
  劫煞: ["Kiếp Sát", "sát", "Chủ tai hoạ bất ngờ, mất mát; nên cẩn trọng khi đi lại, giao dịch."], 文星: ["Văn Tinh", "cát", "Sao văn chương: thuận lợi học hành, thi cử, viết lách."], 天医: ["Thiên Y", "cát", "Sao thầy thuốc: chủ chữa bệnh, giải bệnh, hợp nghề y dược."],
  龙德: ["Long Đức", "cát", "Phúc tinh, giải hung, gặp quý nhân."], 白虎: ["Bạch Hổ", "sát", "Hung tinh: tai nạn, tranh đấu; cũng chủ uy quyền, quyết đoán."],
  福德: ["Phúc Đức", "cát", "Phúc tinh, hưởng phúc, giải hung."], 吊客: ["Điếu Khách", "sát", "Chủ tang thương, buồn bã, việc thăm viếng."], 直符: ["Trực Phù", "sát", "Chủ ngăn trở, thị phi nhỏ."],
});
