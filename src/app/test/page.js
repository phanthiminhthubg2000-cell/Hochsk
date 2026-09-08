"use client";
import { useState, useEffect } from "react";
import { useUser, useAuth, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
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
    <div className="bg-[#EEF5E9]/50 p-6 rounded-[24px] border border-[#8FD9A8]/40">
      <div className="flex items-start gap-3 mb-4">
        <span className="w-8 h-8 shrink-0 rounded-full bg-white text-[#2F8F6E] text-xs font-black flex items-center justify-center shadow-sm border border-[#8FD9A8]">{index + 1}</span>
        <div className="flex-1 w-full">
          <p className="text-xs font-black text-[#1B5E4B] uppercase tracking-widest mb-3">Sắp xếp các từ sau thành câu đúng:</p>
          
          {/* Khu vực ghép câu */}
          <div className="min-h-[70px] p-5 bg-white border-2 border-dashed border-[#8FD9A8] rounded-2xl mb-4 flex flex-wrap gap-2 items-center transition-all shadow-inner">
            {selected.length === 0 && <span className="text-slate-400 text-sm font-medium italic opacity-70">Chạm vào từ bên dưới để ghép lên đây...</span>}
            {selected.map(w => (
              <button 
                key={w.id} 
                onClick={() => handleDeselect(w)} 
                className="px-4 py-2 bg-[#8FD9A8]/30 text-[#1B5E4B] border border-[#8FD9A8] font-black rounded-xl shadow-sm text-lg hover:bg-[#FFF1F2] hover:text-[#BE123C] hover:border-[#FECDD3] hover:line-through transition-all"
              >
                {w.text}
              </button>
            ))}
          </div>

          {/* Khu vực từ vựng */}
          <div className="flex flex-wrap gap-2 p-2 bg-[#F4F7F6] rounded-2xl border border-[#E2E8F0]">
            {available.map(w => (
              <button 
                key={w.id} 
                onClick={() => handleSelect(w)} 
                className="px-4 py-2 bg-white border border-[#E2E8F0] text-[#2F8F6E] font-black rounded-xl shadow-sm text-lg hover:border-[#2F8F6E] hover:bg-[#2F8F6E] hover:text-white hover:-translate-y-1 transition-all"
              >
                {w.text}
              </button>
            ))}
            {available.length === 0 && <span className="text-slate-400 text-sm font-bold w-full text-center py-2 opacity-60">Bạn đã dùng hết từ</span>}
          </div>
        </div>
      </div>
    </div>
  );
}


// --- MAIN COMPONENT ---
export default function PlacementTestPage() {
  const { user, isLoaded } = useUser();
  const { userId } = useAuth();
  
  const [testMode, setTestMode] = useState(null); // 'level' hoặc 'comprehensive'
  const [selectedLevel, setSelectedLevel] = useState(null);
  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [showReview, setShowReview] = useState(false);

  // --- STATE ĐỒNG BỘ XP/WATER TOÀN HỆ THỐNG ---
  const [hskXp, setHskXp] = useState(0);
  const [water, setWater] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hearts, setHearts] = useState(5);

  useEffect(() => {
    async function fetchGlobalData() {
      if (userId) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          
          let currentXp = 0;
          let currentWater = 0;
          let currentStreak = 0;

          if (userSnap.exists()) {
            const data = userSnap.data();
            currentXp = data.xp || 0;
            currentWater = data.water || 0;
            currentStreak = data.streak || 0;
          }

          const newStudentRef = doc(db, "user_progress", userId);
          const newDocSnap = await getDoc(newStudentRef);
          if (newDocSnap.exists()) {
            const newData = newDocSnap.data();
            if (currentXp === 0) currentXp = newData.profile?.hsk_xp || 0;
            if (currentStreak === 0) currentStreak = newData.profile?.streak_days || 0;
            setHearts(newData.profile?.hearts ?? 5);
          }

          setHskXp(currentXp);
          setWater(currentWater);
          setStreak(currentStreak);

        } catch (error) { console.error("Lỗi:", error); }
      }
    }
    if (isLoaded) fetchGlobalData();
  }, [userId, isLoaded, user]);

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

  // ============================================================
  // CẬP NHẬT XP & NƯỚC (ĐỒNG BỘ TOÀN HỆ THỐNG KHI SUBMIT)
  // ============================================================
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

      // LƯU TIẾN TRÌNH VÀ CỘNG ĐIỂM + NƯỚC NẾU PASS
      if (totalScore >= passScore && userId) {
        try {
          const newXp = hskXp + 100; // Thưởng 100 XP
          const newWater = water + 10; // Thưởng 10 Nước

          setHskXp(newXp);
          setWater(newWater);

          const studentRef = doc(db, "user_progress", userId);
          let updateData = {};
          for (let i = 1; i <= selectedLevel; i++) {
            updateData[`unlocked_levels.HSK${i}`] = true;
          }
          await setDoc(studentRef, updateData, { merge: true });
          
          // Ghi đè vào Users
          await setDoc(doc(db, "users", userId), {
            xp: newXp,
            water: newWater
          }, { merge: true });

          await updateUserProgress(userId, 100); 
        } catch (error) {
          console.error("Lỗi đồng bộ Level Test:", error);
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
      
      // LƯU TIẾN TRÌNH VÀ CỘNG ĐIỂM + NƯỚC BÀI TEST CHẨN ĐOÁN
      if (userId) {
        try {
          const newXp = hskXp + 50; // Thưởng 50 XP
          const newWater = water + 5; // Thưởng 5 Nước

          setHskXp(newXp);
          setWater(newWater);

          await setDoc(doc(db, "users", userId), {
            xp: newXp,
            water: newWater
          }, { merge: true });

          await updateUserProgress(userId, 50); 
        } catch (error) {
           console.error("Lỗi đồng bộ Diagnostic Test:", error);
        }
      }
    }
  };

  // --- UI: MÀN HÌNH CHỌN CHẾ ĐỘ THI ---
  if (!testMode && !testData) {
    return (
      <main className="min-h-screen bg-[#F4F7F6] relative selection:bg-[#8FD9A8]/50">
        
        {/* LỚP NỀN GLOBAL ĐỒNG BỘ */}
        <div className="fixed inset-0 z-0 pointer-events-none">
           <div className="absolute inset-0 bg-[url('/hskk/kiemtra.jpg')] bg-cover bg-center opacity-10"></div>
           <div className="absolute inset-0 bg-[#EEF5E9]/90 backdrop-blur-[2px]"></div>
        </div>

        {/* TOPBAR ĐỒNG BỘ */}
        <header className="relative z-30 h-[76px] border-b border-[#8FD9A8]/30 bg-white/50 px-5 md:px-8 flex items-center justify-between backdrop-blur-xl">
          <Link href="/">
            <button className="flex items-center gap-2 rounded-2xl bg-white shadow-sm px-4 py-2.5 text-sm font-black text-[#1B5E4B] hover:bg-[#8FD9A8]/20 transition-all border border-[#E2E8F0] hover:border-[#8FD9A8]">
              ← Trở về Vườn
            </button>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-white shadow-sm px-4 py-2.5 border border-slate-100">
              <span className="text-lg drop-shadow-sm">🔥</span><span className="text-xs font-black text-[#F2765B]">{streak} ngày</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 rounded-2xl bg-[#4FB6C7]/10 border border-[#4FB6C7]/30 shadow-sm px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">💧</span><span className="text-xs font-black text-[#4FB6C7]">{water} giọt</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFD666]/20 border border-[#FFD666]/50 shadow-sm px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">⭐</span><span className="text-xs font-black text-[#1B5E4B]">{hskXp.toLocaleString()} XP</span>
            </div>
            {isLoaded && <UserButton afterSignOutUrl="/" />}
          </div>
        </header>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center animate-fade-in">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-white rounded-[40%_60%_70%_30%/40%_50%_60%_50%] mx-auto flex items-center justify-center text-4xl mb-6 shadow-sm border border-[#8FD9A8]">🎯</div>
            <h1 className="text-4xl md:text-5xl font-black text-[#1B5E4B] tracking-tight mb-4 drop-shadow-sm">Đánh Giá Năng Lực</h1>
            <p className="text-[#2F8F6E] font-medium max-w-lg mx-auto leading-relaxed">
              Thực hiện bài kiểm tra để AI quét lỗi sai và cá nhân hóa lộ trình học tập của bạn trên hệ thống.
            </p>
          </div>

          <div 
            onClick={startComprehensiveTest}
            className="w-full max-w-2xl bg-[#1B5E4B] p-8 rounded-[32px] shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all cursor-pointer mb-10 flex items-center gap-6 group border-b-[8px] border-[#2F8F6E]"
          >
            <div className="w-20 h-20 bg-[#EEF5E9]/20 rounded-full flex items-center justify-center text-4xl shadow-inner group-hover:scale-110 transition-transform border border-white/20">🤖</div>
            <div className="flex-1 text-left text-white">
              <h2 className="text-2xl font-black mb-2 flex items-center gap-2 drop-shadow-sm">Test Chẩn Đoán AI <span className="bg-[#F2765B] text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-widest shadow-sm">+50 XP</span></h2>
              <p className="text-[#8FD9A8] text-sm font-medium">Hệ thống rút ngẫu nhiên 30 câu từ HSK 1 đến 6 để "chụp X-Quang" điểm yếu và tư vấn lộ trình.</p>
            </div>
          </div>

          <div className="w-full max-w-4xl text-left mb-6">
            <h3 className="font-black text-[#2F8F6E] uppercase tracking-widest text-sm ml-2 bg-[#8FD9A8]/20 px-4 py-2 rounded-xl inline-block border border-[#8FD9A8]/40">Hoặc chọn thi để mở khóa cấp độ</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-4xl">
            {[1, 2, 3, 4, 5, 6].map((lvl) => (
              <div
                key={lvl}
                onClick={() => startLevelTest(lvl)}
                className="bg-white p-6 rounded-[32px] shadow-sm border border-[#E2E8F0] hover:border-[#8FD9A8] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group flex flex-col items-center text-center"
              >
                <div className="w-14 h-14 bg-[#F4F7F6] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] mb-4 flex items-center justify-center text-2xl group-hover:bg-[#EEF5E9] group-hover:border-[#8FD9A8] border border-transparent transition-colors">📘</div>
                <h2 className="text-2xl font-black text-[#1B5E4B] group-hover:text-[#2F8F6E] transition-colors mb-2">HSK {lvl}</h2>
                <p className="text-xs text-slate-500 font-bold bg-slate-50 px-3 py-1 rounded-lg">{lvl <= 2 ? "2 Phần (Dịch, Sắp xếp)" : "3 Phần (Dịch, Xếp, Viết)"}</p>
                <p className="text-[10px] font-black text-[#F2765B] mt-3 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">+100 XP Thưởng</p>
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
      <div className="min-h-screen bg-[#EEF5E9] flex flex-col items-center justify-center relative selection:bg-[#8FD9A8]/50">
        <div className="w-16 h-16 border-[6px] border-[#2F8F6E] border-t-transparent rounded-full animate-spin mb-6"></div>
        <h3 className="text-xl font-black text-[#1B5E4B] uppercase tracking-widest animate-pulse">Hệ thống đang chuẩn bị đề...</h3>
      </div>
    );
  }

  // --- UI: KẾT QUẢ & BẢNG REVIEW ---
  if (result) {
    if (showReview) {
      return (
        <main className="min-h-screen bg-[#F4F7F6] flex flex-col items-center py-10 px-4 md:px-6 relative">
          <div className="w-full max-w-4xl bg-white rounded-[40px] shadow-sm border border-[#E2E8F0] p-8 md:p-10 relative overflow-hidden animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
              <div>
                <h2 className="text-2xl font-black text-[#1B5E4B]">Báo Cáo Phân Tích Lỗi Sai</h2>
                <p className="text-sm font-bold text-[#2F8F6E] mt-1 bg-[#EEF5E9] px-3 py-1 rounded-lg inline-block">
                  {testMode === 'level' ? `Đề HSK ${selectedLevel}` : `Bài Test Tổng Hợp`} • Đạt {result.score}/{result.maxScore} đ
                </p>
              </div>
              <button onClick={() => setShowReview(false)} className="px-5 py-2.5 bg-[#F4F7F6] hover:bg-[#EEF5E9] text-[#1B5E4B] font-black rounded-xl text-sm transition-colors shrink-0 border border-[#E2E8F0] hover:border-[#8FD9A8]">
                ← Quay lại tổng quan
              </button>
            </div>

            <div className="space-y-6">
              {result.details.map((q, idx) => {
                let statusStyle = "";
                let bgHeader = "";
                if (q.status === "correct") { statusStyle = "bg-[#EEF5E9] border-[#8FD9A8]/50"; bgHeader = "bg-white/80"; }
                else if (q.status === "partial") { statusStyle = "bg-[#FFF8E8] border-[#FFD666]/50"; bgHeader = "bg-white/80"; }
                else { statusStyle = "bg-[#FFF1F2] border-[#FECDD3]"; bgHeader = "bg-white/80"; }

                return (
                  <div key={idx} className={`p-6 rounded-[32px] border ${statusStyle} shadow-sm`}>
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-3 items-center">
                        <span className="w-8 h-8 rounded-full bg-white font-black text-[#1B5E4B] text-sm flex items-center justify-center shadow-sm shrink-0 border border-slate-100">{idx + 1}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest text-slate-600 ${bgHeader} px-3 py-1.5 rounded-lg shadow-sm border border-slate-100/50`}>{q.type}</span>
                      </div>
                      <span className="font-black text-[#1B5E4B] bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100">{q.score} / {q.maxScore} đ</span>
                    </div>

                    <p className="text-base font-bold text-[#1B5E4B] mb-5 bg-white/60 p-4 rounded-2xl shadow-inner border border-white leading-relaxed">{q.question}</p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${q.status === 'wrong' ? 'bg-[#F2765B]' : 'bg-slate-300'}`}></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Đáp án của bạn</p>
                        <p className={`font-medium text-lg ml-2 ${q.status === 'wrong' ? 'text-[#BE123C]' : 'text-[#1B5E4B]'}`}>{q.userAnswer}</p>
                      </div>
                      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#2F8F6E]"></div>
                        <p className="text-[10px] font-black text-[#2F8F6E] uppercase tracking-widest mb-2 ml-2">Đáp án chuẩn</p>
                        <p className="font-medium text-[#1B5E4B] text-lg ml-2">{q.correctAnswer}</p>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-3 items-start bg-white/80 p-4 rounded-2xl shadow-sm border border-white">
                      <span className="text-xl">🐸</span>
                      <p className="text-sm font-bold text-[#2F8F6E] pt-1 leading-relaxed">Ếch Canh Phân Tích: <span className="text-[#1B5E4B] font-medium">{q.feedback}</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-10 flex justify-center">
               <button onClick={() => setShowReview(false)} className="px-12 py-4 bg-[#1B5E4B] text-white font-black rounded-2xl shadow-xl hover:bg-[#2F8F6E] hover:-translate-y-1 transition-all uppercase tracking-widest border-b-[4px] border-[#0F3F31]">
                 Xong, Đã Hiểu
               </button>
            </div>
          </div>
        </main>
      );
    }

    if (result.mode === 'comprehensive') {
      return (
        <main className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center p-6 relative">
          <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl border border-white max-w-2xl w-full text-center relative z-10 animate-slide-up-fade">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-[#8FD9A8]/20 to-transparent rounded-bl-full pointer-events-none"></div>
            <div className="w-28 h-28 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#EEF5E9] flex items-center justify-center text-5xl shadow-inner border border-[#8FD9A8]/50 mb-6 mx-auto">🤖</div>
            <h2 className="text-3xl font-black mb-2 text-[#1B5E4B] drop-shadow-sm">Kết Quả Phân Tích AI</h2>
            
            <div className="bg-[#F4F7F6] p-8 rounded-[32px] w-full my-8 border border-[#E2E8F0]">
              <p className="text-[#1B5E4B] font-medium mb-6 leading-relaxed text-sm bg-white p-5 rounded-2xl shadow-sm">{result.message}</p>
              <div className="bg-[#1B5E4B] p-6 rounded-3xl border border-[#2F8F6E] shadow-xl shadow-[#8FD9A8]/20">
                <p className="text-[10px] font-black text-[#8FD9A8] uppercase tracking-widest mb-2">Lộ trình đề xuất cho bạn</p>
                <p className="text-4xl font-black text-white drop-shadow-sm">Bắt đầu từ <span className="text-[#FFD666]">HSK {result.suggestedLevel}</span></p>
              </div>
            </div>

            <button onClick={() => setShowReview(true)} className="w-full mb-4 px-6 py-4.5 bg-white border-2 border-[#2F8F6E] text-[#2F8F6E] rounded-2xl font-black text-sm hover:bg-[#EEF5E9] transition-colors flex items-center justify-center gap-2 shadow-sm">
              <span>🔍</span> Xem bảng phân tích lỗi sai
            </button>
            <button onClick={() => { setResult(null); setTestMode(null); }} className="w-full px-6 py-4.5 bg-[#1B5E4B] text-white rounded-2xl font-black text-sm shadow-xl hover:bg-[#2F8F6E] transition-colors uppercase tracking-widest border-b-[4px] border-[#0F3F31]">
              Về Danh Mục Chẩn Đoán
            </button>
          </div>
        </main>
      );
    }

    const isFailed = result.status === "FAIL";
    const uiConfig = {
      FAIL: { icon: '💦', color: 'text-[#BE123C]', bg: 'bg-[#FFF1F2]', border: 'border-[#FECDD3]', title: 'Chưa đạt yêu cầu!' },
      PASS_WARN: { icon: '⚠️', color: 'text-[#F59E0B]', bg: 'bg-[#FFF8E8]', border: 'border-[#FFD666]/50', title: 'Cần cố gắng thêm!' },
      EXCELLENT: { icon: '🏆', color: 'text-[#2F8F6E]', bg: 'bg-[#EEF5E9]', border: 'border-[#8FD9A8]', title: 'Chúc mừng bạn!' }
    };
    const ui = uiConfig[result.status];

    return (
      <main className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center p-6 relative overflow-hidden selection:bg-[#8FD9A8]/50">
        <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-10" style={{ backgroundImage: "url('/hskk/kiemtra.jpg')" }}></div>
        <div className="absolute inset-0 bg-[#F4F7F6]/80 backdrop-blur-md"></div>
        
        <div className="bg-white p-10 md:p-14 rounded-[40px] shadow-2xl border border-white max-w-lg w-full text-center relative z-10 flex flex-col items-center animate-slide-up-fade">
          <div className="w-28 h-28 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-slate-50 flex items-center justify-center text-6xl shadow-inner border border-slate-100 mb-6 relative">
            {ui.icon}
          </div>
          
          <h2 className={`text-3xl font-black mb-2 drop-shadow-sm ${ui.color}`}>{ui.title}</h2>
          
          <div className={`p-8 rounded-[32px] w-full my-8 relative overflow-hidden border shadow-sm ${ui.bg} ${ui.border}`}>
            <p className={`text-xs font-black uppercase tracking-widest mb-2 relative z-10 opacity-70 ${ui.color}`}>Điểm tổng kết HSK {selectedLevel}</p>
            <p className={`text-7xl font-black relative z-10 drop-shadow-sm ${ui.color}`}>
              {result.score} <span className="text-3xl opacity-50 font-bold">/ {result.maxScore}</span>
            </p>
          </div>

          <p className="text-[#1B5E4B] font-bold mb-10 leading-relaxed px-2 text-sm bg-[#F4F7F6] p-4 rounded-2xl">{result.message}</p>
          
          <button onClick={() => setShowReview(true)} className={`w-full mb-4 px-6 py-4.5 bg-white border-2 rounded-2xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${ui.color === 'text-[#2F8F6E]' ? 'border-[#2F8F6E] text-[#2F8F6E] hover:bg-[#EEF5E9]' : ui.color === 'text-[#F59E0B]' ? 'border-[#F59E0B] text-[#F59E0B] hover:bg-[#FFF8E8]' : 'border-[#BE123C] text-[#BE123C] hover:bg-[#FFF1F2]'}`}>
              <span>🔍</span> Xem bảng phân tích lỗi sai
          </button>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            {(isFailed || result.status === "PASS_WARN") && (
              <button onClick={() => { setResult(null); startLevelTest(selectedLevel); }} className="flex-1 px-6 py-4.5 bg-[#F4F7F6] border border-[#E2E8F0] text-slate-600 rounded-2xl font-black text-sm hover:bg-white hover:border-[#8FD9A8] transition-colors shadow-sm">
                Thử lại lần nữa
              </button>
            )}
            <Link href="/" className="flex-1 w-full">
              <button className={`w-full px-6 py-4.5 text-white rounded-2xl font-black text-sm shadow-xl transition-colors uppercase tracking-widest border-b-[4px] ${isFailed ? 'bg-[#BE123C] hover:bg-[#9F1239] border-[#881337]' : 'bg-[#1B5E4B] hover:bg-[#2F8F6E] border-[#0F3F31]'}`}>
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
    <main className="min-h-screen bg-[#F4F7F6] pb-20 relative selection:bg-[#8FD9A8]/50">
      <header className="bg-white/90 backdrop-blur-xl border-b border-[#E2E8F0] sticky top-0 z-30 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#EEF5E9] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-[#2F8F6E] text-2xl shadow-inner border border-[#8FD9A8]">🎯</div>
            <div>
              <h1 className="font-black text-[#1B5E4B] text-lg drop-shadow-sm">
                {testMode === 'level' ? `Đánh Giá Năng Lực HSK ${selectedLevel}` : `Bài Test Tổng Hợp Toàn Diện`}
              </h1>
              <p className="text-[10px] font-bold text-[#2F8F6E] uppercase tracking-widest bg-[#8FD9A8]/20 px-2 py-0.5 rounded-md inline-block mt-1 border border-[#8FD9A8]/50">
                {testMode === 'comprehensive' ? "30 Câu Dịch" : (isHSK12 ? "2 Phần • Tổng 200 điểm" : "3 Phần • Tổng 300 điểm")}
              </p>
            </div>
          </div>
          <button 
            onClick={() => {
              if (window.confirm("Bạn có chắc chắn muốn thoát? Bài thi hiện tại sẽ không được lưu.")) {
                setTestMode(null);
                setSelectedLevel(null);
              }
            }} 
            className="px-4 py-2 bg-[#FFF1F2] text-[#BE123C] hover:bg-[#FECDD3] rounded-xl text-xs font-black transition-colors border border-[#FECDD3]/50 shadow-sm"
          >
            Thoát bài thi
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 mt-10 space-y-10 animate-fade-in">
        
        {/* Phần 1: Dịch Câu */}
        {testData?.sections?.translate && testData.sections.translate.length > 0 && (
          <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-8 border-b border-[#F4F7F6] pb-5">
              <span className="text-3xl">✍️</span>
              <div>
                <h3 className="text-2xl font-black text-[#1B5E4B]">Phần {testMode === 'comprehensive' ? 'Thi' : '1'}: Dịch Câu</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{testData.sections.translate.length} Câu</p>
              </div>
            </div>
            
            <div className="space-y-6">
              {testData.sections.translate.map((item, idx) => (
                <div key={`trans-${idx}`} className="bg-[#F4F7F6] p-6 md:p-8 rounded-[32px] border border-[#E2E8F0] shadow-sm">
                  <div className="flex items-start gap-4 mb-5">
                    <span className="w-8 h-8 shrink-0 rounded-full bg-[#1B5E4B] text-white text-sm font-black flex items-center justify-center shadow-md">{idx + 1}</span>
                    <p className="font-bold text-[#1B5E4B] text-lg mt-0.5 bg-white px-4 py-2 rounded-2xl shadow-sm border border-[#E2E8F0]">
                      {item.vietnamese || item.front}
                    </p>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Nhập bản dịch tiếng Trung (Chữ Hán)..."
                    value={answers[`translate_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("translate", idx, e.target.value)}
                    className="w-full p-5 border-2 border-[#E2E8F0] rounded-2xl text-base outline-none focus:border-[#2F8F6E] focus:ring-4 focus:ring-[#8FD9A8]/20 bg-white font-medium text-[#1B5E4B] transition-all placeholder:text-slate-400 shadow-inner"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phần 2: Sắp xếp câu (Dùng Component Click-to-Select) */}
        {testMode === 'level' && testData?.sections?.arrange && testData.sections.arrange.length > 0 && (
          <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-8 border-b border-[#F4F7F6] pb-5">
              <span className="text-3xl">🧩</span>
              <div>
                <h3 className="text-2xl font-black text-[#1B5E4B]">Phần 2: Sắp Xếp Câu</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">10 Câu • 100 điểm</p>
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
          <div className="bg-white rounded-[40px] p-8 md:p-12 shadow-sm border border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-8 border-b border-[#F4F7F6] pb-5">
              <span className="text-3xl">📝</span>
              <div>
                <h3 className="text-2xl font-black text-[#1B5E4B]">Phần 3: Viết Luận / Phản Xạ</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">2 Câu • 100 điểm</p>
              </div>
            </div>
            
            <div className="space-y-8">
              {testData.sections.essay.map((item, idx) => (
                <div key={`essay-${idx}`} className="bg-[#F4F7F6] p-8 rounded-[32px] border border-[#E2E8F0] shadow-sm">
                  <div className="bg-[#1B5E4B] p-5 rounded-2xl shadow-md mb-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
                    <p className="font-bold text-white text-base leading-relaxed relative z-10 flex items-start gap-3">
                      <span className="bg-[#F2765B] text-white px-2 py-0.5 rounded text-sm font-black shrink-0 shadow-sm mt-0.5">Q{idx + 1}</span>
                      {item.prompt}
                    </p>
                  </div>
                  <textarea 
                    rows={5}
                    placeholder="Viết câu trả lời bằng tiếng Trung tại đây (Tối thiểu 40 chữ để lấy điểm tối đa)..."
                    value={answers[`essay_${idx}`] || ""}
                    onChange={(e) => handleAnswerChange("essay", idx, e.target.value)}
                    className="w-full p-6 border-2 border-[#E2E8F0] rounded-3xl text-base outline-none focus:border-[#2F8F6E] focus:ring-4 focus:ring-[#8FD9A8]/20 bg-white font-medium text-[#1B5E4B] transition-all resize-none placeholder:text-slate-400 shadow-inner leading-relaxed"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nút Submit */}
        <div className="pt-8 pb-12 flex justify-center">
          <button 
            type="button"
            onClick={handleSubmit}
            className="w-full md:w-auto md:min-w-[320px] py-5 px-10 bg-[#1B5E4B] text-white rounded-[24px] font-black shadow-xl shadow-[#8FD9A8]/40 hover:bg-[#2F8F6E] hover:-translate-y-1 transition-all text-lg tracking-widest flex items-center justify-center gap-3 uppercase border-b-[6px] border-[#0F3F31]"
          >
            <span>✓</span> Nộp Bài & Nhận Điểm
          </button>
        </div>

      </div>
    </main>
  );
}