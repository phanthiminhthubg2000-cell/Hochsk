"use client";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase"; 
import { doc, setDoc, increment } from "firebase/firestore";

// --- NGÂN HÀNG 60 TÌNH HUỐNG (10 Tình huống / 1 Level) ---
const SCENARIOS = [
  // ================= HSK 1 =================
  { id: "h1_1", level: "HSK 1", icon: "☕", title: "Gọi cà phê", xp: 30, userRole: "Khách", aiRole: "Nhân viên", aiName: "小美", aiAvatar: "👩", vocab: ["咖啡", "杯", "多少钱"], missions: ["Chào hỏi", "Gọi 1 ly cà phê", "Hỏi giá"], greeting: "ZH: 你好！欢迎光临。请问你要喝什么？\nPY: Nǐ hǎo! Huānyíng guānglín. Qǐngwèn nǐ yào hē shénme?\nVI: Xin chào! Hoan nghênh. Bạn muốn uống gì?" },
  { id: "h1_2", level: "HSK 1", icon: "👋", title: "Làm quen bạn mới", xp: 30, userRole: "Du học sinh", aiRole: "Sinh viên", aiName: "李雷", aiAvatar: "👦", vocab: ["名字", "哪国人", "高兴"], missions: ["Hỏi tên", "Hỏi quốc tịch", "Nói rất vui được gặp"], greeting: "ZH: 你好！我是李雷，你叫什么名字？\nPY: Nǐ hǎo! Wǒ shì Lǐ Léi, nǐ jiào shénme míngzì?\nVI: Xin chào! Tôi là Lý Lôi, bạn tên là gì?" },
  { id: "h1_3", level: "HSK 1", icon: "🍎", title: "Mua trái cây", xp: 30, userRole: "Người mua", aiRole: "Chủ sạp", aiName: "老板", aiAvatar: "👨‍🌾", vocab: ["苹果", "买", "块"], missions: ["Hỏi táo giá bao nhiêu", "Mua 2 cân", "Thanh toán"], greeting: "ZH: 你好，买水果吗？\nPY: Nǐ hǎo, mǎi shuǐguǒ ma?\nVI: Xin chào, mua trái cây không?" },
  { id: "h1_4", level: "HSK 1", icon: "🚕", title: "Đi Taxi", xp: 30, userRole: "Hành khách", aiRole: "Tài xế", aiName: "王师傅", aiAvatar: "👨", vocab: ["去", "医院", "谢谢"], missions: ["Nói điểm đến (Bệnh viện)", "Hỏi bao nhiêu tiền", "Cảm ơn"], greeting: "ZH: 你好，去哪里？\nPY: Nǐ hǎo, qù nǎlǐ?\nVI: Xin chào, đi đâu vậy?" },
  { id: "h1_5", level: "HSK 1", icon: "🕒", title: "Hỏi giờ giấc", xp: 30, userRole: "Người đi đường", aiRole: "Người qua đường", aiName: "路人", aiAvatar: "🚶", vocab: ["现在", "几点", "分"], missions: ["Hỏi xin lỗi", "Hỏi bây giờ mấy giờ", "Cảm ơn"], greeting: "ZH: 你好，有什么事吗？\nPY: Nǐ hǎo, yǒu shénme shì ma?\nVI: Xin chào, có việc gì không?" },
  { id: "h1_6", level: "HSK 1", icon: "🍚", title: "Ăn tại nhà hàng", xp: 30, userRole: "Thực khách", aiRole: "Phục vụ", aiName: "服务员", aiAvatar: "💁", vocab: ["吃", "米饭", "水"], missions: ["Gọi cơm trắng", "Gọi một ly nước", "Hỏi phòng vệ sinh ở đâu"], greeting: "ZH: 你好，请问你想吃点什么？\nPY: Nǐ hǎo, qǐngwèn nǐ xiǎng chī diǎn shénme?\nVI: Xin chào, bạn muốn ăn chút gì?" },
  { id: "h1_7", level: "HSK 1", icon: "📞", title: "Gọi điện thoại", xp: 30, userRole: "Người gọi", aiRole: "Người nghe", aiName: "朋友", aiAvatar: "📱", vocab: ["喂", "在", "家"], missions: ["Nói A lô", "Hỏi xem bạn có nhà không", "Hẹn gặp mặt"], greeting: "ZH: 喂，你好，请问你是谁？\nPY: Wéi, nǐ hǎo, qǐngwèn nǐ shì shéi?\nVI: A lô, xin chào, xin hỏi bạn là ai?" },
  { id: "h1_8", level: "HSK 1", icon: "👨‍👩‍👧", title: "Giới thiệu gia đình", xp: 30, userRole: "Học sinh", aiRole: "Giáo viên", aiName: "老师", aiAvatar: "👩‍🏫", vocab: ["家", "人", "爸爸"], missions: ["Nói nhà có 3 người", "Kể tên các thành viên", "Nói yêu gia đình"], greeting: "ZH: 你好，你家有几口人？\nPY: Nǐ hǎo, nǐ jiā yǒu jǐ kǒu rén?\nVI: Xin chào, nhà bạn có mấy người?" },
  { id: "h1_9", level: "HSK 1", icon: "🌧️", title: "Hỏi thời tiết", xp: 30, userRole: "Bạn bè", aiRole: "Bạn học", aiName: "同学", aiAvatar: "👧", vocab: ["天气", "下雨", "冷"], missions: ["Hỏi thời tiết hôm nay", "Hỏi có mưa không", "Khuyên mặc áo ấm"], greeting: "ZH: 昨天的天气很好，今天怎么样？\nPY: Zuótiān de tiānqì hěn hǎo, jīntiān zěnmeyàng?\nVI: Thời tiết hôm qua rất tốt, hôm nay thì sao?" },
  { id: "h1_10", level: "HSK 1", icon: "🚶", title: "Hỏi đường cơ bản", xp: 30, userRole: "Khách du lịch", aiRole: "Cảnh sát", aiName: "警察", aiAvatar: "👮", vocab: ["请问", "前面", "走"], missions: ["Chào hỏi lịch sự", "Hỏi ga tàu ở đâu", "Xác nhận lại hướng đi"], greeting: "ZH: 你好，需要帮忙吗？\nPY: Nǐ hǎo, xūyào bāngmáng ma?\nVI: Xin chào, cần giúp đỡ không?" },

  // ================= HSK 2 =================
  { id: "h2_1", level: "HSK 2", icon: "🛍️", title: "Mua quần áo", xp: 40, userRole: "Khách", aiRole: "Nhân viên", aiName: "售货员", aiAvatar: "💁‍♀️", vocab: ["衣服", "颜色", "试", "合适"], missions: ["Hỏi tìm áo màu đỏ", "Yêu cầu thử đồ", "Hỏi xem có hợp không"], greeting: "ZH: 您好，想看点什么衣服？\nPY: Nín hǎo, xiǎng kàn diǎn shénme yīfú?\nVI: Chào bạn, bạn muốn xem quần áo gì?" },
  { id: "h2_2", level: "HSK 2", icon: "🏨", title: "Khách sạn", xp: 40, userRole: "Khách", aiRole: "Lễ tân", aiName: "前台", aiAvatar: "👩‍💼", vocab: ["房间", "护照", "旁边"], missions: ["Báo muốn nhận phòng", "Đưa hộ chiếu", "Hỏi giờ trả phòng"], greeting: "ZH: 您好，欢迎光临！请问您预订房间了吗？\nPY: Nín hǎo, huānyíng guānglín! Qǐngwèn nín yùdìng fángjiān le ma?\nVI: Hoan nghênh quý khách! Xin hỏi ngài đã đặt phòng chưa?" },
  { id: "h2_3", level: "HSK 2", icon: "🤧", title: "Khám cảm cúm", xp: 40, userRole: "Bệnh nhân", aiRole: "Bác sĩ", aiName: "医生", aiAvatar: "👨‍⚕️", vocab: ["生病", "休息", "药"], missions: ["Nói mình bị bệnh", "Hỏi xem có cần uống thuốc không", "Hỏi cần nghỉ ngơi mấy ngày"], greeting: "ZH: 你好，哪里不舒服？\nPY: Nǐ hǎo, nǎlǐ bù shūfú?\nVI: Chào bạn, khó chịu ở đâu?" },
  { id: "h2_4", level: "HSK 2", icon: "🎫", title: "Mua vé tàu", xp: 40, userRole: "Hành khách", aiRole: "Nhân viên bán vé", aiName: "售票员", aiAvatar: "🎫", vocab: ["票", "北京", "时间"], missions: ["Hỏi mua vé đi Bắc Kinh", "Hỏi thời gian xuất phát", "Xác nhận giá vé"], greeting: "ZH: 你好，请问买去哪里的票？\nPY: Nǐ hǎo, qǐngwèn mǎi qù nǎlǐ de piào?\nVI: Chào bạn, xin hỏi mua vé đi đâu?" },
  { id: "h2_5", level: "HSK 2", icon: "🎂", title: "Mời sinh nhật", xp: 40, userRole: "Người mời", aiRole: "Bạn bè", aiName: "朋友", aiAvatar: "🎁", vocab: ["生日", "希望", "一起"], missions: ["Báo hôm nay sinh nhật mình", "Mời bạn cùng đi ăn", "Chốt giờ gặp"], greeting: "ZH: 真的吗？祝你生日快乐！\nPY: Zhēnde ma? Zhù nǐ shēngrì kuàilè!\nVI: Thật không? Chúc bạn sinh nhật vui vẻ!" },
  { id: "h2_6", level: "HSK 2", icon: "⚽", title: "Sở thích thể thao", xp: 40, userRole: "Người học", aiRole: "Bạn học", aiName: "同学", aiAvatar: "🏃", vocab: ["运动", "打篮球", "跑步"], missions: ["Hỏi bạn thích thể thao gì", "Nói mình thích chạy bộ", "Rủ cuối tuần đi tập chung"], greeting: "ZH: 你平时喜欢做什么运动？\nPY: Nǐ píngshí xǐhuān zuò shénme yùndòng?\nVI: Bình thường bạn thích chơi thể thao gì?" },
  { id: "h2_7", level: "HSK 2", icon: "🚲", title: "Thuê xe đạp", xp: 40, userRole: "Du khách", aiRole: "Nhân viên", aiName: "员工", aiAvatar: "🚴", vocab: ["自行车", "小时", "远"], missions: ["Hỏi thuê xe đạp", "Hỏi giá thuê 1 giờ", "Hỏi đường đi công viên có xa không"], greeting: "ZH: 你好，要租自行车吗？\nPY: Nǐ hǎo, yào zū zìxíngchē ma?\nVI: Xin chào, muốn thuê xe đạp không?" },
  { id: "h2_8", level: "HSK 2", icon: "📚", title: "Trong thư viện", xp: 40, userRole: "Sinh viên", aiRole: "Thủ thư", aiName: "图书管理员", aiAvatar: "👩‍🏫", vocab: ["书", "借", "找"], missions: ["Nói muốn tìm một cuốn sách", "Hỏi sách tiếng Trung ở đâu", "Hỏi mượn được mấy ngày"], greeting: "ZH: 同学，请问需要帮忙找书吗？\nPY: Tóngxué, qǐngwèn xūyào bāngmáng zhǎo shū ma?\nVI: Bạn học, cần giúp tìm sách không?" },
  { id: "h2_9", level: "HSK 2", icon: "🔍", title: "Tìm đồ thất lạc", xp: 40, userRole: "Người mất đồ", aiRole: "Bảo vệ", aiName: "保安", aiAvatar: "👮", vocab: ["找", "手机", "丢"], missions: ["Báo mất điện thoại", "Miêu tả điện thoại màu đen", "Để lại số điện thoại liên lạc"], greeting: "ZH: 别着急，你丢了什么东西？\nPY: Bié zhāojí, nǐ diū le shénme dōngxī?\nVI: Đừng vội, bạn mất thứ gì?" },
  { id: "h2_10", level: "HSK 2", icon: "📅", title: "Kế hoạch cuối tuần", xp: 40, userRole: "Bạn bè", aiRole: "Đồng nghiệp", aiName: "同事", aiAvatar: "👨‍💻", vocab: ["周末", "准备", "玩"], missions: ["Hỏi cuối tuần có rảnh không", "Rủ đi xem phim", "Chốt địa điểm gặp"], greeting: "ZH: 这个周末我还没安排，你呢？\nPY: Zhège zhōumò wǒ hái méi ānpái, nǐ ne?\nVI: Cuối tuần này tôi chưa có kế hoạch, bạn thì sao?" },

  // ================= HSK 3 =================
  { id: "h3_1", level: "HSK 3", icon: "🍜", title: "Khiếu nại nhà hàng", xp: 50, userRole: "Khách", aiRole: "Quản lý", aiName: "经理", aiAvatar: "🕴️", vocab: ["问题", "换", "新鲜"], missions: ["Phản ánh món ăn không tươi", "Yêu cầu đổi món", "Yêu cầu xử lý thỏa đáng"], greeting: "ZH: 您好，我是这里的经理。请问有什么问题？\nPY: Nín hǎo, wǒ shì zhèlǐ de jīnglǐ. Qǐngwèn yǒu shénme wèntí?\nVI: Chào bạn, tôi là quản lý. Xin hỏi có vấn đề gì?" },
  { id: "h3_2", level: "HSK 3", icon: "🏦", title: "Mở tài khoản ngân hàng", xp: 50, userRole: "Khách hàng", aiRole: "Nhân viên NH", aiName: "柜员", aiAvatar: "🏦", vocab: ["银行", "卡", "护照", "办"], missions: ["Nêu yêu cầu mở thẻ", "Cung cấp giấy tờ", "Hỏi về phí thường niên"], greeting: "ZH: 您好，请问要办理什么业务？\nPY: Nín hǎo, qǐngwèn yào bànlǐ shénme yèwù?\nVI: Chào bạn, bạn muốn làm nghiệp vụ gì?" },
  { id: "h3_3", level: "HSK 3", icon: "✈️", title: "Đặt vé máy bay", xp: 50, userRole: "Khách hàng", aiRole: "Tổng đài viên", aiName: "客服", aiAvatar: "🎧", vocab: ["航班", "起飞", "座位"], missions: ["Hỏi vé đi Thượng Hải ngày mai", "Chọn chỗ ngồi cạnh cửa sổ", "Xác nhận giờ cất cánh"], greeting: "ZH: 您好，这里是航空公司，请问需要什么帮助？\nPY: Nín hǎo, zhèlǐ shì hángkōng gōngsī, qǐngwèn xūyào shénme bāngzhù?\nVI: Chào bạn, đây là hãng hàng không, cần giúp gì ạ?" },
  { id: "h3_4", level: "HSK 3", icon: "📦", title: "Trả hàng online", xp: 50, userRole: "Người mua", aiRole: "Chăm sóc khách", aiName: "客服", aiAvatar: "💻", vocab: ["退货", "质量", "发"], missions: ["Báo muốn trả hàng", "Giải thích chất lượng kém", "Hỏi cách gửi trả"], greeting: "ZH: 亲，您好，请问商品有什么问题吗？\nPY: Qīn, nín hǎo, qǐngwèn shāngpǐn yǒu shénme wèntí ma?\nVI: Bạn ơi, sản phẩm có vấn đề gì không?" },
  { id: "h3_5", level: "HSK 3", icon: "🗣️", title: "Trao đổi ngôn ngữ", xp: 50, userRole: "Người học tiếng Trung", aiRole: "Người học tiếng Anh", aiName: "王刚", aiAvatar: "🤝", vocab: ["练习", "互相", "提高"], missions: ["Đề nghị làm đối tác học tập", "Thỏa thuận chia thời gian nói 2 thứ tiếng", "Hẹn lịch học cố định"], greeting: "ZH: 听说你想找人练习中文？我也想练英语。\nPY: Tīngshuō nǐ xiǎng zhǎo rén liànxí zhōngwén? Wǒ yě xiǎng liàn yīngyǔ.\nVI: Nghe nói bạn muốn tìm người luyện tiếng Trung? Tôi cũng muốn luyện tiếng Anh." },
  { id: "h3_6", level: "HSK 3", icon: "🏠", title: "Thuê nhà", xp: 50, userRole: "Người thuê", aiRole: "Môi giới", aiName: "中介", aiAvatar: "📋", vocab: ["租房", "环境", "附近", "贵"], missions: ["Hỏi giá thuê phòng 1 tháng", "Hỏi xung quanh có siêu thị không", "Thương lượng giảm giá"], greeting: "ZH: 您好，想看什么样的房子？\nPY: Nín hǎo, xiǎng kàn shénme yàng de fángzi?\nVI: Chào bạn, muốn xem kiểu nhà thế nào?" },
  { id: "h3_7", level: "HSK 3", icon: "💼", title: "Phỏng vấn làm thêm", xp: 50, userRole: "Sinh viên", aiRole: "Chủ quán", aiName: "老板", aiAvatar: "🧔", vocab: ["兼职", "经验", "努力"], missions: ["Giới thiệu bản thân", "Nói về kinh nghiệm trước đây", "Khẳng định mình sẽ chăm chỉ"], greeting: "ZH: 坐吧。你为什么想来我们这里做兼职？\nPY: Zuò ba. Nǐ wèishénme xiǎng lái wǒmen zhèlǐ zuò jiānzhí?\nVI: Ngồi đi. Tại sao bạn muốn đến đây làm thêm?" },
  { id: "h3_8", level: "HSK 3", icon: "🎬", title: "Thảo luận phim", xp: 50, userRole: "Bạn bè", aiRole: "Bạn thân", aiName: "小华", aiAvatar: "🍿", vocab: ["电影", "意思", "错"], missions: ["Bày tỏ ý kiến về bộ phim vừa xem", "Khen diễn viên đóng hay", "Hỏi bạn thấy thế nào"], greeting: "ZH: 刚才那部电影，你觉得怎么样？\nPY: Gāngcái nà bù diànyǐng, nǐ juédé zěnmeyàng?\nVI: Bộ phim ban nãy, bạn thấy thế nào?" },
  { id: "h3_9", level: "HSK 3", icon: "🏥", title: "Khám bệnh chi tiết", xp: 50, userRole: "Bệnh nhân", aiRole: "Bác sĩ", aiName: "医生", aiAvatar: "🩺", vocab: ["检查", "一直", "注意"], missions: ["Miêu tả đau bụng từ hôm qua", "Hỏi xem có cần xét nghiệm không", "Hỏi chế độ ăn uống"], greeting: "ZH: 肚子疼？疼了多久了？\nPY: Dùzi téng? Téng le duōjiǔ le?\nVI: Đau bụng à? Đau bao lâu rồi?" },
  { id: "h3_10", level: "HSK 3", icon: "🗺️", title: "Lên kế hoạch du lịch", xp: 50, userRole: "Bạn du lịch", aiRole: "Bạn đồng hành", aiName: "李明", aiAvatar: "🎒", vocab: ["旅游", "决定", "风景"], missions: ["Gợi ý đi Vân Nam", "Giải thích vì sao chọn nơi đó", "Chốt thời gian mua vé"], greeting: "ZH: 下个月放假，我们去哪儿玩？\nPY: Xià gè yuè fàngjià, wǒmen qù nǎ'er wán?\nVI: Tháng sau nghỉ lễ, chúng ta đi đâu chơi?" },

  // ================= HSK 4 =================
  { id: "h4_1", level: "HSK 4", icon: "🤝", title: "Phỏng vấn chính thức", xp: 60, userRole: "Ứng viên", aiRole: "HR", aiName: "张经理", aiAvatar: "👔", vocab: ["经验", "责任", "适应", "期待"], missions: ["Trình bày điểm mạnh cá nhân", "Giải thích vì sao nghỉ việc cũ", "Nói về kỳ vọng lương"], greeting: "ZH: 你好，请先简单介绍一下你的工作经历。\nPY: Nǐ hǎo, qǐng xiān jiǎndān jièshào yīxià nǐ de gōngzuò jīnglì.\nVI: Chào bạn, hãy giới thiệu ngắn gọn về kinh nghiệm làm việc của bạn." },
  { id: "h4_2", level: "HSK 4", icon: "💰", title: "Thương lượng giá cả", xp: 60, userRole: "Người mua sỉ", aiRole: "Nhà cung cấp", aiName: "王总", aiAvatar: "🏭", vocab: ["价格", "降低", "合作", "质量"], missions: ["Yêu cầu giảm giá 10%", "Đề xuất hợp tác lâu dài", "Xác nhận thời gian giao hàng"], greeting: "ZH: 我们的价格已经是最低了，质量绝对有保证。\nPY: Wǒmen de jiàgé yǐjīng shì zuì dī le, zhìliàng juéduì yǒu bǎozhèng.\nVI: Giá của chúng tôi đã là thấp nhất rồi, chất lượng tuyệt đối đảm bảo." },
  { id: "h4_3", level: "HSK 4", icon: "🌏", title: "Sốc văn hóa", xp: 60, userRole: "Người nước ngoài", aiRole: "Bạn bản xứ", aiName: "陈伟", aiAvatar: "🍜", vocab: ["习惯", "了解", "不同", "其实"], missions: ["Chia sẻ sự khác biệt văn hóa ăn uống", "Hỏi lý do người Trung Quốc thích uống nước nóng", "Thể hiện sự tôn trọng văn hóa"], greeting: "ZH: 你来中国半年了，生活上习惯了吗？\nPY: Nǐ lái Zhōngguó bàn nián le, shēnghuó shàng xíguàn le ma?\nVI: Bạn đến Trung Quốc nửa năm rồi, cuộc sống đã quen chưa?" },
  { id: "h4_4", level: "HSK 4", icon: "♻️", title: "Thảo luận môi trường", xp: 60, userRole: "Công dân", aiRole: "Nhà hoạt động", aiName: "林林", aiAvatar: "🌱", vocab: ["保护", "环境", "垃圾", "减少"], missions: ["Đưa ra quan điểm về rác thải nhựa", "Chia sẻ thói quen bảo vệ môi trường", "Kêu gọi hành động chung"], greeting: "ZH: 现在环境污染很严重，你平时有什么环保习惯吗？\nPY: Xiànzài huánjìng wūrǎn hěn yánzhòng, nǐ píngshí yǒu shénme huánbǎo xíguàn ma?\nVI: Hiện nay ô nhiễm môi trường rất nghiêm trọng, bình thường bạn có thói quen bảo vệ môi trường nào không?" },
  { id: "h4_5", level: "HSK 4", icon: "😢", title: "An ủi bạn bè", xp: 60, userRole: "Người an ủi", aiRole: "Bạn đang buồn", aiName: "小云", aiAvatar: "😭", vocab: ["难过", "发生", "支持", "放弃"], missions: ["Hỏi thăm chuyện gì xảy ra", "Khuyên bạn đừng bỏ cuộc", "Đề nghị giúp đỡ thực tế"], greeting: "ZH: 我这次考试又没通过，真的太难过了。\nPY: Wǒ zhè cì kǎoshì yòu méi tōngguò, zhēnde tài nánguò le.\nVI: Kỳ thi lần này tôi lại không qua, thực sự quá buồn." },
  { id: "h4_6", level: "HSK 4", icon: "🙇", title: "Xin lỗi vì sai sót", xp: 60, userRole: "Nhân viên", aiRole: "Sếp", aiName: "李总", aiAvatar: "😠", vocab: ["抱歉", "粗心", "保证", "解决"], missions: ["Nhận lỗi về báo cáo sai số", "Giải thích không bao biện", "Đưa ra phương án khắc phục ngay lập tức"], greeting: "ZH: 昨天的报告里有几个明显的数据错误，你是怎么检查的？\nPY: Zuótiān de bàogào lǐ yǒu jǐ gè míngxiǎn de shùjù cuòwù, nǐ shì zěnme jiǎnchá de?\nVI: Báo cáo hôm qua có vài lỗi số liệu rõ ràng, cậu kiểm tra kiểu gì vậy?" },
  { id: "h4_7", level: "HSK 4", icon: "🥗", title: "Chế độ ăn kiêng", xp: 60, userRole: "Người giảm cân", aiRole: "Huấn luyện viên", aiName: "教练", aiAvatar: "🏋️", vocab: ["减肥", "健康", "坚持", "效果"], missions: ["Hỏi cách giảm cân không mệt mỏi", "Trình bày thói quen ăn uống hiện tại", "Hứa sẽ kiên trì"], greeting: "ZH: 减肥不能不吃饭，健康最重要。你最近每天吃什么？\nPY: Jiǎnféi bù néng bù chīfàn, jiànkāng zuì zhòngyào. Nǐ zuìjìn měitiān chī shénme?\nVI: Giảm cân không thể nhịn ăn, sức khỏe quan trọng nhất. Gần đây mỗi ngày bạn ăn gì?" },
  { id: "h4_8", level: "HSK 4", icon: "🎉", title: "Lên kế hoạch sự kiện", xp: 60, userRole: "Trưởng nhóm", aiRole: "Thành viên", aiName: "同事", aiAvatar: "📋", vocab: ["活动", "讨论", "意见", "同意"], missions: ["Đề xuất tổ chức tiệc ngoài trời", "Hỏi ý kiến ngân sách", "Phân công nhiệm vụ"], greeting: "ZH: 年会的事情，大家有什么好主意吗？\nPY: Niánhuì de shìqíng, dàjiā yǒu shénme hǎo zhǔyì ma?\nVI: Chuyện tiệc cuối năm, mọi người có ý kiến gì hay không?" },
  { id: "h4_9", level: "HSK 4", icon: "🤯", title: "Tâm sự áp lực", xp: 60, userRole: "Người tâm sự", aiRole: "Bạn thân", aiName: "大卫", aiAvatar: "☕", vocab: ["压力", "放松", "烦恼", "建议"], missions: ["Bày tỏ áp lực công việc quá lớn", "Hỏi cách xả stress", "Cảm ơn lời khuyên"], greeting: "ZH: 看你最近脸色不太好，是不是工作压力太大了？\nPY: Kàn nǐ zuìjìn liǎnsè bù tài hǎo, shì bù shì gōngzuò yālì tài dà le?\nVI: Thấy dạo này sắc mặt bạn không tốt, có phải áp lực công việc lớn quá không?" },
  { id: "h4_10", level: "HSK 4", icon: "🛒", title: "Mua sắm online", xp: 60, userRole: "Khách hàng", aiRole: "Chủ shop", aiName: "掌柜", aiAvatar: "📦", vocab: ["打折", "稍微", "评价", "快递"], missions: ["Hỏi xin mã giảm giá", "Hỏi bao lâu nhận được hàng", "Hứa sẽ đánh giá tốt"], greeting: "ZH: 亲，我们现在的价格已经很优惠了哦。\nPY: Qīn, wǒmen xiànzài de jiàgé yǐjīng hěn yōuhuì le o.\nVI: Khách ơi, giá hiện tại của chúng tôi đã rất ưu đãi rồi ạ." },

  // ================= HSK 5 =================
  { id: "h5_1", level: "HSK 5", icon: "🏢", title: "Đàm phán thương mại", xp: 80, userRole: "Giám đốc", aiRole: "Đối tác", aiName: "刘总", aiAvatar: "🤝", vocab: ["双赢", "利益", "考虑", "条件"], missions: ["Bảo vệ tỷ lệ lợi nhuận của công ty", "Đề nghị nhượng bộ đôi bên (Win-win)", "Chốt điều khoản hợp đồng"], greeting: "ZH: 这个利润比例我们很难接受，公司成本太高了。\nPY: Zhège lìrùn bǐlì wǒmen hěn nán jiēshòu, gōngsī chéngběn tài gāo le.\nVI: Tỷ lệ lợi nhuận này chúng tôi rất khó chấp nhận, chi phí công ty quá cao." },
  { id: "h5_2", level: "HSK 5", icon: "🚀", title: "Kế hoạch sự nghiệp", xp: 80, userRole: "Nhân viên", aiRole: "Mentor", aiName: "导师", aiAvatar: "🧠", vocab: ["发展", "挑战", "缺乏", "积累"], missions: ["Phân tích điểm nghẽn trong công việc hiện tại", "Hỏi xin định hướng trong 5 năm tới", "Bày tỏ quyết tâm học hỏi"], greeting: "ZH: 你在公司三年了，对未来的职业发展有什么具体规划吗？\nPY: Nǐ zài gōngsī sān nián le, duì wèilái de zhíyè fāzhǎn yǒu shénme jùtǐ guīhuà ma?\nVI: Bạn ở công ty 3 năm rồi, đối với phát triển nghề nghiệp tương lai có quy hoạch cụ thể gì không?" },
  { id: "h5_3", level: "HSK 5", icon: "⚖️", title: "Tranh luận công nghệ", xp: 80, userRole: "Người ủng hộ", aiRole: "Người phản đối", aiName: "学者", aiAvatar: "🎓", vocab: ["人工智能", "代替", "创造", "必然"], missions: ["Lập luận AI giúp tăng hiệu suất", "Phản biện ý kiến AI cướp việc làm", "Đưa ra kết luận trung lập"], greeting: "ZH: 我认为人工智能的快速发展会导致大量人员失业，这是一个严重的社会问题。\nPY: Wǒ rènwéi réngōng zhìnéng de kuàisù fāzhǎn huì dǎozhì dàliàng rényuán shīyè...\nVI: Tôi cho rằng sự phát triển nhanh của AI sẽ dẫn đến thất nghiệp hàng loạt, đây là vấn đề XH nghiêm trọng." },
  { id: "h5_4", level: "HSK 5", icon: "🗣️", title: "Thuyết trình (Q&A)", xp: 80, userRole: "Diễn giả", aiRole: "Khán giả khó tính", aiName: "观众", aiAvatar: "🙋‍♂️", vocab: ["据我所知", "证明", "数据", "全面"], missions: ["Tiếp nhận câu hỏi một cách lịch sự", "Dùng số liệu để bảo vệ quan điểm", "Khéo léo kết thúc tranh luận"], greeting: "ZH: 你的报告很精彩，但我对你的第三个数据来源表示怀疑。\nPY: Nǐ de bàogào hěn jīngcǎi, dàn wǒ duì nǐ de dì sān gè shùjù láiyuán biǎoshì huáiyí.\nVI: Báo cáo của bạn rất hay, nhưng tôi hoài nghi về nguồn dữ liệu thứ 3 của bạn." },
  { id: "h5_5", level: "HSK 5", icon: "📰", title: "Bàn luận tin tức", xp: 80, userRole: "Người quan tâm", aiRole: "Nhà báo", aiName: "记者", aiAvatar: "🗞️", vocab: ["现象", "影响", "引起", "关注"], missions: ["Nhận xét về hiện tượng người trẻ ngại kết hôn", "Phân tích áp lực kinh tế", "Đưa ra giải pháp cá nhân"], greeting: "ZH: 最近“年轻人不愿结婚”成了热点新闻，你对此有什么看法？\nPY: Zuìjìn “niánqīng rén bù yuàn jiéhūn” chéngle rèdiǎn xīnwén, nǐ duì cǐ yǒu shénme kànfǎ?\nVI: Gần đây 'người trẻ không muốn kết hôn' thành tin nóng, bạn có góc nhìn thế nào về việc này?" },
  { id: "h5_6", level: "HSK 5", icon: "😠", title: "Xử lý khủng hoảng KH", xp: 80, userRole: "Trưởng phòng CSKH", aiRole: "Khách VIP tức giận", aiName: "VIP客户", aiAvatar: "🔥", vocab: ["安抚", "抱歉", "赔偿", "立即"], missions: ["Xoa dịu cơn giận của khách", "Đề xuất phương án bồi thường", "Cam kết không tái phạm"], greeting: "ZH: 你们的服务简直太糟糕了！我要求立刻见你们负责人！\nPY: Nǐmen de fúwù jiǎnzhí tài zāogāo le! Wǒ yāoqiú lìkè jiàn nǐmen fùzérén!\nVI: Dịch vụ của các người thật tồi tệ! Tôi yêu cầu gặp ngay người phụ trách!" },
  { id: "h5_7", level: "HSK 5", icon: "📈", title: "Tư vấn đầu tư", xp: 80, userRole: "Nhà đầu tư", aiRole: "Chuyên gia tài chính", aiName: "分析师", aiAvatar: "📊", vocab: ["投资", "风险", "收益", "市场"], missions: ["Hỏi về rủi ro của thị trường chứng khoán", "Đề nghị phân tích các kênh an toàn", "Chốt kế hoạch rót vốn"], greeting: "ZH: 目前市场波动很大，您是倾向于稳健型投资还是高风险高回报？\nPY: Mùqián shìchǎng bōdòng hěn dà, nín shì qīngxiàng yú wěnjiàn xíng tóuzī háishì gāo fēngxiǎn gāo huíbào?\nVI: Hiện tại thị trường biến động lớn, ngài thiên về đầu tư an toàn hay rủi ro cao lợi nhuận cao?" },
  { id: "h5_8", level: "HSK 5", icon: "🏮", title: "Văn hóa truyền thống", xp: 80, userRole: "Du khách nước ngoài", aiRole: "Hướng dẫn viên", aiName: "导游", aiAvatar: "🚩", vocab: ["历史", "传统", "深刻", "意义"], missions: ["Hỏi về ý nghĩa của Tết Trung Thu", "Bày tỏ sự yêu thích văn hóa", "So sánh nhẹ với văn hóa nước mình"], greeting: "ZH: 中国的中秋节不仅是吃月饼，更代表着团圆。你的国家有类似的节日吗？\nPY: Zhōngguó de zhōngqiūjié bù jǐn shì chī yuèbǐng, gèng dàibiǎozhe tuányuán...\nVI: Tết Trung thu TQ không chỉ là ăn bánh, mà còn đại diện cho sự đoàn viên. Nước bạn có lễ hội tương tự không?" },
  { id: "h5_9", level: "HSK 5", icon: "📚", title: "Review sách sâu sắc", xp: 80, userRole: "Độc giả", aiRole: "Nhà phê bình", aiName: "作家", aiAvatar: "🖋️", vocab: ["作品", "表达", "思想", "共鸣"], missions: ["Nói về thông điệp chính của tác phẩm", "Chia sẻ cảm xúc đồng cảm", "Thảo luận về phong cách tác giả"], greeting: "ZH: 这本书的结尾非常悲伤，你认为作者想向我们传达什么思想？\nPY: Zhè běn shū de jiéwěi fēicháng bēishāng, nǐ rènwéi zuòzhě xiǎng xiàng wǒmen chuándá shénme sīxiǎng?\nVI: Kết cục cuốn sách rất bi thương, bạn cho rằng tác giả muốn truyền đạt tư tưởng gì?" },
  { id: "h5_10", level: "HSK 5", icon: "⚖️", title: "Hệ thống giáo dục", xp: 80, userRole: "Phụ huynh", aiRole: "Hiệu trưởng", aiName: "校长", aiAvatar: "🏫", vocab: ["素质教育", "压力", "培养", "竞争"], missions: ["Phàn nàn về áp lực thi cử quá nặng", "Đề xuất tăng cường kỹ năng mềm", "Thảo luận về giáo dục toàn diện"], greeting: "ZH: 现在的孩子竞争确实激烈，但学校也在努力推行素质教育。\nPY: Xiànzài de háizi jìngzhēng quèshí jīliè, dàn xuéxiào yě zài nǔlì tuīxíng sùzhì jiàoyù.\nVI: Trẻ em hiện nay cạnh tranh đúng là khốc liệt, nhưng trường cũng đang nỗ lực thúc đẩy giáo dục toàn diện." },

  // ================= HSK 6 =================
  { id: "h6_1", level: "HSK 6", icon: "🌍", title: "Kinh tế toàn cầu", xp: 100, userRole: "Nhà phân tích", aiRole: "Giáo sư kinh tế", aiName: "教授", aiAvatar: "🏛️", vocab: ["通货膨胀", "趋势", "复苏", "挑战"], missions: ["Phân tích lạm phát toàn cầu", "Dự đoán xu hướng phục hồi", "Tranh luận về chính sách tiền tệ"], greeting: "ZH: 面对全球性的通货膨胀，你认为各国的货币政策应该如何调整？\nPY: Miànduì quánqiú xìng de tōnghuò péngzhàng, nǐ rènwéi gèguó de huòbì zhèngcè yīnggāi rúhé tiáozhěng?\nVI: Đối mặt với lạm phát toàn cầu, bạn cho rằng chính sách tiền tệ các nước nên điều chỉnh thế nào?" },
  { id: "h6_2", level: "HSK 6", icon: "🧠", title: "Triết học nhân sinh", xp: 100, userRole: "Học giả", aiRole: "Thiền sư", aiName: "大师", aiAvatar: "🧘‍♂️", vocab: ["意义", "顺其自然", "追求", "境界"], missions: ["Hỏi về ý nghĩa thực sự của hạnh phúc", "Bàn về khái niệm buông bỏ", "Thể hiện sự ngộ đạo"], greeting: "ZH: 现代人总是步履匆匆地追求名利，却往往忽略了内心的宁静。\nPY: Xiàndài rén zǒngshì bùlǚ cōngcōng de zhuīqiú mínglì, què wǎngwǎng hūlüè le nèixīn de níngjìng.\nVI: Người hiện đại luôn vội vã theo đuổi danh lợi, mà thường bỏ qua sự bình yên nội tâm." },
  { id: "h6_3", level: "HSK 6", icon: "🚨", title: "Khủng hoảng truyền thông", xp: 100, userRole: "CEO", aiRole: "Giám đốc PR", aiName: "公关总监", aiAvatar: "📱", vocab: ["舆论", "澄清", "挽回", "危机"], missions: ["Phân tích nguyên nhân khủng hoảng bùng nổ", "Chỉ đạo soạn thảo thông cáo báo chí", "Quyết định phương án xin lỗi công chúng"], greeting: "ZH: 董事长，网上的负面舆论正在发酵，我们必须在两小时内给出官方回应。\nPY: Dǒngshìzhǎng, wǎng shàng de fùmiàn yúlùn zhèngzài fājiào...\nVI: Thưa Chủ tịch, dư luận tiêu cực trên mạng đang lên men, chúng ta phải có phản hồi chính thức trong 2 giờ." },
  { id: "h6_4", level: "HSK 6", icon: "⚖️", title: "Đạo đức AI", xp: 100, userRole: "Nhà lập pháp", aiRole: "Nhà phát triển AI", aiName: "科技专家", aiAvatar: "💻", vocab: ["隐私", "伦理", "约束", "滥用"], missions: ["Cảnh báo nguy cơ xâm phạm quyền riêng tư", "Đề xuất luật kiểm soát dữ liệu", "Tranh luận về sự phát triển tự do"], greeting: "ZH: 过度监管会扼杀科技创新，AI的伦理边界到底应该由谁来界定？\nPY: Guòdù jiānguǎn huì èshā kējì chuàngxīn, AI de lúnlǐ biānjiè dàodǐ yīnggāi yóu shéi lái jièdìng?\nVI: Giám sát quá mức sẽ bóp nghẹt đổi mới công nghệ, ranh giới đạo đức của AI rốt cuộc nên do ai định đoạt?" },
  { id: "h6_5", level: "HSK 6", icon: "🎨", title: "Lịch sử nghệ thuật", xp: 100, userRole: "Người thưởng lãm", aiRole: "Nhà giám tuyển", aiName: "馆长", aiAvatar: "🖼️", vocab: ["流派", "审美", "反映", "独特"], missions: ["Phân tích giá trị của nghệ thuật đương đại", "So sánh với trường phái cổ điển", "Bình luận về một tác phẩm cụ thể"], greeting: "ZH: 当代艺术往往打破常规，你如何理解这幅看似毫无逻辑的画作？\nPY: Dāngdài yìshù wǎngwǎng dǎpò chángguī, nǐ rúhé lǐjiě zhè fú kànsì háowú luójí de huàzuò?\nVI: Nghệ thuật đương đại thường phá vỡ quy củ, bạn hiểu thế nào về bức tranh nhìn như vô lý này?" },
  { id: "h6_6", level: "HSK 6", icon: "🧩", title: "Hiện tượng tâm lý", xp: 100, userRole: "Sinh viên TLH", aiRole: "Giáo sư Tâm lý", aiName: "导师", aiAvatar: "📖", vocab: ["潜意识", "压抑", "因素", "症状"], missions: ["Trình bày về chứng rối loạn lo âu", "Phân tích tác động của mạng xã hội", "Đề xuất hướng can thiệp"], greeting: "ZH: 在信息爆炸的时代，“信息焦虑症”越来越普遍，你认为其根本心理动因是什么？\nPY: Zài xìnxī bàozhà de shídài, “xìnxī jiāolǜ zhèng” yuè lái yuè pǔbiàn...\nVI: Trong thời đại bùng nổ thông tin, 'chứng lo âu thông tin' ngày càng phổ biến, bạn nghĩ động cơ tâm lý căn bản là gì?" },
  { id: "h6_7", level: "HSK 6", icon: "🎓", title: "Bảo vệ luận án", xp: 100, userRole: "Nghiên cứu sinh", aiRole: "Hội đồng giám khảo", aiName: "主考官", aiAvatar: "👨‍⚖️", vocab: ["论证", "缺陷", "贡献", "严谨"], missions: ["Bảo vệ phương pháp nghiên cứu", "Thừa nhận hạn chế của đề tài", "Khẳng định đóng góp thực tiễn"], greeting: "ZH: 你的论文逻辑清晰，但在样本采集上是否缺乏一定的普遍性？请你辩护。\nPY: Nǐ de lùnwén luójí qīngxī, dàn zài yàngběn cǎijí shàng shìfǒu quēfá yīdìng de pǔbiàn xìng? Qǐng nǐ biànhù.\nVI: Luận văn của bạn logic rõ ràng, nhưng trong việc thu thập mẫu có phải thiếu tính phổ quát không? Mời biện hộ." },
  { id: "h6_8", level: "HSK 6", icon: "🌐", title: "Quan hệ quốc tế", xp: 100, userRole: "Nhà ngoại giao", aiRole: "Phóng viên quốc tế", aiName: "资深记者", aiAvatar: "🎤", vocab: ["摩擦", "合作", "局势", "互利"], missions: ["Bình luận về căng thẳng thương mại", "Nhấn mạnh lập trường hòa bình", "Nêu bật tầm quan trọng của hợp tác"], greeting: "ZH: 面对当前复杂的国际地缘政治局势，贵国的外交战略重心会发生转移吗？\nPY: Miànduì dāngqián fúzá de guójì dìyuán zhèngzhì júshì...\nVI: Đối mặt với cục diện địa chính trị quốc tế phức tạp hiện nay, trọng tâm chiến lược ngoại giao của quý quốc có dịch chuyển không?" },
  { id: "h6_9", level: "HSK 6", icon: "🔬", title: "Đột phá khoa học", xp: 100, userRole: "Nhà khoa học", aiRole: "Tạp chí Khoa học", aiName: "主编", aiAvatar: "🧬", vocab: ["基因编辑", "伦理", "攻克", "前景"], missions: ["Giải thích công nghệ chỉnh sửa gen", "Xoa dịu lo ngại về mặt đạo đức", "Vẽ ra viễn cảnh chữa bệnh nan y"], greeting: "ZH: 基因编辑技术虽然能攻克绝症，但也打开了潘多拉魔盒，对此您怎么看？\nPY: Jīyīn biānjí jìshù suīrán néng gōngkè juézhèng, dàn yě dǎkāi le Pānduōlā móhé...\nVI: Công nghệ chỉnh sửa gen tuy có thể trị bệnh nan y, nhưng cũng mở ra chiếc hộp Pandora, ngài nghĩ sao về điều này?" },
  { id: "h6_10", level: "HSK 6", icon: "🏙️", title: "Đô thị hóa", xp: 100, userRole: "Kiến trúc sư", aiRole: "Thị trưởng", aiName: "市长", aiAvatar: "🏙️", vocab: ["规划", "拥挤", "可持续", "资源"], missions: ["Trình bày vấn nạn kẹt xe/nhà ở", "Đề xuất mô hình thành phố thông minh", "Thuyết phục về phát triển bền vững"], greeting: "ZH: 城市化进程带来的不仅是繁荣，还有“大城市病”，在未来规划中我们该如何取舍？\nPY: Chéngshìhuà jìnchéng dàilái de bùjǐn shì fánróng, hái yǒu “dà chéngshì bìng”...\nVI: Quá trình đô thị hóa mang lại không chỉ sự phồn vinh mà còn 'bệnh đô thị lớn', trong quy hoạch tương lai chúng ta nên lấy/bỏ thế nào?" }
];

export default function RoleplayPage() {
  const { user, isLoaded } = useUser();
  
  // Trạng thái điều hướng: 'mode_selection' | 'free_chat' | 'roleplay_levels' | 'scenario_selection' | 'roleplaying' | 'report'
  const [phase, setPhase] = useState("mode_selection");
  const [activeScenario, setActiveScenario] = useState(null);
  
  // Lọc theo HSK cho Roleplay
  const [selectedHskLevel, setSelectedHskLevel] = useState("HSK 1");

  // Trạng thái hội thoại
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const chatContainerRef = useRef(null);

  // Chế độ nhập liệu: 'voice' | 'text'
  const [inputMode, setInputMode] = useState("voice");
  const [isRecording, setIsRecording] = useState(false);

  // Nhiệm vụ (dành cho roleplay)
  const [completedMissions, setCompletedMissions] = useState([]);

  // TỰ ĐỘNG CUỘN XUỐNG KHI CÓ TIN NHẮN MỚI
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isChatting, phase]);

  // TEXT TO SPEECH
  const speak = (text) => {
    window.speechSynthesis.cancel(); 
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; 
    utterance.rate = 0.85; 
    window.speechSynthesis.speak(utterance);
  };

  // NHẬP BẰNG GIỌNG NÓI
  const handleVoiceHold = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Trình duyệt không hỗ trợ nhận diện giọng nói. Vui lòng dùng chế độ gõ phím.");
      setInputMode("text");
      return;
    }
    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(transcript);
      submitMessage(transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    
    recognition.start();
  };

  // BẮT ĐẦU CHAT TỰ DO
  const startFreeChat = () => {
    setPhase("free_chat");
    setChatHistory([{ 
      role: 'assistant', 
      content: 'ZH: 你好！我是你的中文练习伙伴。想聊点什么呢？\nPY: Nǐ hǎo! Wǒ shì nǐ de zhōngwén liànxí huǒbàn. Xiǎng liáo diǎn shénme ne?\nVI: Xin chào! Tôi là đối tác luyện tiếng Trung của bạn. Muốn trò chuyện về chủ đề gì nào?',
      showTranslation: false,
      showCoach: false
    }]);
  };

  // BẮT ĐẦU ROLEPLAY
  const startRoleplay = (scenario) => {
    setActiveScenario(scenario);
    setPhase("roleplaying");
    setCompletedMissions([]);
    setChatHistory([{ 
      role: 'assistant', 
      content: scenario.greeting,
      showTranslation: false,
      showCoach: false
    }]);
  };

  // GỬI TIN NHẮN LÊN API
  const submitMessage = async (textMsg) => {
    const content = typeof textMsg === 'string' ? textMsg : chatInput;
    if (!content.trim()) return;
    
    const newUserMsg = { role: 'user', content: content };
    const newHistory = [...chatHistory, newUserMsg];
    
    setChatHistory(newHistory); 
    setChatInput(""); 
    setIsChatting(true);

    try {
      const apiMessages = newHistory.map(msg => ({ role: msg.role, content: msg.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });
      
      const data = await res.json();
      
      // Giả lập AI Coach Feedback thỉnh thoảng xuất hiện để người học review
      const hasFeedback = Math.random() > 0.6;
      let coachFeedback = null;
      if (hasFeedback) {
        coachFeedback = phase === "free_chat" 
          ? "Bạn có thể mở rộng câu nói bằng cách thêm các trạng từ chỉ mức độ như 很, 非常 nhé."
          : "Phản xạ rất tốt! Cố gắng bám sát từ vựng gợi ý của tình huống để ghi điểm tuyệt đối.";
      }

      setChatHistory([...newHistory, { 
        role: 'assistant', 
        content: data.reply, 
        showTranslation: false,
        showCoach: false,
        coachFeedback: coachFeedback
      }]);

      // Check Mission nếu đang ở chế độ Roleplay
      if (phase === "roleplaying" && activeScenario && completedMissions.length < activeScenario.missions.length) {
        if (Math.random() > 0.4) {
          const uncompleted = activeScenario.missions.map((_, i) => i).filter(i => !completedMissions.includes(i));
          if (uncompleted.length > 0) {
            setCompletedMissions([...completedMissions, uncompleted[0]]);
          }
        }
      }

    } catch (error) { 
      alert("Lỗi kết nối Chat AI! Vui lòng kiểm tra lại mạng."); 
    } finally { 
      setIsChatting(false); 
    }
  };

  const finishRoleplay = async () => {
    setPhase("report");
    if (user && activeScenario) {
      const studentRef = doc(db, "progress", user.id);
      await setDoc(studentRef, { roleplayExp: increment(activeScenario.xp) }, { merge: true });
    }
  };

  const toggleTranslate = (index) => {
    const newHistory = [...chatHistory];
    newHistory[index].showTranslation = !newHistory[index].showTranslation;
    setChatHistory(newHistory);
  };

  const toggleCoach = (index) => {
    const newHistory = [...chatHistory];
    newHistory[index].showCoach = !newHistory[index].showCoach;
    setChatHistory(newHistory);
  };

  const renderAiMessage = (msg, index) => {
    let zh = msg.content; let py = ""; let vi = "";
    
    const zhMatch = msg.content.match(/ZH:\s*(.*)/i);
    const pyMatch = msg.content.match(/PY:\s*(.*)/i);
    const viMatch = msg.content.match(/VI:\s*(.*)/i);
    
    if (zhMatch) zh = zhMatch[1].trim();
    if (pyMatch) py = pyMatch[1].trim();
    if (viMatch) vi = viMatch[1].trim();

    if (!zhMatch && !pyMatch && !viMatch) zh = msg.content;

    const avatar = phase === "free_chat" ? "🐼" : (activeScenario?.aiAvatar || "🤖");
    const name = phase === "free_chat" ? "Xiao Qingwa" : (activeScenario?.aiName || "AI");

    return (
      <div className="flex flex-col w-full animate-fade-in">
        <div className="flex items-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-white border-2 border-emerald-100 flex items-center justify-center text-xl shadow-sm shrink-0">
            {avatar}
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{name}</p>
            <div className="mt-1 bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100">
              <div className="flex items-center gap-3">
                <p className="text-[17px] font-medium text-slate-800 leading-relaxed whitespace-pre-wrap">{zh}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mt-2 ml-1">
              <button onClick={() => speak(zh)} className="text-[11px] font-bold text-slate-500 hover:text-[#08A66A] flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm transition">
                <span className="text-sm">🔊</span> Nghe
              </button>
              <button onClick={() => toggleTranslate(index)} className={`text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border shadow-sm transition ${msg.showTranslation ? 'bg-[#DDF7EA] text-[#08A66A] border-[#08A66A]/30' : 'bg-white text-slate-500 hover:text-[#08A66A] border-slate-100'}`}>
                <span className="text-sm">👁</span> Dịch
              </button>
              {msg.coachFeedback && (
                <button onClick={() => toggleCoach(index)} className={`text-[11px] font-bold flex items-center gap-1 px-2 py-1 rounded-lg border shadow-sm transition ${msg.showCoach ? 'bg-[#FFF8E8] text-amber-600 border-[#FFC83D]/30' : 'bg-white text-amber-500 hover:bg-amber-50 border-slate-100'}`}>
                  <span className="text-sm">💡</span> Coach
                </button>
              )}
            </div>

            {msg.showTranslation && (
              <div className="mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 animate-slide-down max-w-sm">
                {py && <p className="mb-1 text-[#08A66A] font-medium text-sm">{py}</p>}
                {vi && <p className="text-slate-600 text-sm">{vi}</p>}
              </div>
            )}

            {msg.showCoach && msg.coachFeedback && (
              <div className="mt-2 bg-[#FFF8E8] p-4 rounded-xl border border-[#FFC83D]/40 animate-slide-down relative overflow-hidden max-w-sm">
                <div className="absolute top-0 right-0 w-16 h-16 bg-[#FFC83D]/10 rounded-bl-full pointer-events-none"></div>
                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-1"><span>💡</span> Gợi ý cải thiện</p>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{msg.coachFeedback}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F8F5] font-sans text-slate-800 relative selection:bg-emerald-200 flex flex-col">
      
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-40 pointer-events-none"
        style={{ backgroundImage: "url('/hskk/sapxep.jpg')" }}
      >
        <div className="absolute inset-0 bg-[#F4F8F5]/80 backdrop-blur-[2px]"></div>
      </div>

      <header className="relative z-20 w-full bg-white/80 backdrop-blur-xl border-b border-emerald-100 shadow-sm sticky top-0">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 bg-[#08A66A] rounded-full flex items-center justify-center text-white text-2xl shadow-sm">🐸</div>
            <div className="hidden sm:block">
              <h1 className="font-black text-slate-900 text-lg leading-tight">Hành Trình HSK</h1>
              <p className="text-[10px] text-[#08A66A] font-bold uppercase tracking-wider mt-0.5">Roleplay Bản Xứ</p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm font-black bg-[#DDF7EA] text-[#08A66A] px-4 py-1.5 rounded-full border border-[#08A66A]/20 shadow-sm">
              🎭 Thực chiến giao tiếp
            </div>
            
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              {isLoaded && user ? (
                <div className="flex items-center gap-2">
                  <UserButton afterSignOutUrl="/" />
                </div>
              ) : (
                <SignInButton mode="modal">
                  <button className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md hover:bg-slate-800 transition">Đăng nhập</button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center w-full py-10 px-4 md:px-6 h-full overflow-hidden">
        
        {/* =========================================
            PHASE 1: CHỌN CHẾ ĐỘ THỰC CHIẾN
            ========================================= */}
        {phase === "mode_selection" && (
          <div className="w-full max-w-4xl animate-fade-in pb-20 mt-10">
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl mb-6 shadow-sm border border-emerald-100">🚀</div>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Thực Chiến Bản Xứ</h2>
              <p className="text-slate-600 font-medium max-w-lg mx-auto text-lg leading-relaxed">
                Đừng chỉ học thuộc từ vựng. Hãy bước vào môi trường giao tiếp thực tế. Chọn cách bạn muốn bắt đầu!
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Thẻ Chat Tự Do */}
              <div 
                onClick={startFreeChat}
                className="relative p-10 rounded-[40px] shadow-sm border border-white hover:border-[#08A66A]/50 hover:shadow-xl hover:-translate-y-2 transition-all cursor-pointer group text-center overflow-hidden bg-cover bg-center"
                style={{ backgroundImage: "url('/hskk/anh1.jpg')" }}
              >
                <div className="absolute inset-0 bg-white/85 backdrop-blur-[4px] group-hover:bg-white/75 transition-all z-0"></div>
                <div className="relative z-10">
                  <div className="text-7xl mb-6 group-hover:scale-110 transition-transform">💬</div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3">Chat Tự Do</h3>
                  <p className="text-slate-600 font-medium mb-8">Trò chuyện không giới hạn chủ đề với Xiao Qingwa để rèn luyện phản xạ ngôn ngữ hàng ngày.</p>
                  <button className="w-full py-4 bg-white/80 border border-emerald-100 text-[#08A66A] font-black rounded-2xl group-hover:bg-[#08A66A] group-hover:text-white group-hover:border-[#08A66A] transition-colors uppercase tracking-widest shadow-sm">Bắt đầu ngay →</button>
                </div>
              </div>

              {/* Thẻ Nhập Vai Tình Huống */}
              <div 
                onClick={() => setPhase("roleplay_levels")}
                className="relative p-10 rounded-[40px] shadow-sm border border-white hover:border-amber-400/50 hover:shadow-xl hover:-translate-y-2 transition-all cursor-pointer group text-center overflow-hidden bg-cover bg-center"
                style={{ backgroundImage: "url('/hskk/anh2.jpg')" }}
              >
                <div className="absolute inset-0 bg-white/85 backdrop-blur-[4px] group-hover:bg-white/75 transition-all z-0"></div>
                <div className="relative z-10">
                  <div className="text-7xl mb-6 group-hover:scale-110 transition-transform">🎭</div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3">Nhập Vai Tình Huống</h3>
                  <p className="text-slate-600 font-medium mb-8">Sống trong các ngữ cảnh thực tế (Đi cafe, phỏng vấn, mua sắm...) và hoàn thành nhiệm vụ.</p>
                  <button className="w-full py-4 bg-white/80 border border-amber-100 text-amber-600 font-black rounded-2xl group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-colors uppercase tracking-widest shadow-sm">Chọn tình huống →</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            PHASE 2: CHỌN CẤP ĐỘ ROLEPLAY
            ========================================= */}
        {phase === "roleplay_levels" && (
          <div className="w-full max-w-5xl animate-fade-in pb-20">
            <button 
              onClick={() => setPhase("mode_selection")}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-md rounded-2xl font-bold text-sm text-slate-600 shadow-sm border border-white hover:text-rose-500 mb-8 transition-all"
            >
              <span>←</span> Quay lại
            </button>

            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-slate-900 mb-2">Chọn Cấp Độ Nhập Vai</h2>
              <p className="text-slate-500 font-medium">Mỗi cấp độ có 10 tình huống được biên soạn bám sát thực tế.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((lvl) => (
                <div 
                  key={lvl} 
                  onClick={() => { setSelectedHskLevel(`HSK ${lvl}`); setPhase("scenario_selection"); }}
                  className="relative rounded-[32px] p-8 shadow-sm border border-emerald-50 text-center hover:border-[#08A66A]/50 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group overflow-hidden bg-cover bg-center"
                  style={{ backgroundImage: `url('/hskk/anh${(lvl % 3) + 1}.jpg')` }}
                >
                  <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] group-hover:bg-white/80 transition-all z-0"></div>
                  <div className="relative z-10">
                    <h3 className="text-3xl font-black text-slate-800 group-hover:text-[#08A66A] transition-colors mb-2">HSK {lvl}</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white/50 px-3 py-1.5 rounded-lg inline-block">10 Tình Huống</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================
            PHASE 3: CHỌN SCENARIO CỦA LEVEL ĐÃ CHỌN
            ========================================= */}
        {phase === "scenario_selection" && (
          <div className="w-full max-w-[1200px] animate-fade-in pb-20">
            <div className="flex items-center justify-between mb-10">
              <button 
                onClick={() => setPhase("roleplay_levels")}
                className="flex items-center gap-2 px-5 py-2.5 bg-white/80 backdrop-blur-md rounded-2xl font-bold text-sm text-slate-600 shadow-sm border border-white hover:text-[#08A66A] transition-all"
              >
                <span>←</span> Chọn cấp độ khác
              </button>
              <div className="bg-[#172033] text-white px-6 py-2 rounded-xl font-black text-sm shadow-md">
                {selectedHskLevel}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {SCENARIOS.filter(s => s.level === selectedHskLevel).map((scenario) => (
                <div key={scenario.id} className="relative rounded-[32px] p-6 shadow-sm border border-emerald-50 flex flex-col hover:border-[#08A66A]/50 hover:shadow-xl hover:-translate-y-1 transition-all group overflow-hidden bg-cover bg-center" style={{ backgroundImage: "url('/hskk/thucchien.jpg')" }}>
                  
                  <div className="absolute inset-0 bg-white/95 backdrop-blur-[4px] group-hover:bg-white/90 transition-all z-0"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#DDF7EA] to-transparent rounded-bl-full pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity z-0"></div>
                  
                  <div className="relative z-10 flex justify-between items-start mb-6">
                    <div className="w-16 h-16 bg-[#F4F8F5] rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-emerald-100 group-hover:scale-110 transition-transform bg-white/80 backdrop-blur-sm">
                      {scenario.icon}
                    </div>
                    <span className="text-[10px] font-black text-amber-500 bg-[#FFF8E8] px-3 py-1.5 rounded-lg border border-amber-200/50 shadow-sm backdrop-blur-sm">
                      ⭐ {scenario.xp} XP
                    </span>
                  </div>
                  
                  <div className="relative z-10 mb-6 flex-1">
                    <h3 className="text-xl font-black text-slate-800 mb-2">{scenario.title}</h3>
                    <div className="bg-slate-50/80 backdrop-blur-sm p-3 rounded-xl border border-slate-100 mb-4 flex items-center gap-3">
                      <div className="text-[11px] font-bold text-slate-600">
                        Bạn: <span className="text-[#08A66A]">{scenario.userRole}</span>
                      </div>
                      <div className="w-px h-3 bg-slate-300"></div>
                      <div className="text-[11px] font-bold text-slate-600">
                        AI: <span className="text-amber-600">{scenario.aiRole}</span>
                      </div>
                    </div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Từ vựng gợi ý</p>
                    <div className="flex flex-wrap gap-1.5">
                      {scenario.vocab.map(v => (
                        <span key={v} className="px-2 py-1 bg-white/80 backdrop-blur-sm border border-slate-200 text-slate-600 text-[10px] font-bold rounded-md">{v}</span>
                      ))}
                    </div>
                  </div>

                  <button 
                    onClick={() => startRoleplay(scenario)}
                    className="w-full py-4 bg-[#DDF7EA]/80 backdrop-blur-sm border border-emerald-100 text-[#08A66A] font-black rounded-2xl group-hover:bg-[#08A66A] group-hover:text-white transition-colors uppercase tracking-widest shadow-sm flex items-center justify-center gap-2 relative z-10 text-xs"
                  >
                    Vào Tình Huống <span>→</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================
            PHASE 4: FREE CHAT
            ========================================= */}
        {phase === "free_chat" && (
          <div className="w-full max-w-[900px] h-[calc(100vh-140px)] flex flex-col gap-6 animate-fade-in">
            <button 
              onClick={() => setPhase("mode_selection")}
              className="flex items-center gap-2 px-5 py-3 bg-white/80 backdrop-blur-md rounded-2xl font-bold text-sm text-slate-600 shadow-sm border border-emerald-50 hover:text-rose-500 hover:border-rose-200 transition-all w-fit shrink-0"
            >
              <span>←</span> Thoát Chat
            </button>

            <section className="flex-1 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-lg shadow-emerald-900/5 border border-white flex flex-col overflow-hidden relative">
              <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white/50 z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-lg">🐼</div>
                  <span className="font-bold text-slate-800">Xiao Qingwa</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <div className="w-2 h-2 rounded-full bg-[#08A66A] animate-pulse"></div>
                    <span className="text-[10px] font-bold text-[#08A66A] uppercase tracking-widest">Đang trực tuyến</span>
                  </div>
                </div>
                <button onClick={() => startFreeChat()} className="text-xs font-bold text-slate-400 hover:text-rose-500 transition">Làm mới chat</button>
              </div>

              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar scroll-smooth">
                {chatHistory.map((msg, i) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={i} className="flex flex-col items-end w-full animate-fade-in">
                        <div className="flex items-start gap-3 flex-row-reverse mb-1">
                          <div className="w-10 h-10 rounded-full bg-[#08A66A] text-white flex items-center justify-center text-xl shadow-sm shrink-0">🐸</div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mb-1">Bạn</p>
                            <div className="bg-[#08A66A] text-white p-4 rounded-2xl rounded-tr-sm shadow-sm max-w-[85%] sm:max-w-[75%] ml-auto">
                              <p className="text-[17px] font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return <div key={i}>{renderAiMessage(msg, i)}</div>;
                  }
                })}
                {isChatting && (
                  <div className="flex items-start gap-3 w-full animate-fade-in">
                    <div className="w-10 h-10 rounded-full bg-white border-2 border-emerald-100 flex items-center justify-center text-xl shadow-sm shrink-0 opacity-70 grayscale">🐼</div>
                    <div className="bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex items-center gap-1.5 h-12">
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border-t border-slate-100 p-4 md:p-6 shrink-0 relative z-10 flex flex-col gap-4">
                <div className="flex justify-center mb-2">
                  <div className="bg-slate-100 p-1 rounded-full flex gap-1 border border-slate-200">
                    <button onClick={() => setInputMode("voice")} className={`px-6 py-1.5 rounded-full text-xs font-black transition-all ${inputMode === "voice" ? 'bg-white text-[#08A66A] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>🎙️ Giọng nói</button>
                    <button onClick={() => setInputMode("text")} className={`px-6 py-1.5 rounded-full text-xs font-black transition-all ${inputMode === "text" ? 'bg-white text-[#08A66A] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>⌨️ Bàn phím</button>
                  </div>
                </div>

                {inputMode === "voice" ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <button onMouseDown={handleVoiceHold} onMouseUp={() => {}} className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl shadow-xl transition-all border-4 relative ${isRecording ? 'bg-rose-500 border-rose-200 text-white scale-110 shadow-rose-500/30' : 'bg-[#08A66A] border-[#DDF7EA] text-white hover:bg-[#087A55] hover:scale-105'}`}>
                      {isRecording && <div className="absolute inset-0 border-4 border-rose-400 rounded-full animate-ping opacity-50"></div>}
                      🎙️
                    </button>
                    <p className={`mt-6 font-black tracking-widest uppercase text-sm ${isRecording ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>{isRecording ? "Đang nghe..." : "Nhấn để nói"}</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitMessage(); }} placeholder="Gõ tiếng Trung tại đây..." className="flex-1 bg-slate-50 border-2 border-slate-100 text-slate-800 font-medium text-base rounded-2xl px-5 py-4 outline-none focus:border-[#08A66A] focus:bg-white transition-colors" disabled={isChatting} />
                    <button onClick={() => submitMessage()} disabled={isChatting || !chatInput.trim()} className="bg-[#08A66A] text-white font-black text-sm px-8 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#087A55] shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 uppercase tracking-wider">Gửi</button>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* =========================================
            PHASE 5: TRONG PHÒNG NHẬP VAI TÌNH HUỐNG (ROLEPLAYING)
            ========================================= */}
        {phase === "roleplaying" && activeScenario && (
          <div className="w-full max-w-[1400px] h-[calc(100vh-140px)] flex flex-col lg:flex-row gap-6 animate-fade-in">
            
            {/* CỘT TRÁI: SIDEBAR THÔNG TIN & NHIỆM VỤ */}
            <aside className="w-full lg:w-[340px] flex flex-col gap-6 shrink-0">
              <button 
                onClick={() => setPhase("scenario_selection")}
                className="flex items-center gap-2 px-5 py-3 bg-white/80 backdrop-blur-md rounded-2xl font-bold text-sm text-slate-600 shadow-sm border border-emerald-50 hover:text-rose-500 hover:border-rose-200 transition-all w-fit"
              >
                <span>←</span> Bỏ cuộc
              </button>

              <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-emerald-50 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                
                <div className="text-center mb-6 pb-6 border-b border-slate-100">
                  <div className="text-5xl mb-3">{activeScenario.icon}</div>
                  <span className="text-[10px] font-black text-[#08A66A] uppercase tracking-widest">{activeScenario.level}</span>
                  <h2 className="text-2xl font-black text-slate-800 mt-1">{activeScenario.title}</h2>
                  <div className="mt-4 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 bg-slate-50 py-2 rounded-xl border border-slate-100">
                    <span>Bạn: {activeScenario.userRole}</span>
                    <span className="text-slate-300">|</span>
                    <span>AI: {activeScenario.aiRole}</span>
                  </div>
                </div>

                <div className="mb-6 flex-1">
                  <h3 className="text-sm font-black text-slate-800 flex items-center gap-2 mb-4">
                    <span>🎯</span> Mục tiêu giao tiếp
                  </h3>
                  <div className="space-y-3">
                    {activeScenario.missions.map((mission, idx) => {
                      const isDone = completedMissions.includes(idx);
                      return (
                        <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${isDone ? 'bg-[#DDF7EA] border-[#08A66A]/30' : 'bg-slate-50 border-slate-100'}`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5 ${isDone ? 'bg-[#08A66A] text-white' : 'bg-white border-2 border-slate-300 text-transparent'}`}>
                            {isDone ? '✓' : ''}
                          </div>
                          <p className={`text-sm font-medium ${isDone ? 'text-[#087A55] line-through opacity-80' : 'text-slate-700'}`}>
                            {mission}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 bg-[#FFF8E8] p-3 rounded-xl border border-[#FFC83D]/30">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Phần thưởng</p>
                    <p className="text-sm font-bold text-amber-800">Hoàn thành để nhận ⭐ +{activeScenario.xp} XP</p>
                  </div>
                </div>

                <button onClick={finishRoleplay} className="w-full py-4 bg-[#172033] text-white font-black text-sm rounded-2xl shadow-xl hover:bg-slate-800 transition-all hover:-translate-y-1 uppercase tracking-widest mt-auto">
                  Kết thúc hội thoại
                </button>
              </div>
            </aside>

            {/* CỘT PHẢI: KHU VỰC CHAT & VOICE INPUT */}
            <section className="flex-1 bg-white/95 backdrop-blur-xl rounded-[32px] shadow-lg shadow-emerald-900/5 border border-white flex flex-col overflow-hidden relative">
              
              <div className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white/50 z-10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#F4F8F5] border border-emerald-100 flex items-center justify-center text-lg">{activeScenario.aiAvatar}</div>
                  <span className="font-bold text-slate-800">{activeScenario.aiName}</span>
                  <div className="flex items-center gap-1.5 ml-2">
                    <div className="w-2 h-2 rounded-full bg-[#08A66A] animate-pulse"></div>
                    <span className="text-[10px] font-bold text-[#08A66A] uppercase tracking-widest">Đang trực tuyến</span>
                  </div>
                </div>
                <button onClick={() => setChatHistory([{ role: 'assistant', content: activeScenario.greeting, showTranslation: false, showCoach: false }])} className="text-xs font-bold text-slate-400 hover:text-rose-500 transition">
                  Làm mới tình huống
                </button>
              </div>

              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 custom-scrollbar scroll-smooth">
                {chatHistory.map((msg, i) => {
                  if (msg.role === 'user') {
                    return (
                      <div key={i} className="flex flex-col items-end w-full animate-fade-in">
                        <div className="flex items-start gap-3 flex-row-reverse mb-1">
                          <div className="w-10 h-10 rounded-full bg-[#08A66A] text-white flex items-center justify-center text-xl shadow-sm shrink-0">🐸</div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right mb-1">Bạn</p>
                            <div className="bg-[#08A66A] text-white p-4 rounded-2xl rounded-tr-sm shadow-sm max-w-[85%] sm:max-w-[75%] ml-auto">
                              <p className="text-[17px] font-medium leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    return <div key={i}>{renderAiMessage(msg, i)}</div>;
                  }
                })}
                {isChatting && (
                  <div className="flex items-start gap-3 w-full animate-fade-in">
                    <div className="w-10 h-10 rounded-full bg-white border-2 border-emerald-100 flex items-center justify-center text-xl shadow-sm shrink-0 opacity-70 grayscale">{activeScenario.aiAvatar}</div>
                    <div className="bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex items-center gap-1.5 h-12">
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white border-t border-slate-100 p-4 md:p-6 shrink-0 relative z-10 flex flex-col gap-4">
                <div className="flex justify-center mb-2">
                  <div className="bg-slate-100 p-1 rounded-full flex gap-1 border border-slate-200">
                    <button onClick={() => setInputMode("voice")} className={`px-6 py-1.5 rounded-full text-xs font-black transition-all ${inputMode === "voice" ? 'bg-white text-[#08A66A] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>🎙️ Giọng nói</button>
                    <button onClick={() => setInputMode("text")} className={`px-6 py-1.5 rounded-full text-xs font-black transition-all ${inputMode === "text" ? 'bg-white text-[#08A66A] shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>⌨️ Bàn phím</button>
                  </div>
                </div>

                {inputMode === "voice" ? (
                  <div className="flex flex-col items-center justify-center py-4">
                    <button onMouseDown={handleVoiceHold} onMouseUp={() => {}} className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl shadow-xl transition-all border-4 relative ${isRecording ? 'bg-rose-500 border-rose-200 text-white scale-110 shadow-rose-500/30' : 'bg-[#08A66A] border-[#DDF7EA] text-white hover:bg-[#087A55] hover:scale-105'}`}>
                      {isRecording && <div className="absolute inset-0 border-4 border-rose-400 rounded-full animate-ping opacity-50"></div>}
                      🎙️
                    </button>
                    <p className={`mt-6 font-black tracking-widest uppercase text-sm ${isRecording ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`}>{isRecording ? "Đang nghe..." : "Nhấn để nói"}</p>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submitMessage(); }} placeholder="Gõ tiếng Trung tại đây..." className="flex-1 bg-slate-50 border-2 border-slate-100 text-slate-800 font-medium text-base rounded-2xl px-5 py-4 outline-none focus:border-[#08A66A] focus:bg-white transition-colors" disabled={isChatting} />
                    <button onClick={() => submitMessage()} disabled={isChatting || !chatInput.trim()} className="bg-[#08A66A] text-white font-black text-sm px-8 rounded-2xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#087A55] shadow-lg shadow-emerald-600/20 transition-all hover:-translate-y-0.5 uppercase tracking-wider">Gửi</button>
                  </div>
                )}
              </div>

            </section>
          </div>
        )}

        {/* =========================================
            PHASE 6: BÁO CÁO KẾT QUẢ ROLEPLAY (REPORT)
            ========================================= */}
        {phase === "report" && activeScenario && (
          <div className="w-full max-w-2xl animate-slide-up-fade mt-10">
            <div className="bg-white/95 backdrop-blur-xl rounded-[40px] shadow-2xl border border-white p-10 md:p-14 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#DDF7EA] to-transparent rounded-bl-full pointer-events-none opacity-50"></div>
              
              <div className="text-center relative z-10">
                <div className="text-8xl mb-6">🎉</div>
                <p className="text-[10px] font-black text-[#08A66A] uppercase tracking-widest mb-2">Hoàn thành Roleplay</p>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-8">{activeScenario.title}</h2>
              </div>

              <div className="bg-slate-50 rounded-[24px] p-6 mb-8 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                  <span className="font-bold text-slate-600">Lượt hội thoại</span>
                  <span className="font-black text-slate-900">{chatHistory.filter(m => m.role==='user').length} lượt</span>
                </div>
                <div className="flex justify-between items-center mb-6">
                  <span className="font-bold text-slate-600">Nhiệm vụ hoàn thành</span>
                  <span className={`font-black ${completedMissions.length === activeScenario.missions.length ? 'text-[#08A66A]' : 'text-amber-500'}`}>
                    {completedMissions.length} / {activeScenario.missions.length}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5"><span>Độ trôi chảy & Tự nhiên</span><span>85%</span></div>
                    <div className="w-full h-2 bg-slate-200 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{width: '85%'}}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-1.5"><span>Từ vựng & Ngữ pháp</span><span>92%</span></div>
                    <div className="w-full h-2 bg-slate-200 rounded-full"><div className="h-full bg-purple-500 rounded-full" style={{width: '92%'}}></div></div>
                  </div>
                </div>
              </div>

              <div className="bg-[#FFF8E8] border border-[#FFC83D]/40 rounded-2xl p-6 mb-10 text-center shadow-inner">
                <p className="text-sm font-bold text-amber-700 mb-1">Kinh nghiệm nhận được</p>
                <p className="text-4xl font-black text-[#FFC83D] drop-shadow-sm">⭐ +{activeScenario.xp} XP</p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 relative z-10">
                <button 
                  onClick={() => setPhase("scenario_selection")}
                  className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 font-black rounded-2xl hover:border-slate-300 hover:bg-slate-50 transition uppercase tracking-widest text-sm"
                >
                  Tình huống khác
                </button>
                <button 
                  onClick={() => startRoleplay(activeScenario)}
                  className="flex-1 py-4 bg-[#08A66A] text-white font-black rounded-2xl shadow-xl hover:bg-[#087A55] hover:-translate-y-1 transition uppercase tracking-widest text-sm"
                >
                  Thử lại lần nữa
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}