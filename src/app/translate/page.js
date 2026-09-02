"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
// ĐƯỜNG DẪN TỚI FILE JSON (Giữ nguyên cấu trúc đúng của bạn)
import arrangeData from "../arrange.json"; 

// THIẾT LẬP LẠI THANG ĐIỂM: MỖI CẤP CÁCH NHAU 5000 EXP
const HSK_LEVELS = [
  { name: "HSK 1", requiredExp: 0 },
  { name: "HSK 2", requiredExp: 5000 },
  { name: "HSK 3", requiredExp: 10000 },
  { name: "HSK 4", requiredExp: 15000 },
  { name: "HSK 5", requiredExp: 20000 },
  { name: "HSK 6", requiredExp: 25000 },
];

export default function TranslatePage() {
  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [userExp, setUserExp] = useState(0); 
  
  const [currentSentence, setCurrentSentence] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false); 
  
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [evaluation, setEvaluation] = useState(null); 
  const [errorMsg, setErrorMsg] = useState(null);
  
  const [sentenceHistory, setSentenceHistory] = useState([]);

  useEffect(() => {
    const savedExp = localStorage.getItem("ai_translate_exp");
    const savedHistory = localStorage.getItem("ai_translate_history");
    
    if (savedExp) setUserExp(parseInt(savedExp));
    
    let historyArr = [];
    if (savedHistory) {
        historyArr = JSON.parse(savedHistory);
        setSentenceHistory(historyArr);
    }
    
    generateNewSentence("HSK 1", historyArr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("ai_translate_exp", userExp);
  }, [userExp]);

  useEffect(() => {
    // Để tránh file history quá nặng khi cày nhiều EXP, ta chỉ lưu 50 câu gần nhất
    if (sentenceHistory.length > 0) {
      const recent = sentenceHistory.slice(-50);
      localStorage.setItem("ai_translate_history", JSON.stringify(recent));
    }
  }, [sentenceHistory]);

  const generateNewSentence = (level, history = sentenceHistory) => {
    setIsLoading(true);
    setEvaluation(null);
    setUserInput("");
    setShowAnswer(false);
    setErrorMsg(null);
    
    try {
      const targetLvl = level.replace(/\s+/g, '').toUpperCase();
      
      // Lọc câu theo cấp độ và chưa xuất hiện trong lịch sử gần đây
      let availableSentences = arrangeData.filter(item => {
          if (!item.level) return false;
          const itemLvl = item.level.replace(/\s+/g, '').toUpperCase();
          return itemLvl === targetLvl && !history.includes(item.vietnamese);
      });

      // Nếu người dùng cày cuốc làm hết sạch kho dữ liệu, hệ thống sẽ tự động xoay vòng làm lại từ đầu
      if (availableSentences.length === 0) {
          const totalInLevel = arrangeData.filter(item => item.level && item.level.replace(/\s+/g, '').toUpperCase() === targetLvl);
          if (totalInLevel.length === 0) {
               throw new Error(`Chưa có dữ liệu cho ${level} trong file JSON.`);
          } else {
               availableSentences = totalInLevel; // Reset vòng lặp
          }
      }

      const randomIndex = Math.floor(Math.random() * availableSentences.length);
      
      setTimeout(() => {
          setCurrentSentence(availableSentences[randomIndex]);
          setIsLoading(false);
      }, 200); 
      
    } catch (error) {
      setCurrentSentence(null); 
      setErrorMsg(error.message);
      setIsLoading(false);
    }
  };

  const submitTranslation = async () => {
    if (!currentSentence || !userInput.trim()) return;
    setIsGrading(true);
    setEvaluation(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            action: "grade",
            vietnamese: currentSentence.vietnamese,
            chinese: currentSentence.chinese,
            userInput: userInput.trim()
        })
      });

      if (!res.ok) throw new Error("Lỗi khi kết nối với Giáo viên AI");
      
      const result = await res.json();
      setEvaluation(result);

      if (result.isCorrect) {
          // Thưởng EXP cho người dùng (có thể tùy chỉnh điểm ở đây)
          setUserExp(prev => prev + 30); 
          setSentenceHistory(prev => [...prev, currentSentence.vietnamese]); 
      }
    } catch (error) {
      setErrorMsg(error.message);
    } finally {
      setIsGrading(false);
    }
  };

  const handleKeyDown = (e) => {
      if (e.key === 'Enter' && !isLoading && !isGrading && userInput.trim() && !evaluation?.isCorrect) {
          submitTranslation();
      }
  };

  // TÍNH TOÁN TIẾN ĐỘ EXP CHO GIAO DIỆN
  const currentLevelIndex = HSK_LEVELS.findIndex(
    (l, idx) => userExp >= l.requiredExp && (idx === HSK_LEVELS.length - 1 || userExp < HSK_LEVELS[idx + 1].requiredExp)
  );
  const currentLvlObj = HSK_LEVELS[currentLevelIndex !== -1 ? currentLevelIndex : 0];
  const nextLvlObj = HSK_LEVELS[currentLevelIndex + 1];
  
  let expPercent = 100;
  if (nextLvlObj) {
      const expInCurrentLevel = userExp - currentLvlObj.requiredExp;
      const expNeeded = nextLvlObj.requiredExp - currentLvlObj.requiredExp;
      expPercent = Math.min(Math.round((expInCurrentLevel / expNeeded) * 100), 100);
  }

  return (
    <main className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        
        {/* SIDEBAR */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-10">
                <Link href="/">
                    <button className="w-full mb-6 px-4 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 text-center transition">
                      ← Trở về Trang Chủ
                    </button>
                </Link>

                <p className="font-bold text-slate-600 mb-2 uppercase tracking-widest text-sm">Chọn Cấp Độ Dịch</p>
                <select 
                    value={selectedHsk} 
                    onChange={(e) => {
                        setSelectedHsk(e.target.value);
                        generateNewSentence(e.target.value);
                    }}
                    className="w-full bg-blue-50 border-2 border-blue-200 text-blue-700 font-bold py-3 px-4 rounded-xl outline-none cursor-pointer hover:bg-blue-100 transition mb-6"
                >
                    {HSK_LEVELS.map(lvl => {
                        const isUnlocked = userExp >= lvl.requiredExp;
                        return (
                            <option key={lvl.name} value={lvl.name} disabled={!isUnlocked}>
                                {lvl.name} {isUnlocked ? "" : `(Cần ${lvl.requiredExp} EXP)`}
                            </option>
                        );
                    })}
                </select>

                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-6">
                    <p className="text-sm font-bold text-slate-500 mb-1">ĐIỂM KINH NGHIỆM</p>
                    <p className="text-3xl font-black text-blue-500 mb-2">{userExp} <span className="text-sm text-slate-400">EXP</span></p>
                    
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-blue-400 transition-all duration-500" style={{ width: `${expPercent}%` }}></div>
                    </div>
                    
                    {nextLvlObj ? (
                        <p className="text-xs font-bold text-slate-500 text-right">
                            {expPercent}% (Cần thêm {nextLvlObj.requiredExp - userExp} EXP để mở {nextLvlObj.name})
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-blue-500 text-right">ĐÃ MỞ KHÓA TẤT CẢ CẤP ĐỘ!</p>
                    )}
                </div>

                <button 
                  onClick={() => generateNewSentence(selectedHsk)}
                  disabled={isLoading || isGrading}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition disabled:opacity-50"
                >
                  🔄 {isLoading ? "Đang lấy câu..." : "Đổi câu ngẫu nhiên"}
                </button>
            </div>
        </div>

        {/* KHU VỰC DỊCH THUẬT */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Thử Thách Dịch Thuật ({selectedHsk})</h2>
                  <p className="text-slate-500 text-sm mt-1">Dịch câu sau sang tiếng Trung. AI sẽ linh hoạt chấm điểm theo ngữ nghĩa!</p>
                </div>
                <div className="text-4xl">✍️</div>
            </div>

            <div className="w-full bg-white p-10 rounded-3xl shadow-xl border-t-8 border-blue-500 text-center flex flex-col justify-center items-center relative min-h-[450px]">
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="text-6xl mb-4">🗂️</div>
                        <h3 className="text-2xl font-bold text-slate-700">Đang chọn đề từ thư viện...</h3>
                    </div>
                ) : currentSentence ? (
                    <div className="w-full flex flex-col items-center animate-fade-in">
                        <h3 className="text-slate-400 font-bold tracking-widest uppercase mb-4">Hãy dịch câu này sang tiếng Trung</h3>
                        
                        <div className="bg-blue-50 px-8 py-6 rounded-2xl border border-blue-100 mb-8 w-full max-w-lg">
                            <p className="text-2xl font-medium text-slate-800 leading-relaxed">{currentSentence.vietnamese}</p>
                        </div>

                        <input 
                            type="text"
                            value={userInput}
                            onChange={(e) => {
                                setUserInput(e.target.value);
                                setEvaluation(null);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhập bản dịch tiếng Trung của bạn vào đây..."
                            className={`w-full max-w-lg text-center text-xl p-4 rounded-xl border-2 outline-none transition-all ${
                                evaluation?.isCorrect === true ? 'border-green-500 bg-green-50 text-green-700' :
                                evaluation?.isCorrect === false ? 'border-red-500 bg-red-50 text-red-700' :
                                'border-slate-300 focus:border-blue-500 text-slate-800'
                            }`}
                            disabled={evaluation?.isCorrect || isGrading}
                        />

                        {isGrading && (
                            <p className="text-blue-500 font-bold mt-4 animate-pulse">👨‍🏫 Giáo viên AI đang đọc và chấm bài...</p>
                        )}

                        {evaluation && (
                            <div className={`mt-6 p-4 rounded-xl w-full max-w-lg text-left border ${evaluation.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                <p className={`font-bold mb-1 ${evaluation.isCorrect ? 'text-green-700' : 'text-red-600'}`}>
                                    {evaluation.isCorrect ? "✨ Dịch rất tốt (+30 EXP)" : "❌ Cần chỉnh sửa lại"}
                                </p>
                                <p className="text-slate-700 text-sm">{evaluation.message}</p>
                                
                                {evaluation.isCorrect && (
                                     <button onClick={() => generateNewSentence(selectedHsk)} className="mt-4 px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition w-full">
                                         Tiếp tục câu hỏi mới ➔
                                     </button>
                                )}
                            </div>
                        )}

                        {!evaluation?.isCorrect && (
                            <button 
                                onClick={submitTranslation}
                                disabled={isGrading || !userInput.trim()}
                                className="w-full max-w-lg mt-6 py-4 rounded-xl font-bold text-xl transition-all shadow-md bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg disabled:opacity-50"
                            >
                                Nộp bài cho AI chấm
                            </button>
                        )}

                        <button 
                            onClick={() => setShowAnswer(!showAnswer)}
                            className="mt-6 text-slate-500 underline hover:text-blue-600 transition"
                        >
                            {showAnswer ? "Ẩn gợi ý" : "Bí quá? Xem đáp án chuẩn"}
                        </button>

                        {showAnswer && (
                            <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-fade-in w-full max-w-lg text-center">
                                <p className="text-3xl font-black text-slate-800 mb-4">{currentSentence.chinese}</p>
                                <p className="text-xl text-slate-600 font-medium mb-2">{currentSentence.pinyin}</p>
                                <p className="text-blue-700 text-sm italic">Lưu ý: Bạn không cần gõ giống 100% đáp án này, AI sẽ chấm điểm dựa trên ngữ nghĩa câu bạn nhập.</p>
                            </div>
                        )}
                    </div>
                ) : (
                   <div className="text-center bg-red-50 p-6 rounded-2xl border border-red-200">
                       <p className="text-red-600 font-bold text-xl mb-2">Thông báo</p>
                       <p className="text-red-500 font-medium mb-6 max-w-md mx-auto">{errorMsg || "Lỗi không xác định"}</p>
                   </div>
                )}
            </div>
        </div>
      </div>
    </main>
  );
}