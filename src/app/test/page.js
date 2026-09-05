"use client";
import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import Link from "next/link";

// Import đúng nguồn dữ liệu theo yêu cầu
import arrangeData from "../arrange.json";    // Data câu dịch
import sentencesData from "../sentences.json"; // Data câu sắp xếp

// Hàm trộn mảng dùng cho việc xáo trộn từ trong câu sắp xếp
function shuffleArray(array) {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
}

function getRandomItems(arr, n) {
  if (!arr || !Array.isArray(arr)) return [];
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, n);
}

// KHỞI TẠO ĐỀ THI
async function generatePlacementTest(level) {
  try {
    let levelStr = `HSK${level}`;
    let levelStrSpace = `HSK ${level}`;
    const filterByLevel = (item) => item.level === levelStr || item.level === levelStrSpace || item.level == level;

    // Lọc dữ liệu theo cấp độ
    const translateFiltered = arrangeData.filter(filterByLevel);
    const arrangeFiltered = sentencesData.filter(filterByLevel);

    // Lấy 10 câu Dịch
    const translateSection = getRandomItems(translateFiltered.length >= 10 ? translateFiltered : arrangeData, 10);
    
    // Lấy 10 câu Sắp xếp và xáo trộn chữ Hán sẵn
    const arrangeSection = getRandomItems(arrangeFiltered.length >= 10 ? arrangeFiltered : sentencesData, 10).map(item => {
      const chars = (item.chinese || item.front || "").replace(/[.!?。，？！、\s]/g, '').split('');
      const scrambled = shuffleArray([...chars]).join(' - ');
      return { ...item, scrambled };
    });

    // Lấy 2 câu Nghị luận (Chỉ dành cho HSK 3-6)
    let essaySection = [];
    if (level >= 3) {
      try {
        const shortData = await import(`@/app/data/hskk/hskk${level}/short.json`).catch(() => ({ default: [] }));
        const rawArr = shortData.default || [];
        essaySection = getRandomItems(rawArr, 2).map(item => typeof item === 'string' ? { prompt: item } : item);
      } catch (e) {
        essaySection = [];
      }
      
      // Fallback nếu không tải được file JSON nghị luận
      if (essaySection.length === 0) {
        essaySection = [
          { prompt: `Phần viết luận 1 (HSK ${level}): Bạn hãy chia sẻ về một sở thích cá nhân bằng tiếng Trung.` },
          { prompt: `Phần viết luận 2 (HSK ${level}): Theo bạn, việc học tiếng Trung mang lại những lợi ích gì?` }
        ];
      }
    }

    let testPackage = {
      level: level,
      maxScore: level <= 2 ? 200 : 300,
      sections: {
        translate: translateSection,
        arrange: arrangeSection,
        essay: essaySection
      }
    };

    return { success: true, test: testPackage };
  } catch (error) {
    console.error("Lỗi tạo đề test:", error);
    return { success: false, message: "Không thể khởi tạo đề thi cho cấp độ này." };
  }
}

// ĐÁNH GIÁ KẾT QUẢ THEO THANG ĐIỂM MỚI
function evaluateTestResult(level, totalScore) {
  const isHSK12 = level <= 2;
  const maxScore = isHSK12 ? 200 : 300;
  const passScore = isHSK12 ? 120 : 180;
  const recommendScore = isHSK12 ? 150 : 230;

  if (totalScore < passScore) {
    return {
      status: "FAIL",
      message: `Bạn đạt ${totalScore}/${maxScore} điểm. Chưa đạt mức tối thiểu (${passScore} điểm) để vượt qua bài đánh giá năng lực HSK ${level}.`,
      score: totalScore,
      maxScore: maxScore
    };
  } else if (totalScore < recommendScore) {
    return {
      status: "PASS_WARN",
      message: `Bạn đạt ${totalScore}/${maxScore} điểm. Bạn ĐÃ QUA môn, nhưng điểm số nằm trong vùng rủi ro. Khuyến nghị bạn nên ôn tập lại kiến thức cấp độ HSK ${level} để nền tảng vững vàng hơn.`,
      score: totalScore,
      maxScore: maxScore
    };
  } else {
    return {
      status: "EXCELLENT",
      message: `🎉 Xuất sắc! Bạn đạt ${totalScore}/${maxScore} điểm. Kiến thức của bạn rất vững, hoàn toàn đủ khả năng chinh phục cấp độ tiếp theo!`,
      score: totalScore,
      maxScore: maxScore
    };
  }
}

export default function PlacementTestPage() {
  const { user } = useUser();
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const handleStartTest = async (level) => {
    setSelectedLevel(level);
    setLoading(true);
    const res = await generatePlacementTest(level);
    if (res.success) {
      setTestData(res.test);
      setAnswers({});
    } else {
      alert(res.message);
    }
    setLoading(false);
  };

  const handleAnswerChange = (section, index, value) => {
    setAnswers(prev => ({
      ...prev,
      [`${section}_${index}`]: value
    }));
  };

  const handleSubmit = async () => {
    const isHSK12 = selectedLevel <= 2;

    // 1. CHẤM ĐIỂM PHẦN DỊCH CÂU (Tối đa 100 điểm - Chấm theo NGỮ NGHĨA linh hoạt)
    let translateScore = 0;
    testData.sections.translate?.forEach((item, idx) => {
      const userAns = (answers[`translate_${idx}`] || "").trim().replace(/\s+/g, "");
      const correctAns = (item.chinese || item.front || "").trim().replace(/\s+/g, "").replace(/[.!?。，？！、]/g, "");
      
      if (userAns.length > 0) {
        // Thuật toán mô phỏng sự tương đồng ngữ nghĩa bằng độ phủ ký tự
        let matchCount = 0;
        for (let char of correctAns) {
          if (userAns.includes(char)) matchCount++;
        }
        const matchRatio = matchCount / correctAns.length;

        if (userAns === correctAns) {
          translateScore += 10; // Đúng 100% -> 10đ/câu
        } else if (matchRatio >= 0.8) {
          translateScore += 8;  // Hợp lý, đủ ý chính -> 8đ/câu
        } else if (matchRatio >= 0.5) {
          translateScore += 5;  // Đúng được một nửa -> 5đ/câu
        } else if (matchRatio > 0) {
          translateScore += 2;  // Có từ khóa đúng -> 2đ/câu
        }
      }
    });

    // 2. CHẤM ĐIỂM PHẦN SẮP XẾP (Tối đa 100 điểm - Bắt buộc đúng thứ tự)
    let arrangeCorrectCount = 0;
    const arrangeTotal = testData.sections.arrange?.length || 10;
    testData.sections.arrange?.forEach((item, idx) => {
      const userAns = (answers[`arrange_${idx}`] || "").trim().replace(/\s+/g, "");
      const correctAns = (item.chinese || item.front || "").trim().replace(/\s+/g, "").replace(/[.!?。，？！、]/g, "");
      if (userAns === correctAns && userAns.length > 0) arrangeCorrectCount++;
    });
    const arrangeScore = (arrangeCorrectCount / arrangeTotal) * 100; // 100 điểm tối đa

    // 3. CHẤM ĐIỂM PHẦN NGHỊ LUẬN (Chỉ HSK 3-6) (Tối đa 100 điểm)
    let essayScore = 0;
    if (!isHSK12) {
      const essayTotal = testData.sections.essay?.length || 2; // 2 câu
      let currentEssayScore = 0;
      testData.sections.essay?.forEach((item, idx) => {
        const ans = (answers[`essay_${idx}`] || "").trim();
        // Điểm max mỗi câu là 50đ. Tạm mô phỏng chấm dựa theo độ dài và nỗ lực viết.
        if (ans.length >= 40) currentEssayScore += 50;
        else if (ans.length >= 20) currentEssayScore += 35;
        else if (ans.length > 0) currentEssayScore += 15;
      });
      essayScore = currentEssayScore;
    }

    const totalCalculatedScore = Math.round(translateScore + arrangeScore + essayScore);
    const evaluation = evaluateTestResult(selectedLevel, totalCalculatedScore);
    setResult(evaluation);

    // Lưu vào Firebase nếu pass (Điểm >= mức Pass quy định ở evaluateTestResult)
    const passThreshold = isHSK12 ? 120 : 180;
    if (totalCalculatedScore >= passThreshold && user) {
      try {
        const studentRef = doc(db, "progress", user.id);
        let updateData = {};
        for (let i = 1; i <= selectedLevel; i++) {
          updateData[`passedHSK${i}`] = true;
        }
        await setDoc(studentRef, updateData, { merge: true });
      } catch (error) {
        console.error("Lỗi cập nhật tiến độ:", error);
      }
    }
  };

  // --- MÀN HÌNH CHỌN CẤP ĐỘ ---
  if (!selectedLevel) {
    return (
      <main className="min-h-screen bg-[#F4F8F5] relative selection:bg-emerald-200">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-40"
          style={{ backgroundImage: "url('/hskk/kiemtra.jpg')" }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#F4F8F5]/90 to-[#F4F8F5]/40 backdrop-blur-[2px]"></div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center">
          <div className="w-full flex justify-start mb-8">
             <Link href="/">
               <button className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl font-bold text-sm text-slate-600 shadow-sm border border-emerald-50 hover:text-[#08A66A] transition-all">
                 <span>←</span> Trang chủ
               </button>
             </Link>
          </div>

          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-white rounded-3xl mx-auto flex items-center justify-center text-4xl mb-6 shadow-sm border border-emerald-100/50">🎯</div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Đánh Giá Năng Lực</h1>
            <p className="text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
              Vượt qua bài kiểm tra để chứng minh năng lực và mở khóa các cấp độ HSK cao hơn trong hệ thống.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full">
            {[1, 2, 3, 4, 5, 6].map((lvl) => (
              <div
                key={lvl}
                onClick={() => handleStartTest(lvl)}
                className="bg-white p-8 rounded-[32px] shadow-sm border-2 border-transparent hover:border-[#08A66A] hover:shadow-xl hover:-translate-y-2 transition-all cursor-pointer group relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#DDF7EA]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <h2 className="text-3xl font-black text-slate-800 group-hover:text-[#08A66A] transition-colors mb-2 relative z-10">
                  HSK {lvl}
                </h2>
                <div className="w-8 h-1 bg-slate-100 group-hover:bg-[#08A66A] rounded-full mb-4 transition-colors relative z-10"></div>
                
                <p className="text-xs text-slate-500 font-medium relative z-10">
                  {lvl <= 2 ? "2 Phần (Dịch, Sắp xếp)" : "3 Phần (Dịch, Xếp, Viết)"}
                </p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 relative z-10">
                  Tổng {lvl <= 2 ? 200 : 300} điểm
                </p>
                
                <div className="mt-6 w-10 h-10 rounded-full bg-slate-50 group-hover:bg-[#08A66A] text-slate-400 group-hover:text-white flex items-center justify-center transition-colors relative z-10 shadow-inner">
                  <span className="font-black">→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // --- MÀN HÌNH LOADING ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F8F5] flex flex-col items-center justify-center relative">
        <div className="text-6xl mb-6 animate-bounce">🐸</div>
        <h3 className="text-xl font-black text-[#08A66A] uppercase tracking-widest">Đang tải đề thi HSK {selectedLevel}...</h3>
        <p className="text-slate-500 text-sm mt-2 font-medium">Chuẩn bị tinh thần nào!</p>
      </div>
    );
  }

  // --- MÀN HÌNH KẾT QUẢ MỚI (PHÙ HỢP LOGIC 3 TRẠNG THÁI) ---
  if (result) {
    const isFailed = result.status === "FAIL";
    const isWarn = result.status === "PASS_WARN";
    const isExcellent = result.status === "EXCELLENT";
    
    // Cấu hình giao diện tùy theo trạng thái
    const config = {
      FAIL: { icon: '💦', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', title: 'Chưa đạt yêu cầu!' },
      PASS_WARN: { icon: '⚠️', color: 'text-amber-500', bg: 'bg-[#FFF8E8]', border: 'border-[#FFC83D]/30', title: 'Khuyến nghị học lại!' },
      EXCELLENT: { icon: '🏆', color: 'text-[#08A66A]', bg: 'bg-[#DDF7EA]', border: 'border-[#08A66A]/20', title: 'Chúc mừng bạn!' }
    };
    const ui = config[result.status];

    return (
      <main className="min-h-screen bg-[#F4F8F5] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-20" style={{ backgroundImage: "url('/hskk/kiemtra.jpg')" }}></div>
        <div className="absolute inset-0 bg-[#F4F8F5]/80 backdrop-blur-md"></div>
        
        <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl border border-white max-w-lg w-full text-center relative z-10 flex flex-col items-center animate-slide-up-fade">
          
          {/* Vòng tròn biểu tượng */}
          <div className="w-28 h-28 rounded-full bg-slate-50 flex items-center justify-center text-5xl shadow-inner border border-slate-100 mb-6 relative">
            {ui.icon}
            {!isFailed && <div className={`absolute -inset-2 rounded-full border-4 ${isExcellent ? 'border-[#08A66A]' : 'border-amber-400'} border-dashed animate-[spin_10s_linear_infinite] opacity-30`}></div>}
          </div>
          
          <h2 className={`text-3xl font-black mb-2 ${ui.color}`}>
            {ui.title}
          </h2>
          
          {/* Bảng điểm tổng kết */}
          <div className={`p-8 rounded-[32px] w-full my-8 relative overflow-hidden border ${ui.bg} ${ui.border}`}>
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-bl-full opacity-30 ${isFailed ? 'bg-white/50' : 'bg-white'}`}></div>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Điểm tổng kết</p>
            <p className={`text-7xl font-black relative z-10 ${ui.color}`}>
              {result.score} <span className="text-3xl opacity-50 font-bold">/ {result.maxScore}</span>
            </p>
          </div>

          <p className="text-slate-600 font-medium mb-10 leading-relaxed px-2 text-sm">
            {result.message}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full">
            {(isFailed || isWarn) && (
              <button 
                onClick={() => { setResult(null); handleStartTest(selectedLevel); }}
                className="flex-1 px-6 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:border-slate-300 transition-colors"
              >
                Thử lại lần nữa
              </button>
            )}
            <Link href="/" className="flex-1 w-full">
              <button className="w-full px-6 py-4 bg-[#172033] text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition-colors uppercase tracking-widest">
                Về Trang Chủ
              </button>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const isHSK12 = selectedLevel <= 2;

  // --- MÀN HÌNH LÀM BÀI CHÍNH ---
  return (
    <main className="min-h-screen bg-[#F4F8F5] pb-20 relative selection:bg-emerald-200">
      
      {/* Header làm bài cố định */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#DDF7EA] rounded-2xl flex items-center justify-center text-[#08A66A] text-2xl shadow-inner border border-emerald-50">🎯</div>
            <div>
              <h1 className="font-black text-slate-800 text-lg">Bài Đánh Giá Năng Lực HSK {selectedLevel}</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isHSK12 ? "2 Phần • Tổng 200 điểm" : "3 Phần • Tổng 300 điểm"}</p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (window.confirm("Bạn có chắc chắn muốn hủy bài thi này không?")) setSelectedLevel(null);
            }} 
            className="px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl text-xs font-bold transition-colors border border-rose-100"
          >
            Hủy bài thi
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 mt-8 space-y-8 animate-fade-in">
        
        {/* Phần 1: Dịch Câu */}
        {testData?.sections?.translate && testData.sections.translate.length > 0 && (
          <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <span className="text-2xl">✍️</span>
              <div>
                <h3 className="text-xl font-black text-slate-800">Phần 1: Dịch Câu</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">10 Câu • 100 điểm</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {testData.sections.translate.map((item, idx) => (
                <div key={`trans-${idx}`} className="bg-[#F4F8F5] p-6 rounded-[24px] border border-emerald-50">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-white text-slate-400 text-xs font-bold flex items-center justify-center shadow-sm border border-slate-200">{idx + 1}</span>
                    <p className="font-bold text-slate-700 text-lg mt-0.5">
                      {item.vietnamese || item.front}
                    </p>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Nhập bản dịch tiếng Trung (Chữ Hán)..."
                    value={answers[`translate_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("translate", idx, e.target.value)}
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl text-base outline-none focus:border-[#08A66A] focus:ring-4 focus:ring-[#08A66A]/10 bg-white font-medium text-slate-800 transition-all placeholder:text-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phần 2: Sắp xếp câu */}
        {testData?.sections?.arrange && testData.sections.arrange.length > 0 && (
          <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <span className="text-2xl">🧩</span>
              <div>
                <h3 className="text-xl font-black text-slate-800">Phần 2: Sắp Xếp Câu</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">10 Câu • 100 điểm</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {testData.sections.arrange.map((item, idx) => (
                <div key={`arr-${idx}`} className="bg-[#F4F8F5] p-6 rounded-[24px] border border-emerald-50">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-white text-slate-400 text-xs font-bold flex items-center justify-center shadow-sm border border-slate-200">{idx + 1}</span>
                    <div className="flex-1">
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Sắp xếp các từ sau thành câu đúng:</p>
                      <div className="flex flex-wrap gap-2">
                         {item.scrambled.split(' - ').map((char, i) => (
                             <span key={i} className="px-4 py-2 bg-white border border-emerald-200 text-[#087A55] font-black rounded-xl shadow-sm text-lg cursor-default select-none">{char}</span>
                         ))}
                      </div>
                    </div>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Gõ lại câu hoàn chỉnh..."
                    value={answers[`arrange_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("arrange", idx, e.target.value)}
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl text-base outline-none focus:border-[#08A66A] focus:ring-4 focus:ring-[#08A66A]/10 bg-white font-medium text-slate-800 transition-all placeholder:text-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phần 3: Viết Luận (Chỉ HSK 3-6) */}
        {!isHSK12 && testData?.sections?.essay && testData.sections.essay.length > 0 && (
          <div className="bg-white rounded-[32px] p-8 md:p-10 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
              <span className="text-2xl">📝</span>
              <div>
                <h3 className="text-xl font-black text-slate-800">Phần 3: Viết Luận / Phản Xạ</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">2 Câu • 100 điểm</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {testData.sections.essay.map((item, idx) => (
                <div key={`essay-${idx}`} className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-4">
                    <p className="font-bold text-slate-800 text-sm leading-relaxed">
                      <span className="text-rose-500 font-black mr-2">Q{idx + 1}:</span>
                      {item.prompt}
                    </p>
                  </div>
                  
                  <textarea 
                    rows={4}
                    placeholder="Viết câu trả lời bằng tiếng Trung tại đây..."
                    value={answers[`essay_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("essay", idx, e.target.value)}
                    className="w-full p-5 border-2 border-slate-200 rounded-2xl text-base outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-400/10 bg-white font-medium text-slate-800 transition-all resize-none placeholder:text-slate-300"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nút Submit */}
        <div className="pt-8 pb-10 flex justify-center">
          <button 
            type="button"
            onClick={handleSubmit}
            className="w-full md:w-auto md:min-w-[300px] py-5 px-8 bg-[#08A66A] text-white rounded-2xl font-black shadow-xl shadow-emerald-600/20 hover:bg-[#087A55] hover:-translate-y-1 transition-all text-lg tracking-wide flex items-center justify-center gap-3 uppercase"
          >
            <span>✓</span> Nộp Bài & Xem Điểm
          </button>
        </div>

      </div>
    </main>
  );
}