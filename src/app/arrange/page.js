"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";

// Cấu hình các cấp độ và số EXP cần thiết để mở khóa
const HSK_LEVELS = [
  { name: "HSK 1", requiredExp: 0 },
  { name: "HSK 2", requiredExp: 1000 },
  { name: "HSK 3", requiredExp: 2000 },
  { name: "HSK 4", requiredExp: 3000 },
  { name: "HSK 5", requiredExp: 4000 },
  { name: "HSK 6", requiredExp: 5000 },
];

// Hàm trộn mảng ngẫu nhiên
const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export default function EndlessArrangePage() {
  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [userExp, setUserExp] = useState(0);
  
  const [currentSentence, setCurrentSentence] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Trạng thái cho trò chơi sắp xếp
  const [shuffledWords, setShuffledWords] = useState([]); // Các từ đang xáo trộn bên dưới
  const [selectedWords, setSelectedWords] = useState([]); // Các từ người dùng đã chọn đưa lên trên
  
  const [showAnswer, setShowAnswer] = useState(false);
  const [feedback, setFeedback] = useState(null); 
  
  const [sentenceHistory, setSentenceHistory] = useState([]);
  const isFetchingRef = useRef(false);

  // Tải dữ liệu từ LocalStorage
  useEffect(() => {
    const savedExp = localStorage.getItem("ai_arrange_exp");
    const savedHistory = localStorage.getItem("ai_arrange_history");
    
    if (savedExp) setUserExp(parseInt(savedExp));
    if (savedHistory) setSentenceHistory(JSON.parse(savedHistory));
    
    if (!currentSentence && !isFetchingRef.current) {
        generateNewSentence("HSK 1", savedHistory ? JSON.parse(savedHistory) : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lưu trữ EXP và Lịch sử
  useEffect(() => {
    localStorage.setItem("ai_arrange_exp", userExp);
  }, [userExp]);

  useEffect(() => {
    if (sentenceHistory.length > 0) {
      const recent = sentenceHistory.slice(-20);
      localStorage.setItem("ai_arrange_history", JSON.stringify(recent));
    }
  }, [sentenceHistory]);

  // HÀM GỌI AI ĐỂ TẠO CÂU MỚI (Dùng chung API /api/dictation)
  const generateNewSentence = async (level, history = sentenceHistory) => {
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setIsLoading(true);
    setFeedback(null);
    setSelectedWords([]);
    setShuffledWords([]);
    setShowAnswer(false);
    
    try {
      const recentTexts = history.slice(-15); 
      
      const res = await fetch('/api/dictation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: level, recentSentences: recentTexts })
      });
      
      if (!res.ok) throw new Error("Lỗi API tạo câu");
      
      const data = await res.json();
      setCurrentSentence(data);
      
      // Xử lý chuỗi: Loại bỏ dấu câu tiếng Trung để làm trò chơi xếp chữ
      const cleanChinese = data.chinese.replace(/[.,?!。，？！、]/g, '');
      // Tách thành mảng từng chữ cái và cấp ID (để xử lý các chữ giống nhau)
      const wordsArray = cleanChinese.split('').map((char, index) => ({ id: index, char }));
      
      setShuffledWords(shuffleArray(wordsArray));
      
    } catch (error) {
      console.error(error);
      alert("Lỗi kết nối AI khi tạo câu. Vui lòng thử lại!");
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        isFetchingRef.current = false;
      }, 500);
    }
  };

  // LOGIC SẮP XẾP TỪ
  const handleSelectWord = (word) => {
    if (feedback === 'correct') return; // Đúng rồi thì không cho chọn nữa
    setShuffledWords(prev => prev.filter(w => w.id !== word.id));
    setSelectedWords(prev => [...prev, word]);
    setFeedback(null);
  };

  const handleDeselectWord = (word) => {
    if (feedback === 'correct') return;
    setSelectedWords(prev => prev.filter(w => w.id !== word.id));
    setShuffledWords(prev => [...prev, word]);
    setFeedback(null);
  };

  // KIỂM TRA ĐÁP ÁN
  const checkAnswer = () => {
    if (!currentSentence) return;
    
    const answerStr = selectedWords.map(w => w.char).join('');
    const expectedStr = currentSentence.chinese.replace(/[.,?!。，？！、]/g, '');
    
    if (answerStr === expectedStr) {
        setFeedback("correct");
        setUserExp(prev => prev + 20); 
        
        setSentenceHistory(prev => {
            const newHistory = [...prev, currentSentence.chinese];
            return newHistory;
        });
        
        // Tự động chuyển câu sau 1.5 giây
        setTimeout(() => {
            if (!isFetchingRef.current) {
                generateNewSentence(selectedHsk);
            }
        }, 1500);
    } else {
        setFeedback("incorrect");
    }
  };

  const handleLevelChange = (e) => {
    const targetLevel = e.target.value;
    setSelectedHsk(targetLevel);
    if (!isFetchingRef.current) {
        generateNewSentence(targetLevel);
    }
  };

  const speak = (text) => {
    if (!text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };

  // Tính toán % thanh EXP
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
        
        {/* CỘT BÊN TRÁI: THANH SIDEBAR & TIẾN ĐỘ EXP (MÀU ORANGE) */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 sticky top-10">
                <Link href="/">
                    <button className="w-full mb-6 px-4 py-3 bg-slate-100 font-bold text-slate-600 rounded-xl hover:bg-slate-200 text-center transition">
                      ← Về Trang Chủ
                    </button>
                </Link>

                <p className="font-bold text-slate-600 mb-2 uppercase tracking-widest text-sm">Chọn Cấp Độ Luyện Tập</p>
                <select 
                    value={selectedHsk} 
                    onChange={handleLevelChange}
                    className="w-full bg-orange-50 border-2 border-orange-200 text-orange-700 font-bold py-3 px-4 rounded-xl outline-none cursor-pointer hover:bg-orange-100 transition mb-6"
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
                    <p className="text-3xl font-black text-orange-500 mb-2">{userExp} <span className="text-sm text-slate-400">EXP</span></p>
                    
                    <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-2">
                        <div className="h-full bg-orange-500 transition-all duration-500" style={{ width: `${expPercent}%` }}></div>
                    </div>
                    
                    {nextLvlObj ? (
                        <p className="text-xs font-bold text-slate-500 text-right">
                            {expPercent}% (Cần thêm {nextLvlObj.requiredExp - userExp} EXP để mở {nextLvlObj.name})
                        </p>
                    ) : (
                        <p className="text-xs font-bold text-orange-500 text-right">ĐÃ MỞ KHÓA TẤT CẢ CẤP ĐỘ!</p>
                    )}
                </div>

                <button 
                  onClick={() => generateNewSentence(selectedHsk)}
                  disabled={isLoading}
                  className="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  🔄 {isLoading ? "Đang tạo..." : "Bỏ qua & Đổi câu khác"}
                </button>
            </div>
        </div>

        {/* CỘT BÊN PHẢI: KHU VỰC SẮP XẾP CÂU */}
        <div className="w-full lg:w-2/3 flex flex-col gap-6">
            
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Chế độ Sinh Tồn AI ({selectedHsk})</h2>
                  <p className="text-slate-500 text-sm mt-1">Luyện phản xạ cấu trúc câu. Xếp đúng để nhận +20 EXP!</p>
                </div>
                <div className="text-4xl">🧩</div>
            </div>

            <div className="w-full bg-white p-10 rounded-3xl shadow-xl border-t-8 border-orange-500 text-center flex flex-col justify-center items-center relative min-h-[450px]">
                
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center animate-pulse">
                        <div className="text-6xl mb-4">✨</div>
                        <h3 className="text-2xl font-bold text-slate-700">AI đang sáng tạo câu mới...</h3>
                        <p className="text-slate-500 mt-2">Phân tích từ vựng và đảo lộn trật tự...</p>
                    </div>
                ) : currentSentence ? (
                    <div className="w-full flex flex-col items-center animate-fade-in">
                        <h3 className="text-orange-400 font-bold tracking-widest uppercase mb-4 text-sm">GỢI Ý NGHĨA TIẾNG VIỆT</h3>

                        <p className="text-3xl sm:text-4xl font-black text-slate-800 mb-10 text-center leading-tight">
                          "{currentSentence.vietnamese}"
                        </p>

                        {/* KHUNG ĐỰNG TỪ ĐÃ CHỌN */}
                        <div className={`w-full max-w-2xl min-h-[100px] border-2 border-dashed rounded-2xl p-4 flex flex-wrap justify-center gap-3 items-center transition-all ${
                            feedback === 'correct' ? 'border-green-500 bg-green-50' : 
                            feedback === 'incorrect' ? 'border-red-500 bg-red-50' : 'border-orange-300 bg-orange-50/30'
                        }`}>
                            {selectedWords.length === 0 && !feedback && (
                                <span className="text-slate-400 font-medium">Chạm vào ô bên dưới để xếp câu...</span>
                            )}
                            
                            {selectedWords.map(word => (
                                <button
                                    key={`sel-${word.id}`}
                                    onClick={() => handleDeselectWord(word)}
                                    className="px-5 py-3 bg-white border-2 border-slate-200 text-slate-700 text-2xl font-bold rounded-xl shadow-sm hover:border-orange-400 hover:-translate-y-1 transition-all"
                                >
                                    {word.char}
                                </button>
                            ))}
                        </div>

                        {/* Thông báo kết quả */}
                        {feedback === 'correct' && (
                            <p className="text-green-600 font-bold mt-6 animate-bounce">✨ Xếp câu chính xác! (+20 EXP)</p>
                        )}
                        {feedback === 'incorrect' && (
                            <p className="text-red-500 font-bold mt-6">❌ Thứ tự chưa đúng, hãy thử lại!</p>
                        )}

                        {/* KHUNG ĐỰNG TỪ CÒN LẠI */}
                        <div className="w-full max-w-2xl mt-8 flex flex-wrap justify-center gap-3">
                            {shuffledWords.map(word => (
                                <button
                                    key={`shuf-${word.id}`}
                                    onClick={() => handleSelectWord(word)}
                                    className="px-5 py-3 bg-white border-2 border-slate-200 text-slate-700 text-2xl font-bold rounded-xl shadow-sm hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:-translate-y-1 transition-all"
                                >
                                    {word.char}
                                </button>
                            ))}
                        </div>

                        {/* Nút Kiểm tra & Đáp án */}
                        <div className="w-full max-w-2xl mt-10 flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={checkAnswer}
                                disabled={feedback === 'correct' || selectedWords.length === 0}
                                className={`flex-1 py-4 rounded-xl font-bold text-xl transition-all shadow-md ${
                                    feedback === 'correct' 
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                                    : 'bg-orange-500 text-white hover:bg-orange-600 hover:shadow-lg'
                                }`}
                            >
                                Kiểm tra
                            </button>
                            
                            <button 
                                onClick={() => {
                                    setShowAnswer(!showAnswer);
                                    if(!showAnswer) speak(currentSentence.chinese);
                                }}
                                className="px-6 py-4 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                            >
                                {showAnswer ? "Ẩn đáp án" : "Xem đáp án"}
                            </button>
                        </div>

                        {showAnswer && (
                            <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-200 animate-fade-in w-full max-w-2xl text-center">
                                <p className="text-4xl font-black text-slate-800 mb-4">{currentSentence.chinese}</p>
                                <p className="text-xl text-slate-600 font-medium mb-2">{currentSentence.pinyin}</p>
                            </div>
                        )}
                    </div>
                ) : (
                   <div className="text-center">
                       <p className="text-slate-500 font-bold mb-4">Chưa có câu nào được tải.</p>
                       <button onClick={() => generateNewSentence(selectedHsk)} className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600">Thử lại</button>
                   </div>
                )}
            </div>
        </div>
      </div>
    </main>
  );
}