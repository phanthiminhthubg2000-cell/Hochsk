"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import Link from "next/link";
import { logUserError, updateUserProgress } from "../../lib/firebaseUtils";

// Import đúng nguồn dữ liệu
import arrangeData from "../arrange.json";    
import sentencesData from "../sentences.json"; 

// --- HÀM HỖ TRỢ ---
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

// Thuật toán cắt từ tiếng Trung thông minh (Word Chunking)
const segmentWords = (text) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    return [...segmenter.segment(text)]
      .map(s => s.segment)
      .filter(s => !/^[.,?!。，？！、\s]+$/.test(s)); 
  }
  return text.replace(/[.!?。，？！、\s]/g, '').split(''); 
};

// --- COMPONENT: SẮP XẾP CÂU CLICK-TO-SELECT ---
function ArrangeQuestion({ item, index, onChange }) {
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    const words = segmentWords(item.chinese || item.front || "");
    const initialScrambled = shuffleArray([...words]).map((w, i) => ({ id: i, text: w }));
    setAvailable(initialScrambled);
    setSelected([]);
  }, [item]);

  useEffect(() => {
    onChange(selected.map(s => s.text).join(""));
  }, [selected]);

  const handleSelect = (word) => {
    setAvailable(available.filter(w => w.id !== word.id));
    setSelected([...selected, word]);
  };

  const handleDeselect = (word) => {
    setSelected(selected.filter(w => w.id !== word.id));
    setAvailable([...available, word]);
  };

  return (
    <div className="bg-[#F4F8F5] p-6 rounded-[24px] border border-emerald-50">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-6 h-6 shrink-0 rounded-full bg-white text-slate-400 text-xs font-bold flex items-center justify-center shadow-sm border border-slate-200">{index + 1}</span>
        <div className="flex-1 w-full">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Sắp xếp các từ sau thành câu đúng:</p>
          
          {/* Khu vực ghép câu */}
          <div className="min-h-[60px] p-4 bg-white border-2 border-dashed border-emerald-200 rounded-2xl mb-4 flex flex-wrap gap-2 items-center transition-all">
            {selected.length === 0 && <span className="text-slate-300 text-sm italic">Chạm vào từ bên dưới để ghép lên đây...</span>}
            {selected.map(w => (
              <button 
                key={w.id} 
                onClick={() => handleDeselect(w)} 
                className="px-4 py-2 bg-[#DDF7EA] text-[#08A66A] font-black rounded-xl shadow-sm text-lg hover:bg-rose-50 hover:text-rose-500 hover:line-through transition-all"
              >
                {w.text}
              </button>
            ))}
          </div>

          {/* Khu vực từ vựng */}
          <div className="flex flex-wrap gap-2">
            {available.map(w => (
              <button 
                key={w.id} 
                onClick={() => handleSelect(w)} 
                className="px-4 py-2 bg-white border border-emerald-200 text-[#087A55] font-black rounded-xl shadow-[0_2px_8px_rgba(8,166,106,0.08)] text-lg hover:border-[#08A66A] hover:-translate-y-0.5 transition-all"
              >
                {w.text}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


// --- MAIN COMPONENT ---
export default function PlacementTestPage() {
  const { user } = useUser();
  
  const [testMode, setTestMode] = useState(null); // 'level' hoặc 'comprehensive'
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [showReview, setShowReview] = useState(false);

  // 1. TẠO ĐỀ THEO CẤP ĐỘ CỤ THỂ
  const startLevelTest = async (level) => {
    setTestMode('level');
    setSelectedLevel(level);
    setLoading(true);
    
    let levelStr = `HSK${level}`;
    let levelStrSpace = `HSK ${level}`;
    const filterByLevel = (item) => item.level === levelStr || item.level === levelStrSpace || item.level == level;

    const translateFiltered = arrangeData.filter(filterByLevel);
    const arrangeFiltered = sentencesData.filter(filterByLevel);

    const testPackage = {
      level: level,
      type: 'level',
      sections: {
        translate: getRandomItems(translateFiltered.length >= 10 ? translateFiltered : arrangeData, 10),
        arrange: getRandomItems(arrangeFiltered.length >= 10 ? arrangeFiltered : sentencesData, 10),
        essay: []
      }
    };

    if (level >= 3) {
      try {
        const shortData = await import(`@/app/data/hskk/hskk${level}/short.json`).catch(() => ({ default: [] }));
        const rawArr = shortData.default || [];
        testPackage.sections.essay = getRandomItems(rawArr, 2).map(item => typeof item === 'string' ? { prompt: item } : item);
      } catch (e) {
        testPackage.sections.essay = [
          { prompt: `Phần viết luận 1 (HSK ${level}): Hãy chia sẻ quan điểm của bạn bằng tiếng Trung.` },
          { prompt: `Phần viết luận 2 (HSK ${level}): Bạn nghĩ tiếng Trung giúp ích gì cho công việc của bạn?` }
        ];
      }
    }

    setTestData(testPackage);
    setAnswers({});
    setResult(null);
    setShowReview(false);
    setLoading(false);
  };

  // 2. TẠO ĐỀ TỔNG HỢP 30 CÂU (AI DIAGNOSTIC)
  const startComprehensiveTest = () => {
    setTestMode('comprehensive');
    setLoading(true);
    
    const translateQuestions = [];
    for (let i = 1; i <= 6; i++) {
      let lvlStr = `HSK ${i}`;
      let lvlStr2 = `HSK${i}`;
      const levelData = arrangeData.filter(item => item.level === lvlStr || item.level === lvlStr2 || item.level == i);
      const selected = getRandomItems(levelData.length > 0 ? levelData : arrangeData, 5).map(item => ({...item, originLevel: i}));
      translateQuestions.push(...selected);
    }

    setTestData({
      type: 'comprehensive',
      sections: { translate: translateQuestions }
    });
    setAnswers({});
    setResult(null);
    setShowReview(false);
    setLoading(false);
  };

  const handleAnswerChange = (section, index, value) => {
    setAnswers(prev => ({ ...prev, [`${section}_${index}`]: value }));
  };

  // 3. CHẤM BÀI VÀ PHÂN TÍCH
  const handleSubmit = async () => {
    let detailedReview = [];
    let totalScore = 0;

    // --- CHẤM ĐIỂM MODE LEVEL ---
    if (testMode === 'level') {
      const isHSK12 = selectedLevel <= 2;

      const gradeFlexible = (items, prefix, maxQScore) => {
        let score = 0;
        items?.forEach((item, idx) => {
          const rawUserAns = answers[`${prefix}_${idx}`] || "";
          const userAns = rawUserAns.trim().replace(/\s+/g, "");
          const correctAnsRaw = item.chinese || item.front || "";
          const correctAns = correctAnsRaw.trim().replace(/\s+/g, "").replace(/[.!?。，？！、]/g, "");
          
          let qScore = 0;
          let feedbackMsg = "Bỏ trống hoặc sai hoàn toàn.";
          let status = "wrong";

          if (userAns.length > 0) {
            let matchCount = 0;
            for (let char of correctAns) { if (userAns.includes(char)) matchCount++; }
            const matchRatio = matchCount / correctAns.length;

            if (userAns === correctAns) {
              qScore = maxQScore; feedbackMsg = "Chính xác tuyệt đối!"; status = "correct";
            } else if (matchRatio >= 0.8) {
              qScore = maxQScore * 0.8; feedbackMsg = "Đúng phần lớn ý nghĩa, có sai sót nhỏ."; status = "partial";
            } else if (matchRatio >= 0.5) {
              qScore = maxQScore * 0.5; feedbackMsg = "Ghép được các cụm từ chính nhưng sai ngữ pháp tổng thể."; status = "partial";
            } else if (matchRatio > 0) {
              qScore = maxQScore * 0.2; feedbackMsg = "Chỉ đúng vài từ vựng lẻ tẻ."; status = "wrong";
            }
          }

          if (status === "wrong" && user) {
             logUserError(user.id, `test_${prefix}_error`);
          }
          
          score += qScore;
          detailedReview.push({
            type: prefix === 'translate' ? "Dịch Câu" : "Sắp Xếp",
            question: prefix === 'translate' ? (item.vietnamese || item.front) : segmentWords(correctAnsRaw).join(" / "),
            userAnswer: rawUserAns || "(Bỏ trống)",
            correctAnswer: correctAnsRaw,
            score: qScore,
            maxScore: maxQScore,
            feedback: feedbackMsg,
            status: status
          });
        });
        return score;
      };

      const transScore = gradeFlexible(testData.sections.translate, 'translate', 10);
      const arrScore = gradeFlexible(testData.sections.arrange, 'arrange', 10);
      
      let essayScore = 0;
      if (!isHSK12) {
        testData.sections.essay?.forEach((item, idx) => {
          const ans = (answers[`essay_${idx}`] || "").trim();
          let qScore = 0; let status = "wrong"; let feedbackMsg = "Chưa viết hoặc quá ngắn.";
          if (ans.length >= 40) { qScore = 50; status = "correct"; feedbackMsg = "Độ dài tốt, có sự đầu tư."; }
          else if (ans.length >= 20) { qScore = 35; status = "partial"; feedbackMsg = "Nội dung tạm ổn nhưng cần chi tiết hơn."; }
          else if (ans.length > 0) { qScore = 15; status = "wrong"; feedbackMsg = "Quá ngắn để diễn đạt đủ ý."; }
          
          essayScore += qScore;
          detailedReview.push({
            type: "Viết Luận", question: item.prompt, userAnswer: ans || "(Bỏ trống)",
            correctAnswer: "Tùy thuộc vào lập luận cá nhân (Yêu cầu >40 chữ).",
            score: qScore, maxScore: 50, feedback: feedbackMsg, status: status
          });
        });
      }

      totalScore = Math.round(transScore + arrScore + essayScore);
      const maxPossible = isHSK12 ? 200 : 300;
      const passScore = isHSK12 ? 120 : 180;
      const warnScore = isHSK12 ? 150 : 230;

      let status, message;
      if (totalScore < passScore) {
        status = "FAIL"; message = "Chưa đạt mức tối thiểu. Khuyến nghị bạn nên ôn tập lại nền tảng cấp độ này.";
      } else if (totalScore < warnScore) {
        status = "PASS_WARN"; message = "Bạn ĐÃ QUA môn, nhưng kiến thức vẫn còn lỗ hổng. Khuyên bạn củng cố thêm trước khi lên cấp mới.";
      } else {
        status = "EXCELLENT"; message = "🎉 Xuất sắc! Nền tảng của bạn rất vững chắc, sẵn sàng chinh phục cấp độ tiếp theo.";
      }

      setResult({ mode: 'level', status, message, score: totalScore, maxScore: maxPossible, details: detailedReview });

      // Lưu tiến trình nếu Pass
      if (totalScore >= passScore && user) {
        try {
          const studentRef = doc(db, "user_progress", user.id);
          let updateData = {};
          for (let i = 1; i <= selectedLevel; i++) {
            updateData[`unlocked_levels.HSK${i}`] = true;
          }
          await setDoc(studentRef, updateData, { merge: true });
          await updateUserProgress(user.id, 100); // Thưởng 100 XP khi pass test
        } catch (error) {
          console.error(error);
        }
      }

    // --- CHẤM ĐIỂM MODE COMPREHENSIVE ---
    } else if (testMode === 'comprehensive') {
      let levelAccuracy = { 1: {s:0, t:0}, 2: {s:0, t:0}, 3: {s:0, t:0}, 4: {s:0, t:0}, 5: {s:0, t:0}, 6: {s:0, t:0} };
      
      testData.sections.translate.forEach((item, idx) => {
        const userAns = (answers[`translate_${idx}`] || "").trim().replace(/\s+/g, "");
        const correctAns = (item.chinese || item.front || "").trim().replace(/\s+/g, "").replace(/[.!?。，？！、]/g, "");
        
        let qScore = 0;
        if (userAns.length > 0) {
          let matchCount = 0;
          for (let char of correctAns) { if (userAns.includes(char)) matchCount++; }
          const matchRatio = matchCount / correctAns.length;
          if (userAns === correctAns) qScore = 10;
          else if (matchRatio >= 0.8) qScore = 8;
          else if (matchRatio >= 0.5) qScore = 5;
          else if (matchRatio > 0) qScore = 2;
        }

        const lvl = item.originLevel;
        levelAccuracy[lvl].s += qScore;
        levelAccuracy[lvl].t += 10;
        totalScore += qScore;

        if (qScore < 5 && user) logUserError(user.id, `test_comprehensive_error`);

        detailedReview.push({
          type: "Câu Dịch (Hệ thống ẩn cấp độ)",
          question: item.vietnamese || item.front,
          userAnswer: answers[`translate_${idx}`] || "(Bỏ trống)",
          correctAnswer: item.chinese || item.front,
          score: qScore, maxScore: 10,
          feedback: qScore === 10 ? "Chính xác!" : (qScore >= 5 ? "Gần đúng ý nghĩa" : "Sai lệch nhiều ngữ nghĩa"),
          status: qScore === 10 ? "correct" : (qScore >= 5 ? "partial" : "wrong")
        });
      });

      // AI Đánh giá: Tìm mốc đầu tiên Accuracy < 60%
      let suggestedLevel = 1;
      let analysisText = "Phân tích AI: ";
      for(let i=1; i<=6; i++) {
        let acc = levelAccuracy[i].s / levelAccuracy[i].t;
        if (acc >= 0.6) {
          suggestedLevel = i + 1 > 6 ? 6 : i + 1;
        } else {
          suggestedLevel = i;
          break;
        }
      }

      analysisText += `Bạn nắm vững kiến thức đến khoảng HSK ${Math.max(1, suggestedLevel - 1)}. Từ HSK ${suggestedLevel} trở đi độ chính xác bắt đầu giảm dần.`;

      setResult({ 
        mode: 'comprehensive', 
        status: "COMPREHENSIVE", 
        message: analysisText,
        suggestedLevel: suggestedLevel,
        score: totalScore, 
        maxScore: 300, 
        details: detailedReview 
      });
      
      if (user) await updateUserProgress(user.id, 50); // Thưởng 50 XP làm test chẩn đoán
    }
  };

  // --- UI: MÀN HÌNH CHỌN CHẾ ĐỘ THI ---
  if (!testMode && !testData) {
    return (
      <main className="min-h-screen bg-[#F4F8F5] relative selection:bg-emerald-200">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-40" style={{ backgroundImage: "url('/hskk/kiemtra.jpg')" }}></div>
        <div className="absolute inset-0 bg-gradient-to-b from-[#F4F8F5]/90 to-[#F4F8F5]/40 backdrop-blur-[2px]"></div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center animate-fade-in">
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
              Thực hiện bài kiểm tra để AI quét lỗi sai và cá nhân hóa lộ trình học tập của bạn trên hệ thống.
            </p>
          </div>

          <div 
            onClick={startComprehensiveTest}
            className="w-full max-w-2xl bg-gradient-to-r from-[#172033] to-slate-800 p-8 rounded-[32px] shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer mb-10 flex items-center gap-6 group"
          >
            <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform">🤖</div>
            <div className="flex-1 text-left text-white">
              <h2 className="text-2xl font-black mb-2 flex items-center gap-2">Test Tổng Hợp Toàn Diện <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-widest">AI Khuyên dùng</span></h2>
              <p className="text-slate-300 text-sm font-medium">Hệ thống rút ngẫu nhiên 30 câu từ HSK 1 đến 6 để "chụp X-Quang" điểm yếu và tư vấn chính xác nên bắt đầu từ đâu.</p>
            </div>
          </div>

          <div className="w-full max-w-4xl text-left mb-6">
            <h3 className="font-black text-slate-400 uppercase tracking-widest text-sm ml-2">Hoặc chọn thi để mở khóa cấp độ</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl">
            {[1, 2, 3, 4, 5, 6].map((lvl) => (
              <div
                key={lvl}
                onClick={() => startLevelTest(lvl)}
                className="bg-white p-6 rounded-[32px] shadow-sm border-2 border-transparent hover:border-[#08A66A] hover:shadow-xl hover:-translate-y-1.5 transition-all cursor-pointer group flex flex-col items-center text-center"
              >
                <h2 className="text-2xl font-black text-slate-800 group-hover:text-[#08A66A] transition-colors mb-2">HSK {lvl}</h2>
                <p className="text-xs text-slate-500 font-medium">{lvl <= 2 ? "2 Phần (Dịch, Sắp xếp)" : "3 Phần (Dịch, Xếp, Viết)"}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // --- UI: LOADING ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F8F5] flex flex-col items-center justify-center relative">
        <div className="text-6xl mb-6 animate-bounce">🐸</div>
        <h3 className="text-xl font-black text-[#08A66A] uppercase tracking-widest">Hệ thống đang chuẩn bị đề thi...</h3>
      </div>
    );
  }

  // --- UI: KẾT QUẢ & BẢNG REVIEW ---
  if (result) {
    if (showReview) {
      return (
        <main className="min-h-screen bg-[#F4F8F5] flex flex-col items-center py-10 px-4 md:px-6 relative">
          <div className="w-full max-w-4xl bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 md:p-10 relative overflow-hidden animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-800">Báo Cáo Lỗi Sai Chi Tiết</h2>
                <p className="text-sm font-bold text-slate-500 mt-1">
                  {testMode === 'level' ? `Đề HSK ${selectedLevel}` : `Bài Test Tổng Hợp`} • Đạt {result.score}/{result.maxScore} đ
                </p>
              </div>
              <button onClick={() => setShowReview(false)} className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-sm transition-colors shrink-0">
                ← Quay lại tổng quan
              </button>
            </div>

            <div className="space-y-6">
              {result.details.map((q, idx) => {
                let statusStyle = "";
                if (q.status === "correct") statusStyle = "bg-[#DDF7EA] border-[#08A66A]/30";
                else if (q.status === "partial") statusStyle = "bg-[#FFF8E8] border-[#FFC83D]/40";
                else statusStyle = "bg-rose-50 border-rose-200";

                return (
                  <div key={idx} className={`p-6 rounded-[24px] border ${statusStyle}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-3 items-center">
                        <span className="w-8 h-8 rounded-full bg-white font-black text-slate-500 text-sm flex items-center justify-center shadow-sm shrink-0">{idx + 1}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white/60 px-3 py-1.5 rounded-lg shadow-sm">{q.type}</span>
                      </div>
                      <span className="font-black text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-100 shadow-sm">{q.score} / {q.maxScore} đ</span>
                    </div>

                    <p className="text-base font-bold text-slate-800 mb-5 bg-white/50 p-4 rounded-xl">{q.question}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Đáp án của bạn</p>
                        <p className={`font-medium text-lg ${q.status === 'wrong' ? 'text-rose-600' : 'text-slate-800'}`}>{q.userAnswer}</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#08A66A]"></div>
                        <p className="text-[10px] font-black text-[#08A66A] uppercase tracking-widest mb-2">Đáp án chuẩn</p>
                        <p className="font-medium text-[#087A55] text-lg">{q.correctAnswer}</p>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-3 items-start bg-white/60 p-4 rounded-xl">
                      <span className="text-xl">💡</span>
                      <p className="text-sm font-bold text-slate-600 pt-1 leading-relaxed">AI Nhận xét: <span className="text-slate-800 font-medium">{q.feedback}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-10 flex justify-center">
               <button onClick={() => setShowReview(false)} className="px-10 py-4 bg-[#172033] text-white font-black rounded-2xl shadow-xl hover:bg-slate-800 transition-colors uppercase tracking-widest">
                 Xong
               </button>
            </div>
          </div>
        </main>
      );
    }

    if (result.mode === 'comprehensive') {
      return (
        <main className="min-h-screen bg-[#F4F8F5] flex flex-col items-center justify-center p-6 relative">
          <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl border border-white max-w-2xl w-full text-center relative z-10 animate-slide-up-fade">
            <div className="w-28 h-28 rounded-full bg-blue-50 flex items-center justify-center text-5xl shadow-inner border border-blue-100 mb-6 mx-auto">🤖</div>
            <h2 className="text-3xl font-black mb-2 text-slate-800">Kết Quả Phân Tích AI</h2>
            
            <div className="bg-slate-50 p-8 rounded-[32px] w-full my-8 border border-slate-200">
              <p className="text-slate-600 font-medium mb-6 leading-relaxed text-sm">{result.message}</p>
              <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm">
                <p className="text-[10px] font-black text-[#08A66A] uppercase tracking-widest mb-2">Lộ trình đề xuất cho bạn</p>
                <p className="text-3xl font-black text-slate-800">Bắt đầu từ <span className="text-[#08A66A]">HSK {result.suggestedLevel}</span></p>
              </div>
            </div>

            <button onClick={() => setShowReview(true)} className="w-full mb-4 px-6 py-4 bg-white border-2 border-blue-500 text-blue-600 rounded-2xl font-black text-sm hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              <span>🔍</span> Xem bảng phân tích lỗi sai
            </button>
            <button onClick={() => { setResult(null); setTestMode(null); }} className="w-full px-6 py-4 bg-[#172033] text-white rounded-2xl font-black text-sm shadow-xl hover:bg-slate-800 transition-colors uppercase tracking-widest">
              Xong
            </button>
          </div>
        </main>
      );
    }

    const isFailed = result.status === "FAIL";
    const uiConfig = {
      FAIL: { icon: '💦', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', title: 'Chưa đạt yêu cầu!' },
      PASS_WARN: { icon: '⚠️', color: 'text-amber-500', bg: 'bg-[#FFF8E8]', border: 'border-[#FFC83D]/30', title: 'Cần cố gắng thêm!' },
      EXCELLENT: { icon: '🏆', color: 'text-[#08A66A]', bg: 'bg-[#DDF7EA]', border: 'border-[#08A66A]/20', title: 'Chúc mừng bạn!' }
    };
    const ui = uiConfig[result.status];

    return (
      <main className="min-h-screen bg-[#F4F8F5] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-20" style={{ backgroundImage: "url('/hskk/kiemtra.jpg')" }}></div>
        <div className="absolute inset-0 bg-[#F4F8F5]/80 backdrop-blur-md"></div>
        
        <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl border border-white max-w-lg w-full text-center relative z-10 flex flex-col items-center animate-slide-up-fade">
          <div className="w-28 h-28 rounded-full bg-slate-50 flex items-center justify-center text-5xl shadow-inner border border-slate-100 mb-6 relative">
            {ui.icon}
          </div>
          
          <h2 className={`text-3xl font-black mb-2 ${ui.color}`}>{ui.title}</h2>
          
          <div className={`p-8 rounded-[32px] w-full my-8 relative overflow-hidden border ${ui.bg} ${ui.border}`}>
            <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 relative z-10">Điểm tổng kết HSK {selectedLevel}</p>
            <p className={`text-7xl font-black relative z-10 ${ui.color}`}>
              {result.score} <span className="text-3xl opacity-50 font-bold">/ {result.maxScore}</span>
            </p>
          </div>

          <p className="text-slate-600 font-medium mb-10 leading-relaxed px-2 text-sm">{result.message}</p>
          
          <button onClick={() => setShowReview(true)} className="w-full mb-4 px-6 py-4 bg-white border-2 border-[#08A66A] text-[#08A66A] rounded-2xl font-black text-sm hover:bg-[#DDF7EA]/50 transition-colors flex items-center justify-center gap-2">
             <span>🔍</span> Xem bảng phân tích lỗi sai
          </button>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            {(isFailed || result.status === "PASS_WARN") && (
              <button onClick={() => { setResult(null); startLevelTest(selectedLevel); }} className="flex-1 px-6 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:border-slate-300 transition-colors">
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

  // --- MÀN HÌNH LÀM BÀI CHÍNH ---
  const isHSK12 = testMode === 'level' ? selectedLevel <= 2 : true; 

  return (
    <main className="min-h-screen bg-[#F4F8F5] pb-20 relative selection:bg-emerald-200">
      <header className="bg-white/90 backdrop-blur-xl border-b border-slate-200/60 sticky top-0 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#DDF7EA] rounded-2xl flex items-center justify-center text-[#08A66A] text-2xl shadow-inner border border-emerald-50">🎯</div>
            <div>
              <h1 className="font-black text-slate-800 text-lg">
                {testMode === 'level' ? `Đánh Giá Năng Lực HSK ${selectedLevel}` : `Bài Test Tổng Hợp Toàn Diện`}
              </h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {testMode === 'comprehensive' ? "30 Câu Dịch" : (isHSK12 ? "2 Phần • Tổng 200 điểm" : "3 Phần • Tổng 300 điểm")}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (window.confirm("Bạn có chắc chắn muốn hủy bài thi này không?")) {
                setTestMode(null);
                setSelectedLevel(null);
              }
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
                <h3 className="text-xl font-black text-slate-800">Phần {testMode === 'comprehensive' ? 'Thi' : '1'}: Dịch Câu</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{testData.sections.translate.length} Câu</p>
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

        {/* Phần 2: Sắp xếp câu (Dùng Component Click-to-Select) */}
        {testMode === 'level' && testData?.sections?.arrange && testData.sections.arrange.length > 0 && (
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
                <ArrangeQuestion 
                  key={`arr-${idx}`} 
                  item={item} 
                  index={idx} 
                  onChange={(val) => handleAnswerChange("arrange", idx, val)} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Phần 3: Viết Luận (Chỉ HSK 3-6 Mode Level) */}
        {testMode === 'level' && !isHSK12 && testData?.sections?.essay && testData.sections.essay.length > 0 && (
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
                    placeholder="Viết câu trả lời bằng tiếng Trung tại đây (Tối thiểu 40 chữ)..."
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