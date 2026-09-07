"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { updateUserProgress, logUserError } from "../../lib/firebaseUtils";
import sentencesData from "../sentences.json";

const HSK_LEVELS = ["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"];

// --- HÀM HỖ TRỢ ---
const shuffleArray = (array) => [...array].sort(() => 0.5 - Math.random());
const getRandomItems = (arr, n) => shuffleArray(arr).slice(0, n);

// Thuật toán cắt từ thông minh (Word Chunking)
const segmentWords = (text) => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
    return [...segmenter.segment(text)]
      .map(s => s.segment)
      .filter(s => !/^[.,?!。，？！、\s]+$/.test(s)); // Bỏ qua dấu câu
  }
  return text.replace(/[.!?。，？！、\s]/g, '').split(''); // Fallback
};

export default function ArrangePage() {
  const { user, isLoaded } = useUser();

  // Cấu hình Game
  const [selectedHsk, setSelectedHsk] = useState("HSK 1");
  const [phase, setPhase] = useState("start"); // start, playing, result
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Trạng thái câu hiện tại
  const [availableWords, setAvailableWords] = useState([]);
  const [selectedWords, setSelectedWords] = useState([]);
  const [feedback, setFeedback] = useState(null); // 'correct', 'incorrect', null
  const [showAnswer, setShowAnswer] = useState(false);

  // Gamification
  const [hearts, setHearts] = useState(5);
  const [score, setScore] = useState(0);
  const [earnedXp, setEarnedXp] = useState(0);

  // TEXT TO SPEECH
  const speak = (text) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };

  // KHỞI TẠO LƯỢT CHƠI
  const startGame = () => {
    const targetLvl = selectedHsk.replace(/\s+/g, '').toUpperCase();
    const levelData = sentencesData.filter(item => item.level && item.level.replace(/\s+/g, '').toUpperCase() === targetLvl);

    if (levelData.length === 0) {
      alert(`Chưa có dữ liệu cho ${selectedHsk}`);
      return;
    }

    const sessionQuestions = getRandomItems(levelData, Math.min(10, levelData.length));
    setQuestions(sessionQuestions);
    setCurrentIndex(0);
    setHearts(5);
    setScore(0);
    setPhase("playing");
    loadQuestion(sessionQuestions[0]);
  };

  // TẢI CÂU HỎI MỚI
  const loadQuestion = (questionObj) => {
    const text = questionObj.chinese || questionObj.front || "";
    const words = segmentWords(text);
    setAvailableWords(shuffleArray([...words]).map((text, i) => ({ id: i, text })));
    setSelectedWords([]);
    setFeedback(null);
    setShowAnswer(false);
  };

  // XỬ LÝ CHỌN/BỎ CHỌN TỪ
  const handleSelectWord = (word) => {
    if (feedback === 'correct') return; 
    setAvailableWords(prev => prev.filter(w => w.id !== word.id));
    setSelectedWords(prev => [...prev, word]);
    setFeedback(null);
  };

  const handleDeselectWord = (word) => {
    if (feedback === 'correct') return;
    setSelectedWords(prev => prev.filter(w => w.id !== word.id));
    setAvailableWords(prev => [...prev, word]);
    setFeedback(null);
  };

  const handleClearAll = () => {
    if (feedback === 'correct') return;
    setAvailableWords(prev => [...prev, ...selectedWords]);
    setSelectedWords([]);
    setFeedback(null);
  };

  // KIỂM TRA ĐÁP ÁN
  const checkAnswer = async () => { 
    if (selectedWords.length === 0) return;
    
    const currentQ = questions[currentIndex];
    const correctAns = (currentQ.chinese || currentQ.front || "").replace(/[.!?。，？！、\s]/g, '');
    const userAns = selectedWords.map(w => w.text).join('');
    
    if (userAns === correctAns) {
        setFeedback("correct");
        setScore(prev => prev + 1);
        setShowAnswer(false);
        speak(correctAns);
    } else {
        setFeedback("incorrect");
        setHearts(prev => prev - 1);
        
        // Ghi nhận mã gen lỗi sai nếu user đăng nhập
        if (user) {
          await logUserError(user.id, "arrange_grammar_error");
        }

        if (hearts - 1 <= 0) {
          setTimeout(() => endGame(score), 1000);
        }
    }
  };

  // CHUYỂN CÂU TIẾP THEO
  const nextQuestion = () => {
    if (currentIndex + 1 >= questions.length || hearts <= 0) {
      endGame(score);
    } else {
      setCurrentIndex(prev => prev + 1);
      loadQuestion(questions[currentIndex + 1]);
    }
  };

  // KẾT THÚC GAME & CỘNG ĐIỂM
  const endGame = async (finalScore) => {
    setPhase("result");
    const xp = finalScore * 15; // 15 XP cho 1 câu đúng
    setEarnedXp(xp);

    if (user && xp > 0) {
      await updateUserProgress(user.id, xp, "grammar", finalScore);
    }
  };

  const progressPercent = questions.length > 0 ? (currentIndex / questions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-[#F4F8F5] font-sans text-slate-800 relative overflow-hidden flex flex-col selection:bg-emerald-200">
      
      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0 opacity-40 pointer-events-none" style={{ backgroundImage: "url('/hskk/sapxep.jpg')" }}>
        <div className="absolute inset-0 bg-[#F4F8F5]/80 backdrop-blur-[2px]"></div>
      </div>

      {/* HEADER TỔNG THỂ */}
      <header className="relative z-20 w-full bg-white/80 backdrop-blur-xl border-b border-emerald-100 shadow-sm sticky top-0">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 bg-[#08A66A] rounded-full flex items-center justify-center text-white text-2xl shadow-sm">🐸</div>
            <div className="hidden sm:block">
              <h1 className="font-black text-slate-900 text-lg leading-tight">Hành Trình HSK</h1>
              <p className="text-[10px] text-[#08A66A] font-bold uppercase tracking-wider mt-0.5">Xếp Gạch Ngữ Pháp</p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 text-sm font-black bg-[#DDF7EA] text-[#08A66A] px-4 py-1.5 rounded-full border border-[#08A66A]/20 shadow-sm">
              🧩 Sắp Xếp Câu
            </div>
            
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              {isLoaded && user ? (
                <UserButton afterSignOutUrl="/" />
              ) : (
                <SignInButton mode="modal">
                  <button className="px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-md hover:bg-slate-800 transition">Đăng nhập</button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col items-center w-full py-10 px-4 md:px-6 overflow-y-auto">
        
        {/* =========================================
            PHASE 1: MÀN HÌNH BẮT ĐẦU (START)
            ========================================= */}
        {phase === "start" && (
          <div className="w-full max-w-xl animate-slide-up-fade text-center mt-10 bg-white/95 backdrop-blur-xl p-10 rounded-[40px] shadow-sm border border-white">
            <div className="w-24 h-24 bg-[#DDF7EA] rounded-[32px] mx-auto flex items-center justify-center text-5xl mb-6 shadow-inner border border-emerald-100">🧩</div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 tracking-tight">Trò Chơi Xếp Gạch</h2>
            <p className="text-slate-600 font-medium mb-8 leading-relaxed">
              Huấn luyện tư duy cấu trúc ngữ pháp. Bạn có <span className="text-rose-500 font-black">5 ❤️</span> cho mỗi lượt. Xếp đúng 10 câu để nhận HSK XP!
            </p>
            
            <div className="mb-8 text-left bg-slate-50 p-6 rounded-[24px] border border-slate-100">
              <label className="font-black text-slate-400 uppercase tracking-widest text-[10px] block mb-2">Chọn cấp độ luyện tập</label>
              <select 
                  value={selectedHsk} 
                  onChange={(e) => setSelectedHsk(e.target.value)}
                  className="w-full bg-white border-2 border-emerald-100 text-[#087A55] text-lg font-black py-4 px-5 rounded-2xl outline-none cursor-pointer hover:border-[#08A66A] transition shadow-sm appearance-none"
              >
                  {HSK_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
              </select>
            </div>

            <button 
              onClick={startGame} 
              className="w-full py-5 bg-[#08A66A] text-white font-black text-lg rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-[#087A55] hover:-translate-y-1 transition-all uppercase tracking-widest flex justify-center items-center gap-2"
            >
              Bắt Đầu Ghép Câu <span>➔</span>
            </button>
          </div>
        )}

        {/* =========================================
            PHASE 2: TRONG GAME (PLAYING)
            ========================================= */}
        {phase === "playing" && questions.length > 0 && (
          <div className="w-full max-w-3xl animate-fade-in flex flex-col items-center">
            
            {/* Header: Tiến độ & Tim */}
            <div className="w-full flex items-center justify-between bg-white/90 backdrop-blur-xl p-5 rounded-[24px] shadow-sm border border-white mb-6">
              <div className="flex items-center gap-1 text-rose-500 font-black text-xl">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`transition-all ${i < hearts ? "opacity-100 scale-100" : "opacity-20 grayscale scale-75"}`}>❤️</span>
                ))}
              </div>
              <div className="flex-1 mx-6 h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#08A66A] rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <div className="font-black text-slate-400 bg-slate-50 px-4 py-1.5 rounded-lg border border-slate-100">{currentIndex + 1} / 10</div>
            </div>

            {/* Màn hình Ghép Câu */}
            <div className="w-full bg-white/95 backdrop-blur-xl p-8 rounded-[32px] shadow-sm border border-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#DDF7EA] to-transparent rounded-bl-full pointer-events-none opacity-50"></div>
              
              <div className="relative z-10">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <span className="text-base">🧩</span> Chạm vào từ để ghép câu
                </p>
                
                {/* Khu vực Drop (Các từ đã chọn) */}
                <div className={`w-full min-h-[120px] rounded-[24px] p-6 flex flex-wrap content-start gap-3 items-center transition-all mb-8 ${
                    feedback === 'correct' ? 'border-2 border-[#08A66A] bg-[#DDF7EA]/50 shadow-inner' : 
                    feedback === 'incorrect' ? 'border-2 border-rose-400 bg-rose-50/50 shadow-inner animate-shake' : 
                    'border-2 border-dashed border-emerald-200 bg-[#F4F8F5]'
                }`}>
                  {selectedWords.length === 0 && !feedback && (
                      <span className="text-slate-400 font-medium w-full text-center py-4 opacity-60">
                          (Khu vực ghép câu)
                      </span>
                  )}
                  {selectedWords.map((word) => (
                      <button
                          key={`sel-${word.id}`}
                          onClick={() => handleDeselectWord(word)}
                          className={`px-6 py-3 bg-white border-2 border-emerald-100 text-[#172033] text-2xl font-black rounded-2xl shadow-sm hover:border-rose-300 hover:bg-rose-50 transition-all ${feedback === 'correct' ? 'pointer-events-none border-transparent shadow-none bg-[#08A66A] text-white' : ''}`}
                      >
                          {word.text}
                      </button>
                  ))}
                </div>

                {/* Feedback Thông Báo */}
                {feedback === 'correct' && (
                    <div className="mb-8 p-6 bg-[#DDF7EA] border border-[#08A66A]/30 rounded-[24px] flex items-center gap-4 animate-slide-up-fade shadow-sm">
                        <div className="text-5xl">🎉</div>
                        <div>
                            <h4 className="font-black text-[#087A55] text-lg mb-1">太棒了！Tuyệt vời!</h4>
                            <p className="text-sm font-bold text-[#08A66A]">Sắp xếp hoàn toàn chính xác.</p>
                        </div>
                    </div>
                )}

                {feedback === 'incorrect' && (
                    <div className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-[24px] flex items-start gap-4 animate-slide-up-fade">
                        <div className="text-4xl mt-1">💔</div>
                        <div>
                            <h4 className="font-black text-rose-700 text-lg mb-1">再试一次！Sai rồi!</h4>
                            <p className="text-sm font-bold text-rose-600 mb-2">Thứ tự chưa chính xác. Bạn bị trừ 1 ❤️.</p>
                            <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-sm mt-2 inline-block">
                              <p className="text-xs font-black text-[#FFC83D] mb-1">💡 LỜI KHUYÊN:</p>
                              <p className="text-xs text-slate-600 font-medium">Hãy nhớ trật tự cơ bản: Chủ ngữ → Vị ngữ → Tân ngữ</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Gợi ý đáp án (Khi sai) */}
                {showAnswer && feedback !== 'correct' && (
                    <div className="mb-8 p-6 bg-slate-50 rounded-[24px] border border-slate-200 animate-fade-in relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#FFC83D]"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Đáp án tham khảo</p>
                        <p className="text-2xl font-black text-[#172033] tracking-widest">{questions[currentIndex].chinese || questions[currentIndex].front}</p>
                    </div>
                )}

                {/* Khu vực Chọn (Các từ còn lại) */}
                {feedback !== 'correct' && (
                  <div className="w-full mt-2 mb-10 flex flex-wrap justify-center gap-3">
                      {availableWords.map(word => (
                          <button
                              key={`avail-${word.id}`}
                              onClick={() => handleSelectWord(word)}
                              className="px-6 py-3 bg-white border-2 border-slate-100 text-slate-800 text-2xl font-black rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:-translate-y-1 hover:border-[#08A66A] hover:text-[#08A66A] transition-all"
                          >
                              {word.text}
                          </button>
                      ))}
                  </div>
                )}

                {/* Các nút hành động */}
                <div className="mt-auto flex flex-col sm:flex-row gap-4 pt-6 border-t border-slate-100">
                    {feedback === 'correct' ? (
                        <button 
                            onClick={nextQuestion}
                            className="w-full py-4.5 bg-[#172033] text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2 uppercase tracking-widest"
                        >
                            Câu tiếp theo ➔
                        </button>
                    ) : (
                        <>
                            <button 
                                onClick={() => setShowAnswer(!showAnswer)}
                                className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:border-[#FFC83D] hover:text-amber-600 hover:bg-[#FFF8E8] transition-all shadow-sm flex items-center justify-center gap-2"
                            >
                                <span className="text-lg">💡</span> {showAnswer ? "Ẩn gợi ý" : "Xem gợi ý"}
                            </button>
                            
                            <button 
                                onClick={handleClearAll}
                                disabled={selectedWords.length === 0}
                                className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-500 rounded-2xl font-black text-sm hover:border-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-lg">↶</span> Làm lại
                            </button>

                            <button 
                                onClick={checkAnswer}
                                disabled={selectedWords.length === 0}
                                className="flex-[2] py-4 bg-[#08A66A] text-white rounded-2xl font-black text-sm hover:bg-[#087A55] transition-all shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
                            >
                                Kiểm tra →
                            </button>
                        </>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================
            PHASE 3: MÀN HÌNH KẾT QUẢ (RESULT)
            ========================================= */}
        {phase === "result" && (
          <div className="w-full max-w-xl animate-slide-up-fade text-center mt-10 bg-white/95 backdrop-blur-xl p-10 md:p-14 rounded-[40px] shadow-2xl border border-white">
            <div className="text-8xl mb-6">{hearts > 0 ? "🎉" : "💔"}</div>
            <p className="text-[10px] font-black text-[#08A66A] uppercase tracking-widest mb-2">Hoàn thành phiên tập</p>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-8">{hearts > 0 ? "Rất Xuất Sắc!" : "Hết Năng Lượng!"}</h2>

            <div className="bg-[#FFF8E8] border border-[#FFC83D]/40 rounded-3xl p-8 mb-10 text-center shadow-inner flex justify-around">
              <div>
                <p className="text-xs font-bold text-amber-700 mb-2">Số câu đúng</p>
                <p className="text-4xl font-black text-slate-800">{score} <span className="text-lg text-slate-400">/ {questions.length}</span></p>
              </div>
              <div className="w-px bg-[#FFC83D]/30"></div>
              <div>
                <p className="text-xs font-bold text-amber-700 mb-2">HSK XP nhận được</p>
                <p className="text-4xl font-black text-[#FFC83D] drop-shadow-sm">⭐ +{earnedXp}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/" className="flex-1">
                <button className="w-full py-4.5 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition uppercase tracking-widest text-sm border border-slate-200">
                  Về Bản Đồ
                </button>
              </Link>
              <button 
                onClick={() => setPhase("start")} 
                className="flex-1 py-4.5 bg-[#08A66A] text-white font-black rounded-2xl shadow-xl hover:bg-[#087A55] transition uppercase tracking-widest text-sm"
              >
                Chơi Lại Lần Nữa
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}