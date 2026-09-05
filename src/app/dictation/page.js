"use client";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import dictationData from "../dictation.json"; 
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Danh sách ảnh nền có sẵn trong thư mục public/hskk/ để chèn luân phiên
const bgImagePool = [
  "/hskk/anh1.jpg", "/hskk/anh2.jpg", "/hskk/anh3.jpg", 
  "/hskk/anh4.jpg", "/hskk/anh5.jpg", "/hskk/anh6.jpg",
  "/hskk/sapxep.jpg", "/hskk/thucchien.jpg", "/hskk/kiemtra.jpg", 
  "/hskk/hskk.jpg", "/hskk/nghechep.jpg", "/hskk/topic.jpg", "/hskk/tuvung.jpg"
];

export default function DictationPage() {
  const { user, isLoaded } = useUser();
  const audioRef = useRef(null);
  const inputRef = useRef(null);

  // Các bước điều hướng
  const [step, setStep] = useState("SELECT_CURRICULUM"); 
  const [selectedCurriculum, setSelectedCurriculum] = useState(null);
  const [selectedHskLevel, setSelectedHskLevel] = useState(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [currentCard, setCurrentCard] = useState(null); 

  const [userData, setUserData] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [userInput, setUserInput] = useState("");
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState(null);

  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const waveformHeights = [
    4, 6, 8, 4, 12, 16, 24, 20, 12, 8, 16, 32, 40, 24, 16, 8, 12, 20, 36, 48, 
    56, 40, 24, 16, 20, 32, 24, 12, 8, 16, 24, 12, 8, 4, 8, 4, 6, 4
  ];

  const streak = userData?.streakCount || 0;

  useEffect(() => {
    const fetchUserData = async () => {
      if (user) {
        try {
          const docRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) setUserData(docSnap.data());
          else setUserData({});
        } catch (error) {
          console.error("Lỗi lấy dữ liệu:", error);
          setUserData({});
        } finally {
          setLoadingUser(false);
        }
      } else {
        setUserData({});
        setLoadingUser(false);
      }
    };
    fetchUserData();
  }, [user]);

  const checkAnswer = async () => {
      if (!currentCard || !userInput.trim()) return;
      
      const cleanUser = userInput.replace(/[.,!?，。？！\s]/g, "");
      const cleanTarget = currentCard.fullText.replace(/[.,!?，。？！\s]/g, "");

      if (cleanUser === cleanTarget) {
          setIsCorrect(true);
          if (user) {
            try {
              const studentRef = doc(db, "progress", user.id);
              await setDoc(studentRef, { lastActiveDictation: currentCard.id }, { merge: true });
            } catch (error) {
              console.error("Lỗi đồng bộ Firebase:", error);
            }
          }
      } else {
          setIsCorrect(false);
      }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  };

  // LOGIC LỌC DỮ LIỆU ĐÃ FIX LỖI TẢI NHẦM BÀI
  const filteredByCurriculum = dictationData.filter(item => {
    const isNew = selectedCurriculum === "newhsk" ? item.audioUrl?.includes("newhsk") : (item.audioUrl?.includes("oldhsk") || !item.audioUrl?.includes("newhsk"));
    const matchesLevel = item.level?.toLowerCase().includes(selectedHskLevel?.toLowerCase());
    return isNew && matchesLevel;
  });

  const lessonsMap = {};
  filteredByCurriculum.forEach(item => {
    const lessonKey = item.lesson ? item.lesson.split("-")[0].trim() : "Bài 1";
    if (!lessonsMap[lessonKey]) lessonsMap[lessonKey] = [];
    lessonsMap[lessonKey].push(item);
  });

  const totalStandardLessons = ["Bài 1", "Bài 2", "Bài 3", "Bài 4", "Bài 5", "Bài 6", "Bài 7", "Bài 8", "Bài 9", "Bài 10", "Bài 11", "Bài 12", "Bài 13", "Bài 14", "Bài 15"];

  const cardsInLesson = lessonsMap[selectedLesson] || [];
  const currentCardIndex = cardsInLesson.findIndex(c => c.id === currentCard?.id);

  if (loadingUser) {
    return (
      <div className="min-h-screen bg-[#F4F8F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="text-6xl animate-bounce">🐸</div>
          <p className="font-black text-[#08A66A] tracking-widest uppercase">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F8F5] font-sans text-slate-800 relative overflow-hidden flex flex-col selection:bg-emerald-200">
      
      {/* BACKGROUND ẢNH CÓ LỚP PHỦ MỜ CHO TOÀN TRANG */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ backgroundImage: "url('/hskk/backcover.jpg')" }}
      >
        <div className="absolute inset-0 bg-[#F4F8F5]/90 backdrop-blur-[2px]"></div>
      </div>

      {/* HEADER CỐ ĐỊNH TẦNG 1 */}
      <header className="relative z-20 bg-white/80 backdrop-blur-md border-b border-emerald-100 shadow-sm sticky top-0">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 bg-[#08A66A] rounded-full flex items-center justify-center text-white text-2xl shadow-sm">🐸</div>
            <div>
              <h1 className="font-black text-slate-900 text-lg leading-tight">Hành Trình HSK</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Học tiếng Trung, chạm đến tương lai</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2">
            <Link href="/" className="px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-emerald-50 hover:text-[#08A66A] transition-colors flex items-center gap-2">
              <span className="text-lg">🏠</span> Trang chủ
            </Link>
            <Link href="/vocab" className="px-5 py-2.5 rounded-2xl text-sm font-bold text-slate-500 hover:bg-emerald-50 hover:text-[#08A66A] transition-colors flex items-center gap-2">
              <span className="text-lg">📚</span> Học tập
            </Link>
            <div className="px-5 py-2.5 rounded-2xl text-sm font-black bg-[#DDF7EA] text-[#08A66A] shadow-sm flex items-center gap-2 cursor-pointer">
              <span className="text-lg">🎧</span> Nghe chép
            </div>
          </nav>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-emerald-50">
              <span className="text-amber-500 text-lg">🔥</span>
              <div className="flex flex-col">
                <span className="font-black text-slate-800 text-xs leading-none">{streak} ngày</span>
                <span className="text-[8px] text-slate-400 font-bold">Chuỗi học liên tiếp</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
              {isLoaded && user ? (
                <div className="flex items-center gap-2">
                  <div className="text-right hidden sm:block">
                    <p className="text-[9px] text-slate-400 font-bold">Xin chào,</p>
                    <p className="text-xs font-black text-slate-800">{user.firstName || "Bạn"}</p>
                  </div>
                  <UserButton afterSignOutUrl="/" />
                </div>
              ) : (
                <SignInButton mode="modal">
                  <button className="px-4 py-2 bg-[#08A66A] text-white text-xs font-bold rounded-xl shadow-md">Đăng nhập</button>
                </SignInButton>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto scrollbar-hide py-8">
        
        {/* === STEP 1: CHỌN GIÁO TRÌNH === */}
        {step === "SELECT_CURRICULUM" && (
          <div className="max-w-4xl mx-auto px-6 mt-10">
            <div className="text-center mb-12">
              <span className="text-6xl mb-4 inline-block drop-shadow-md">🎧</span>
              <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Luyện Nghe Chép Chính Tả</h2>
              <p className="text-slate-500 font-medium">Lựa chọn giáo trình phù hợp để bắt đầu hành trình cải thiện kỹ năng nghe của bạn.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Card HSK 3.0 */}
              <div 
                onClick={() => { setSelectedCurriculum("newhsk"); setStep("SELECT_HSK_LEVEL"); }}
                className="rounded-[32px] shadow-lg border-2 border-white hover:border-[#08A66A] hover:-translate-y-2 transition-all cursor-pointer flex flex-col items-center text-center group relative overflow-hidden bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/hskk/tuvung.jpg')" }}
              >
                <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px] pointer-events-none z-0 group-hover:bg-white/75 transition-all"></div>
                <div className="absolute top-0 right-0 bg-[#08A66A] text-white text-[10px] font-black px-4 py-1.5 rounded-bl-2xl uppercase tracking-wider shadow-sm z-10">Khuyên dùng</div>
                
                <div className="relative z-10 p-10 flex flex-col items-center">
                  <div className="w-24 h-24 bg-[#DDF7EA] rounded-[24px] flex items-center justify-center text-5xl mb-8 group-hover:scale-110 group-hover:rotate-6 transition duration-500 shadow-inner">📚</div>
                  <h3 className="text-2xl font-black text-slate-800 group-hover:text-[#08A66A] transition mb-3">HSK 3.0 (Chuẩn mới)</h3>
                  <p className="text-slate-600 font-medium text-sm leading-relaxed">Giáo trình cập nhật nhất, bám sát cấu trúc đề thi thực tế và từ vựng thông dụng hiện nay.</p>
                </div>
              </div>

              {/* Card HSK 2.0 */}
              <div 
                onClick={() => { setSelectedCurriculum("oldhsk"); setStep("SELECT_HSK_LEVEL"); }}
                className="rounded-[32px] shadow-md border-2 border-white hover:border-[#FFC83D] hover:-translate-y-2 transition-all cursor-pointer flex flex-col items-center text-center group relative overflow-hidden bg-cover bg-center bg-no-repeat opacity-90 hover:opacity-100"
                style={{ backgroundImage: "url('/hskk/topic.jpg')" }}
              >
                <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px] pointer-events-none z-0 group-hover:bg-white/75 transition-all"></div>
                
                <div className="relative z-10 p-10 flex flex-col items-center">
                  <div className="w-24 h-24 bg-[#FFF8E8] rounded-[24px] flex items-center justify-center text-5xl mb-8 group-hover:scale-110 group-hover:-rotate-6 transition duration-500 shadow-inner">📖</div>
                  <h3 className="text-2xl font-black text-slate-800 group-hover:text-[#D79A00] transition mb-3">HSK 2.0 (Cũ)</h3>
                  <p className="text-slate-600 font-medium text-sm leading-relaxed">Hệ thống giáo trình truyền thống, quen thuộc và phù hợp để luyện tập bổ trợ.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === STEP 2: CHỌN CẤP ĐỘ === */}
        {step === "SELECT_HSK_LEVEL" && (
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center justify-between mb-10 relative z-10">
              <button 
                onClick={() => setStep("SELECT_CURRICULUM")}
                className="px-5 py-2.5 bg-white font-bold text-slate-600 rounded-2xl shadow-sm hover:text-[#08A66A] transition border border-white cursor-pointer flex items-center gap-2"
              >
                <span>←</span> Quay lại giáo trình
              </button>
              <div className="bg-[#08A66A] text-white px-5 py-2 rounded-2xl text-xs font-black shadow-md flex items-center gap-2">
                <span>{selectedCurriculum === "newhsk" ? "📚" : "📖"}</span> {selectedCurriculum === "newhsk" ? "HSK 3.0" : "HSK 2.0"}
              </div>
            </div>

            <div className="mb-10 relative z-10">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Hành trình tới mục tiêu nào?</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {["HSK 1", "HSK 2", "HSK 3", "HSK 4", "HSK 5", "HSK 6"].map((lvl, index) => {
                // Đã fix lỗi đếm ở đây
                const countInLevel = dictationData.filter(d => {
                  const matchesCurriculum = selectedCurriculum === "newhsk" ? d.audioUrl?.includes("newhsk") : (d.audioUrl?.includes("oldhsk") || !d.audioUrl?.includes("newhsk"));
                  const matchesLevel = d.level?.toLowerCase().includes(lvl.toLowerCase());
                  return matchesCurriculum && matchesLevel;
                }).length;
                const hasData = countInLevel > 0;

                return (
                  <div 
                    key={lvl}
                    onClick={() => {
                      if (hasData) {
                        setSelectedHskLevel(lvl);
                        setStep("SELECT_LESSON");
                      }
                    }}
                    className={`rounded-[32px] transition-all duration-300 relative overflow-hidden group border-2 bg-cover bg-center bg-no-repeat ${
                      hasData 
                        ? "border-white hover:border-[#08A66A] hover:shadow-xl hover:-translate-y-1.5 cursor-pointer" 
                        : "border-transparent opacity-70 cursor-not-allowed select-none"
                    }`}
                    style={{ backgroundImage: `url('/hskk/anh${index + 1}.jpg')` }}
                  >
                    <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px] pointer-events-none z-0 group-hover:bg-white/75 transition-all"></div>
                    
                    <div className="relative z-10 p-6">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${hasData ? 'bg-[#DDF7EA] text-[#08A66A]' : 'bg-slate-100 text-slate-400'}`}>
                          {hasData ? '🎓' : '🔒'}
                        </div>
                        {!hasData && <span className="bg-slate-200 text-slate-500 text-[9px] font-black uppercase px-3 py-1 rounded-full">Đang update</span>}
                      </div>
                      <h3 className={`text-3xl font-black mb-1 ${hasData ? 'text-slate-800 group-hover:text-[#08A66A] transition-colors' : 'text-slate-400'}`}>{lvl}</h3>
                      <p className="text-slate-600 text-xs font-medium mb-6">Khởi động hành trình chinh phục tiếng Trung.</p>
                      
                      {hasData ? (
                        <div className="w-full py-3.5 bg-[#F4F8F5] group-hover:bg-[#08A66A] group-hover:text-white text-[#08A66A] font-black text-sm rounded-2xl transition duration-300 text-center flex items-center justify-center gap-2">
                          Bắt đầu chặng đường <span>→</span>
                        </div>
                      ) : (
                        <div className="w-full py-3.5 bg-slate-100 text-slate-400 font-bold text-sm rounded-2xl text-center">
                          Sắp ra mắt
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === STEP 3: CHỌN BÀI HỌC (LESSON) === */}
        {step === "SELECT_LESSON" && (
          <div className="max-w-5xl mx-auto px-6">
            <div className="flex items-center justify-between mb-10 relative z-10">
              <button 
                onClick={() => setStep("SELECT_HSK_LEVEL")}
                className="px-5 py-2.5 bg-white font-bold text-slate-600 rounded-2xl shadow-sm hover:text-[#08A66A] transition border border-white cursor-pointer flex items-center gap-2"
              >
                <span>←</span> Chọn lại cấp độ
              </button>
              <div className="bg-[#08A66A] text-white px-5 py-2 rounded-2xl text-xs font-black shadow-md flex items-center gap-2">
                <span>🎓</span> {selectedHskLevel}
              </div>
            </div>

            <div className="mb-10 relative z-10">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Lộ Trình Các Bài Khóa</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {totalStandardLessons.map((lessonName, index) => {
                const lessonCards = lessonsMap[lessonName] || [];
                const hasData = lessonCards.length > 0;
                
                const bgImage = bgImagePool[index % bgImagePool.length];

                return (
                  <div 
                    key={lessonName}
                    onClick={() => {
                      if (hasData) {
                        setSelectedLesson(lessonName);
                        setStep("SELECT_CARD"); 
                      }
                    }}
                    className={`rounded-[28px] shadow-sm border-2 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden bg-cover bg-center bg-no-repeat ${
                      hasData 
                        ? "border-white hover:border-[#08A66A] hover:shadow-xl hover:-translate-y-1 cursor-pointer" 
                        : "border-transparent opacity-70 cursor-not-allowed select-none"
                    }`}
                    style={{ backgroundImage: `url('${bgImage}')` }}
                  >
                    <div className="absolute inset-0 bg-white/85 backdrop-blur-[2px] pointer-events-none z-0 group-hover:bg-white/75 transition-all"></div>
                    
                    <div className="relative z-10 p-6">
                      <div className="flex justify-between items-start mb-4">
                        <span className={`text-4xl font-black ${hasData ? 'text-slate-300 group-hover:text-[#08A66A]/60 transition-colors' : 'text-slate-300'}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {hasData ? (
                           <span className="w-3 h-3 rounded-full bg-[#08A66A] animate-pulse shadow-sm"></span>
                        ) : (
                           <span className="text-xs">🔒</span>
                        )}
                      </div>
                      <div>
                        <h3 className={`text-2xl font-black mb-1 ${hasData ? 'text-slate-800 group-hover:text-[#08A66A]' : 'text-slate-500'}`}>{lessonName}</h3>
                        <p className="text-slate-600 text-xs font-medium mb-6">
                          {hasData ? `🎧 Có ${lessonCards.length} bài luyện nghe` : "Nội dung đang cập nhật..."}
                        </p>
                        
                        {hasData ? (
                          <div className="w-full py-3 bg-[#F4F8F5] group-hover:bg-[#08A66A] group-hover:text-white text-[#08A66A] font-black text-xs rounded-xl transition duration-300 text-center flex items-center justify-center gap-1 shadow-sm">
                            Vào bài học <span>→</span>
                          </div>
                        ) : (
                          <div className="w-full py-3 bg-slate-100 text-slate-400 font-bold text-xs rounded-xl text-center">
                            Chưa mở
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === STEP 4: CHỌN BÀI KHÓA (SELECT_CARD) - ĐÃ CẬP NHẬT NHÃN THÀNH BÀI KHÓA === */}
        {step === "SELECT_CARD" && (
          <div className="max-w-4xl mx-auto px-6">
            <div className="flex items-center justify-between mb-10 relative z-10">
              <button 
                onClick={() => setStep("SELECT_LESSON")}
                className="px-5 py-2.5 bg-white font-bold text-slate-600 rounded-2xl shadow-sm hover:text-[#08A66A] transition border border-white cursor-pointer flex items-center gap-2 group"
              >
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Bài học
              </button>
              <div className="bg-[#08A66A] text-white px-5 py-2 rounded-2xl text-xs font-black shadow-md flex items-center gap-2">
                <span>📚</span> {selectedLesson}
              </div>
            </div>

            <div className="mb-10 text-center relative z-10">
              <div className="text-5xl mb-4">🎧</div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nghe & Viết: {selectedLesson}</h2>
              <p className="text-slate-600 text-sm mt-2 font-medium">Chọn một đoạn âm thanh để bắt đầu luyện tập.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {cardsInLesson.map((card, idx) => {
                const bgImage = bgImagePool[(idx + 3) % bgImagePool.length];

                return (
                  <div 
                    key={card.id || idx}
                    onClick={() => {
                      setCurrentCard(card);
                      setUserInput("");
                      setIsCorrect(null);
                      setShowAnswer(false);
                      setStep("DO_DICTATION");
                    }}
                    className="rounded-[24px] shadow-sm border border-white hover:border-[#08A66A] hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden group relative bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url('${bgImage}')` }}
                  >
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-[2px] pointer-events-none z-0 group-hover:bg-white/80 transition-all"></div>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#08A66A] opacity-0 group-hover:opacity-100 transition-opacity z-10"></div>

                    <div className="relative z-10 p-5 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#08A66A] text-white flex items-center justify-center font-black text-base group-hover:scale-110 group-hover:shadow-md transition duration-300">
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-lg group-hover:text-[#08A66A] transition">
                            Bài khóa {idx + 1}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-bold mt-0.5 uppercase tracking-wider flex items-center gap-1 group-hover:text-[#08A66A]/70">
                            <span className="text-blue-500">▶</span> Bấm để học
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === STEP 5: MÀN HÌNH LÀM BÀI CHÍNH (DO DICTATION) === */}
        {step === "DO_DICTATION" && currentCard && (
          <div className="max-w-[1400px] mx-auto px-6 h-full flex flex-col">
            
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 shrink-0 relative z-10">
              <div className="flex items-center gap-4 md:gap-6">
                <button 
                  onClick={() => { setStep("SELECT_CARD"); setCurrentCard(null); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl font-bold text-sm text-slate-600 shadow-sm border border-white hover:text-[#08A66A] transition-all"
                >
                  <span>←</span> Quay lại
                </button>
                
                <div className="hidden sm:flex items-center gap-2 text-sm font-bold bg-white/60 px-4 py-2 rounded-xl backdrop-blur-md">
                  <span className="text-slate-600">{selectedHskLevel}</span>
                  <span className="text-slate-400">›</span>
                  <span className="text-slate-600">{selectedLesson}</span>
                  <span className="text-slate-400">›</span>
                  <span className="text-[#08A66A] font-black">Bài khóa {currentCardIndex + 1}</span>
                </div>
              </div>

              <button 
                onClick={() => setIsFocusMode(!isFocusMode)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm transition-all shadow-sm border ${
                  isFocusMode 
                    ? 'bg-[#08A66A] text-white border-[#087A55] shadow-emerald-500/20' 
                    : 'bg-white text-[#08A66A] border-white hover:bg-[#DDF7EA]'
                }`}
              >
                <span>🌿</span> Chế độ tập trung
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start transition-all duration-500 pb-10">
              
              {/* CỘT TRÁI: LÀM BÀI */}
              <div className={`${isFocusMode ? 'lg:col-span-8 lg:col-start-3' : 'lg:col-span-8'} transition-all duration-500 w-full`}>
                <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 md:p-10 shadow-lg shadow-emerald-900/5 border border-white relative overflow-hidden">
                  
                  <div className="flex justify-between items-start mb-8 relative z-10">
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-14 h-14 bg-[#DDF7EA] rounded-2xl flex items-center justify-center text-[#08A66A] text-3xl shadow-inner border border-emerald-100/50">
                          🎧
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Nghe & Viết</h2>
                      </div>
                      <p className="text-slate-500 text-sm font-medium ml-[72px]">
                        Nghe đoạn âm thanh và gõ lại bài khóa tiếng Trung. Cố gắng viết chính xác nhé!
                      </p>
                    </div>
                    
                    <div className="hidden sm:flex flex-col items-center rotate-3 opacity-90 shrink-0">
                      <span className="text-[#08A66A] font-black text-sm italic tracking-widest">加油！</span>
                      <div className="text-6xl drop-shadow-sm mt-1">🐸</div>
                    </div>
                  </div>

                  <div className="mb-10">
                    <div className="flex justify-between items-end mb-3">
                      <h3 className="font-black text-slate-800">Bài khóa {currentCardIndex + 1} / {cardsInLesson.length}</h3>
                      <span className="font-black text-slate-800">{Math.round(((currentCardIndex + 1) / cardsInLesson.length) * 100)}%</span>
                    </div>
                    <div className="w-full h-3 bg-[#F4F8F5] rounded-full overflow-hidden border border-emerald-50">
                      <div className="h-full bg-[#08A66A] rounded-full transition-all duration-500" style={{ width: `${((currentCardIndex + 1) / cardsInLesson.length) * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-[#F4F8F5] rounded-[24px] p-4 flex items-center gap-4 md:gap-6 border border-emerald-100/50 shadow-inner mb-6">
                    <audio 
                      ref={audioRef}
                      src={currentCard.audioUrl}
                      className="hidden"
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                    
                    <button 
                      onClick={togglePlay}
                      className="w-14 h-14 md:w-16 md:h-16 shrink-0 bg-[#08A66A] hover:bg-[#087A55] text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-600/30 hover:scale-105 transition-all"
                    >
                      {isPlaying ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                      ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="ml-1"><path d="M8 5v14l11-7z"/></svg>
                      )}
                    </button>

                    <div className="flex-1 flex items-center gap-[3px] h-12 overflow-hidden opacity-60">
                      {waveformHeights.map((h, i) => (
                        <div 
                          key={i} 
                          className={`w-1.5 rounded-full transition-all duration-75 ${isPlaying ? 'bg-[#08A66A] animate-pulse' : 'bg-emerald-200'}`} 
                          style={{ height: `${isPlaying ? h : Math.max(4, h / 2)}px`, animationDelay: `${i * 0.05}s` }}
                        ></div>
                      ))}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0 px-2">
                      <span className="text-xs font-bold text-[#08A66A] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Đang phát
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#FFF8E8] border border-[#FFC83D]/30 rounded-xl py-3 px-6 text-center mb-8">
                    <p className="text-xs font-bold text-amber-700">
                      <span className="text-base mr-2">💡</span>
                      <strong className="text-amber-800">Mẹo:</strong> Nghe kỹ và tua lại khi cần. Chú ý các từ dễ nhầm nhé!
                    </p>
                  </div>

                  <div className="relative mb-6">
                    <textarea 
                      ref={inputRef}
                      rows="3"
                      placeholder="Nghe và gõ lại tiếng Trung..."
                      value={userInput}
                      onChange={(e) => { setUserInput(e.target.value); setIsCorrect(null); setShowAnswer(false); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey && userInput.trim() && !isCorrect) checkAnswer(); }}
                      className={`w-full bg-white border-2 text-slate-800 font-bold text-xl md:text-2xl rounded-[24px] p-6 outline-none transition-all resize-none shadow-sm placeholder:text-slate-300 placeholder:font-medium ${
                        isCorrect === true ? 'border-emerald-500 bg-emerald-50/30 text-emerald-700' :
                        isCorrect === false ? 'border-rose-400 bg-rose-50/30 text-rose-700' :
                        'border-emerald-100 focus:border-[#08A66A] focus:ring-4 focus:ring-[#08A66A]/10'
                      }`}
                      disabled={isCorrect}
                    ></textarea>
                    <div className="absolute bottom-4 right-4 text-slate-300 text-xl pointer-events-none">⌨️</div>
                  </div>

                  <div className="flex justify-between items-center mb-8 px-2">
                    <div className="flex items-center gap-2 text-[10px] md:text-[11px] text-slate-400 font-medium">
                      Nhấn <kbd className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-slate-600 font-bold">Ctrl</kbd> + <kbd className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-slate-600 font-bold">Enter</kbd> để kiểm tra
                    </div>
                    <span className="text-xs font-bold text-slate-400">{userInput.length} / 100</span>
                  </div>

                  {isCorrect === false && (
                    <div className="w-full p-4 mb-6 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-4 animate-fade-in">
                      <div className="text-3xl mt-1">🐸</div>
                      <div className="flex-1">
                        <h4 className="font-black text-rose-700 text-sm mb-1">Gần đúng rồi! Hãy thử lại nhé.</h4>
                        <p className="text-xs text-rose-600 font-medium mb-3">Bạn đã viết: <span className="font-bold">{userInput}</span></p>
                        
                        {showAnswer && (
                          <div className="bg-white p-4 rounded-xl border border-rose-100 mb-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Đáp án đúng</span>
                            <span className="text-lg font-black text-[#08A66A]">{currentCard.fullText}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {isCorrect === true && (
                    <div className="w-full p-5 mb-6 bg-[#DDF7EA] border border-[#08A66A]/30 rounded-2xl flex items-center gap-4 animate-fade-in shadow-sm">
                      <div className="text-4xl drop-shadow-sm">🎉</div>
                      <div>
                        <h4 className="font-black text-[#087A55] text-lg mb-1">太棒了！Tuyệt vời!</h4>
                        <p className="text-sm font-bold text-[#08A66A] mb-1">Đáp án: {currentCard.fullText}</p>
                        <p className="text-xs font-black text-emerald-600/70 uppercase tracking-wider mt-2">🎯 Chính xác 100% • +10 XP</p>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4">
                    {!isCorrect && (
                      <button 
                        onClick={() => setShowAnswer(!showAnswer)}
                        className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-sm hover:border-[#08A66A] hover:text-[#08A66A] hover:bg-[#F4F8F5] transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <span className="text-lg">{showAnswer ? "🙈" : "👁"}</span> {showAnswer ? "Ẩn đáp án" : "Xem đáp án"}
                      </button>
                    )}

                    {!isCorrect ? (
                      <button 
                        onClick={checkAnswer}
                        disabled={!userInput.trim()}
                        className="flex-1 py-4 bg-[#08A66A] text-white rounded-2xl font-black text-sm hover:bg-[#087A55] transition-all shadow-lg shadow-emerald-600/20 hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                      >
                        Kiểm tra đáp án <span>→</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => { 
                          const nextIdx = currentCardIndex + 1;
                          if (nextIdx < cardsInLesson.length) {
                            setCurrentCard(cardsInLesson[nextIdx]);
                            setUserInput("");
                            setIsCorrect(null);
                            setShowAnswer(false);
                          } else {
                            setStep("SELECT_CARD"); 
                            setCurrentCard(null);
                          }
                        }}
                        className="w-full py-4 bg-[#172033] text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all shadow-xl hover:-translate-y-0.5 flex items-center justify-center gap-2"
                      >
                        {currentCardIndex + 1 < cardsInLesson.length ? "Bài khóa tiếp theo ➔" : "Hoàn thành bài học 🎉"}
                      </button>
                    )}
                  </div>

                  {!isCorrect && (
                    <div className="mt-8 bg-[#F4F8F5] border border-emerald-100 p-4 rounded-2xl flex items-center gap-4">
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-2xl shadow-sm">🌿</div>
                      <div>
                        <h4 className="font-black text-[#087A55] text-sm mb-0.5">Cố lên!</h4>
                        <p className="text-xs font-medium text-emerald-700">Mỗi bài khóa hoàn thành là một bước tiến gần hơn tới mục tiêu HSK của bạn!</p>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* CỘT PHẢI: BÀI HỌC */}
              {!isFocusMode && (
                <div className="lg:col-span-4 transition-all duration-500 animate-fade-in w-full">
                  <div className="bg-white/95 backdrop-blur-xl rounded-[32px] p-6 shadow-sm border border-white sticky top-[104px]">
                    
                    <div className="flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                      <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                        <span className="text-2xl">📖</span> Bài học
                      </h3>
                      <span className="bg-[#DDF7EA] text-[#08A66A] font-black text-[10px] uppercase tracking-wider px-3 py-1 rounded-lg">{selectedHskLevel}</span>
                    </div>

                    <p className="font-bold text-sm text-slate-700 mb-5">{selectedLesson}</p>

                    <div className="space-y-2 mb-8 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {cardsInLesson.map((card, idx) => {
                        const isActive = currentCard?.id === card.id;
                        return (
                          <div 
                            key={card.id}
                            onClick={() => {
                              setCurrentCard(card);
                              setUserInput("");
                              setIsCorrect(null);
                              setShowAnswer(false);
                            }}
                            className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-colors group border-2 ${
                              isActive 
                                ? 'bg-[#F4F8F5] border-[#08A66A]' 
                                : 'bg-white border-slate-100 hover:border-[#08A66A]/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-xs ${isActive ? 'bg-[#08A66A] text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-[#08A66A]/10 group-hover:text-[#08A66A]'}`}>
                                {idx + 1}
                              </div>
                              <span className={`font-bold text-sm flex items-center gap-1.5 ${isActive ? 'text-[#087A55]' : 'text-slate-500 group-hover:text-slate-700'}`}>
                                {isActive && <span className="text-[10px]">▶</span>} Bài khóa {idx + 1}
                              </span>
                            </div>
                            {isActive ? (
                               <div className="w-4 h-4 rounded-full border-[3px] border-[#08A66A]"></div>
                            ) : (
                               <div className="text-slate-300 text-xs">📝</div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="bg-[#F4F8F5] p-5 rounded-2xl border border-emerald-100/50 text-center relative mt-auto">
                      <span className="absolute top-2 left-3 text-4xl text-[#08A66A]/20 font-serif leading-none">“</span>
                      <p className="text-[#087A55] font-black text-lg mb-1 relative z-10 pt-2 tracking-widest">积少成多，</p>
                      <p className="text-[#08A66A] font-bold text-sm mb-3 relative z-10 tracking-widest">坚持就是胜利。</p>
                      <p className="text-xs text-[#087A55]/70 font-medium italic relative z-10">— 加油！ —</p>
                    </div>

                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}