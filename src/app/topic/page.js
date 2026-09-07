"use client";
import Link from "next/link";
import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { db } from "../../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

// Import data từ topics.json
import myCustomData from "../topics.json"; 

const generateLevelsFromData = (data, wordsPerLevel = 10) => {
  const levels = [];
  const dataArray = Array.isArray(data) ? data : [];
  for (let i = 0; i < dataArray.length; i += wordsPerLevel) {
    const levelNumber = Math.floor(i / wordsPerLevel) + 1;
    levels.push({
      level: levelNumber,
      words: dataArray.slice(i, i + wordsPerLevel)
    });
  }
  return levels.length > 0 ? levels : [{ level: 1, words: [] }];
};

// --- HÀM TỰ ĐỘNG GÁN ICON CHO CHỦ ĐỀ ---
const getIconForTopic = (topicName) => {
  const lower = String(topicName).toLowerCase();
  if (lower.includes('kiến trúc') || lower.includes('xây dựng')) return '🏢';
  if (lower.includes('âm nhạc') || lower.includes('music')) return '🎶';
  if (lower.includes('sở thích') || lower.includes('đam mê')) return '🎨';
  if (lower.includes('nghiên cứu') || lower.includes('khoa học')) return '🔬';
  if (lower.includes('không gian') || lower.includes('vũ trụ')) return '🛸';
  if (lower.includes('thể thao') || lower.includes('vận động')) return '⚽';
  if (lower.includes('thảo luận') || lower.includes('giao tiếp') || lower.includes('trao đổi')) return '🧑‍🤝‍🧑';
  if (lower.includes('vận chuyển') || lower.includes('giao thông')) return '✈️';
  if (lower.includes('toán') || lower.includes('math')) return '📐';
  if (lower.includes('ngôn ngữ') || lower.includes('từ vựng')) return '🔤';
  if (lower.includes('gia đình') || lower.includes('người thân')) return '👨‍👩‍👧';
  if (lower.includes('mua sắm') || lower.includes('siêu thị')) return '🛒';
  if (lower.includes('công việc') || lower.includes('nghề')) return '💼';
  if (lower.includes('kinh tế') || lower.includes('tiền')) return '💰';
  if (lower.includes('y tế') || lower.includes('bệnh')) return '🏥';
  if (lower.includes('thực vật') || lower.includes('cây')) return '🌳';
  if (lower.includes('động vật') || lower.includes('con vật')) return '🐶';
  if (lower.includes('thời tiết') || lower.includes('khí hậu')) return '🌤️';
  if (lower.includes('máy tính') || lower.includes('công nghệ')) return '💻';
  return '🏷️';
};

export default function TopicFlashcardPage() {
  const { isSignedIn, userId } = useAuth();
  const { user, isLoaded } = useUser();

  // --- GLOBAL STATES ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hskXp, setHskXp] = useState(0);
  const [hearts, setHearts] = useState(5);
  const [streak, setStreak] = useState(0);
  const [isTeacher, setIsTeacher] = useState(false);

  // --- TOPIC STATES ---
  const availableCategories = [...new Set(myCustomData.map(item => item.topic || item.category || item.level))].filter(Boolean).sort();
  const [selectedCategory, setSelectedCategory] = useState(availableCategories[0] || "");
  
  const [levelsData, setLevelsData] = useState([]);
  const [userExp, setUserExp] = useState(0);
  const [viewingLevel, setViewingLevel] = useState(1);
  const [wordProgress, setWordProgress] = useState({}); 
  const [filter, setFilter] = useState("all"); 
  
  const [activeWordIndex, setActiveWordIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [shadowingResult, setShadowingResult] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Fetch dữ liệu chung của hệ thống (XP, Streak, Hearts)
  useEffect(() => {
    async function fetchGlobalData() {
      if (userId) {
        try {
          const userRef = doc(db, "users", userId);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.role === "teacher" || data.role === "admin" || user?.publicMetadata?.role === "teacher" || user?.publicMetadata?.role === "admin") {
              setIsTeacher(true);
            }
          }
          const newStudentRef = doc(db, "user_progress", userId);
          const newDocSnap = await getDoc(newStudentRef);
          if (newDocSnap.exists()) {
            const newData = newDocSnap.data();
            setHskXp(newData.profile?.hsk_xp || 0);
            setHearts(newData.profile?.hearts ?? 5);
            setStreak(newData.profile?.streak_days || 0);
          }
        } catch (error) { console.error("Lỗi:", error); }
      }
    }
    if (isLoaded) fetchGlobalData();
  }, [userId, isLoaded, user]);

  // Lọc data theo chủ đề
  useEffect(() => {
    const dataForCategory = selectedCategory 
      ? myCustomData.filter(item => (item.topic || item.category || item.level) === selectedCategory) 
      : myCustomData;
      
    const uniqueData = dataForCategory.filter((item, index, self) => {
      const currentWord = item.front || item.text || item.word;
      return index === self.findIndex((t) => (t.front || t.text || t.word) === currentWord);
    });
      
    const generatedLevels = generateLevelsFromData(uniqueData, 10); 
    setLevelsData(generatedLevels);
    setViewingLevel(1); 
    setActiveWordIndex(0);
    setIsFlipped(false);
  }, [selectedCategory]);

  useEffect(() => {
    const savedExp = localStorage.getItem("topic_exp");
    const savedProgress = localStorage.getItem("topic_word_progress");
    if (savedExp) setUserExp(parseInt(savedExp));
    if (savedProgress) setWordProgress(JSON.parse(savedProgress));
  }, []);

  useEffect(() => {
    localStorage.setItem("topic_exp", userExp);
  }, [userExp]);

  useEffect(() => {
    if (Object.keys(wordProgress).length > 0) {
      localStorage.setItem("topic_word_progress", JSON.stringify(wordProgress));
    }
  }, [wordProgress]);

  // TÍNH TOÁN THỐNG KÊ CÁC CHỦ ĐỀ CHO GIAO DIỆN BENTO GRID MỚI
  const categoryStats = useMemo(() => {
    return availableCategories.map(cat => {
      const words = myCustomData.filter(item => (item.topic || item.category || item.level) === cat);
      const uniqueWords = words.filter((item, index, self) => {
        const currentWord = item.front || item.text || item.word;
        return index === self.findIndex((t) => (t.front || t.text || t.word) === currentWord);
      });
      return {
        name: cat,
        count: uniqueWords.length,
        icon: getIconForTopic(cat)
      };
    });
  }, [availableCategories]);

  const selectedStat = categoryStats.find(s => s.name === selectedCategory) || categoryStats[0];
  const otherStats = categoryStats.filter(s => s.name !== selectedCategory);

  if (levelsData.length === 0) return (
    <div className="min-h-screen bg-[#F4F7F6] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-[#2F8F6E] border-t-transparent rounded-full animate-spin"></div>
      <p className="font-bold text-[#1B5E4B]">Đang tải khu vườn...</p>
    </div>
  );

  const activeLevelData = levelsData.find(l => l.level === viewingLevel) || levelsData[0];
  
  const filteredWords = activeLevelData.words.filter(word => {
    const wordId = word.front || word.text || word.word;
    const status = wordProgress[wordId] || "learning";
    if (filter === "all") return true;
    return filter === status;
  });

  const activeWord = filteredWords[activeWordIndex];
  
  const masteredCount = activeLevelData.words.filter(w => {
    const wordId = w.front || w.text || w.word;
    return wordProgress[wordId] === "mastered";
  }).length;
  
  const progressPercent = activeLevelData.words.length > 0 
    ? Math.round((masteredCount / activeLevelData.words.length) * 100) 
    : 0;

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  };

  const markWord = async (status) => {
    if (!activeWord) return;
    const wordId = activeWord.front || activeWord.text || activeWord.word;
    const isAlreadyMastered = wordProgress[wordId] === "mastered";
    
    setWordProgress(prev => ({ ...prev, [wordId]: status }));
    
    if (status === "mastered" && !isAlreadyMastered) {
      const newExp = userExp + 20;
      setUserExp(newExp); 

      if (user) {
        try {
          const studentRef = doc(db, "progress", user.id);
          await setDoc(studentRef, { topicExp: newExp }, { merge: true });
        } catch (error) {
          console.error("Lỗi đồng bộ điểm Chủ đề:", error);
        }
      }
    }

    setShadowingResult(null); 
    setIsFlipped(false);

    if (activeWordIndex < filteredWords.length - 1) {
      setActiveWordIndex(prev => prev + 1);
    } else {
      setActiveWordIndex(0);
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
    setActiveWordIndex(0);
    setIsFlipped(false);
    setShadowingResult(null);
  };

  const handleLevelChange = (levelObj) => {
    setViewingLevel(levelObj.level);
    setActiveWordIndex(0);
    setIsFlipped(false);
    setFilter("all");
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm', audioBitsPerSecond: 16000 };
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setShadowingResult(null);
    } catch (err) {
      alert("Vui lòng cấp quyền Micro!");
    }
  };

  const stopRecordingAndGrade = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          setIsRecording(false);
          setShadowingResult("loading");
          
          try {
            const targetText = activeWord.front || activeWord.text || activeWord.word;
            const res = await fetch('/api/shadowing', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ targetText, audioBase64: reader.result })
            });
            const data = await res.json();
            setShadowingResult(data);
          } catch (e) {
            alert("Lỗi chấm điểm AI!");
            setShadowingResult(null);
          }
        };
      };
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const wordDisplay = activeWord ? (activeWord.front || activeWord.text || activeWord.word) : "";
  const pinyinDisplay = activeWord ? (activeWord.ipa || activeWord.pinyin) : "";
  const meaningDisplay = activeWord ? (activeWord.back || activeWord.meaning) : "";
  const exampleDisplay = activeWord ? activeWord.example : "";

  return (
    <div className="flex min-h-screen font-sans text-[#1B5E4B] bg-[#F4F7F6] selection:bg-[#8FD9A8]/50">
      
      {/* ==========================================
          SIDEBAR - HSK GARDEN STYLE
          ========================================== */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[#E2E8F0] bg-white transition-all duration-300 md:flex ${isSidebarCollapsed ? "w-[76px]" : "w-[240px]"}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center px-4 py-6 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#2F8F6E] text-xl text-white shadow-sm">🐸</div>
            {!isSidebarCollapsed && (
              <div className="min-w-0">
                <h2 className="truncate text-[15px] font-black text-[#1B5E4B] tracking-tight">Khu Vườn HSK</h2>
                <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-[#2F8F6E]">Hành trình của bạn</p>
              </div>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <Link href="/" className="mb-2 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors">
              <span className="w-6 text-center text-lg opacity-80">🏠</span>{!isSidebarCollapsed && <span>Trang chủ</span>}
            </Link>
            
            <Link href="/test" className="mb-6 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors">
              <span className="w-6 text-center text-lg opacity-80">🎯</span>{!isSidebarCollapsed && <span>Kiểm tra năng lực</span>}
            </Link>

            <div className="mb-3 px-3 text-[10px] font-black uppercase tracking-widest text-[#2F8F6E]/60">
              {!isSidebarCollapsed ? "Góc Học Tập" : "•"}
            </div>

            <Link href="/vocab" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors">
              <span className="w-6 text-center text-lg opacity-80">📚</span>{!isSidebarCollapsed && <span>Từ vựng</span>}
            </Link>
            <Link href="/topic" className="mb-1 flex items-center gap-3 rounded-xl bg-[#8FD9A8]/30 px-3 py-2.5 text-sm font-bold text-[#1B5E4B]">
              <span className="w-6 text-center text-lg">💡</span>{!isSidebarCollapsed && <span>Theo chủ đề</span>}
            </Link>
            <Link href="/arrange" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors">
              <span className="w-6 text-center text-lg opacity-80">🧩</span>{!isSidebarCollapsed && <span>Ngữ pháp</span>}
            </Link>
            <Link href="/dictation" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors">
              <span className="w-6 text-center text-lg opacity-80">🎧</span>{!isSidebarCollapsed && <span>Nghe chép</span>}
            </Link>
            <Link href="/translate" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors">
              <span className="w-6 text-center text-lg opacity-80">✍️</span>{!isSidebarCollapsed && <span>Dịch câu</span>}
            </Link>
            <Link href="/roleplay" className="mb-6 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-[#8FD9A8]/20 hover:text-[#1B5E4B] transition-colors">
              <span className="w-6 text-center text-lg opacity-80">💬</span>{!isSidebarCollapsed && <span>Thực chiến AI</span>}
            </Link>

            {isTeacher && (
              <div className="mt-6 mb-2 border-t border-[#E2E8F0] pt-4">
                <p className="px-3 mb-3 text-[10px] font-black uppercase tracking-widest text-[#FFD666]">{!isSidebarCollapsed ? "Hệ thống" : "•"}</p>
                <Link href="/teacher" className="mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-[#1B5E4B] bg-[#FFD666]/20 hover:bg-[#FFD666]/40 transition-all shadow-sm">
                  <span className="w-6 text-center text-lg">🛡️</span>{!isSidebarCollapsed && <span>Trang Quản Lý</span>}
                </Link>
              </div>
            )}
          </nav>

          <div className="border-t border-[#E2E8F0] p-4">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="mb-3 flex w-full items-center justify-center rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors shadow-sm">
              {isSidebarCollapsed ? "→" : "← Thu gọn"}
            </button>
            {isSignedIn ? (
              <div className={`flex items-center rounded-2xl bg-white border border-[#E2E8F0] shadow-sm p-2.5 ${isSidebarCollapsed ? "justify-center" : "gap-3"}`}>
                <UserButton afterSignOutUrl="/" />
                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black text-[#1B5E4B]">{user?.fullName || "Học viên"}</p>
                    <p className="text-[9px] text-[#2F8F6E] font-medium mt-0.5">Tài khoản</p>
                  </div>
                )}
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1B5E4B] py-3 text-xs font-bold text-white hover:bg-[#2F8F6E] shadow-md transition-all">
                  👤 {!isSidebarCollapsed && "Đăng nhập"}
                </button>
              </SignInButton>
            )}
          </div>
        </div>
      </aside>

      {/* ======================================================
          MAIN CONTENT
          ====================================================== */}
      <main className={`min-h-screen transition-all duration-300 relative w-full flex flex-col ${isSidebarCollapsed ? "md:pl-[76px]" : "md:pl-[240px]"}`}>
        
        {/* TOPBAR */}
        <header className="sticky top-0 z-30 h-[76px] border-b border-[#E2E8F0] bg-white/80 px-5 md:px-8 flex items-center justify-between backdrop-blur-xl">
          <button onClick={() => setIsSearchOpen(true)} className="flex h-11 max-w-md flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm px-4 text-left text-sm font-medium text-slate-500 hover:bg-white transition-all sm:flex group">
            <span className="text-lg opacity-60">🔍</span>
            <span>Tìm kiếm trong vườn...</span>
            <span className="ml-auto rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-400 group-hover:text-[#2F8F6E]">Ctrl K</span>
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-2xl bg-white shadow-sm border border-[#E2E8F0] px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">☀️</span><span className="text-xs font-black text-[#FFD666] drop-shadow-[0_1px_1px_rgba(0,0,0,0.2)]">{streak}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-white shadow-sm border border-[#E2E8F0] px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">❤️</span><span className="text-xs font-black text-[#F2765B] drop-shadow-[0_1px_1px_rgba(0,0,0,0.1)]">{hearts}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl bg-[#FFD666]/20 border border-[#FFD666]/50 shadow-sm px-4 py-2.5">
              <span className="text-lg drop-shadow-sm">⭐</span><span className="text-xs font-black text-[#1B5E4B]">{hskXp.toLocaleString()} XP</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 md:p-8 max-w-[1400px] mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* ==========================================================
                CỘT TRÁI: BẢNG ĐIỀU KHIỂN & CHỌN BÀI (4 cols)
                ========================================================== */}
            <aside className="lg:col-span-4 w-full flex flex-col gap-6 shrink-0">
              
              {/* KHỐI BENTO GRID - CHỌN CHỦ ĐỀ */}
              <div className="bg-white p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-100">
                {categoryStats.length > 0 && (
                  <div className="mb-6">
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="font-black text-[#1B5E4B] text-base flex items-center gap-2">
                        <span className="text-xl">🏷️</span> Chủ đề từ vựng
                      </h3>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3">
                      
                      {/* Thẻ Active (Nổi bật nhất) */}
                      <div className="w-full bg-[#1B5E4B] rounded-[24px] p-5 flex items-center gap-4 shadow-md relative overflow-hidden">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
                        <div className="w-14 h-14 bg-white/10 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-3xl shrink-0 backdrop-blur-md border border-white/10 shadow-inner">
                          {selectedStat?.icon}
                        </div>
                        <div className="relative z-10">
                          <h4 className="font-black text-white text-base leading-tight mb-1 line-clamp-1">{selectedStat?.name}</h4>
                          <p className="text-[11px] font-medium text-[#8FD9A8]">Tổng cộng: <span className="font-bold text-[#FFD666]">{selectedStat?.count} từ</span></p>
                        </div>
                      </div>

                      {/* Grid Thẻ Inactive (2 Cột) */}
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        {otherStats.map((stat, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedCategory(stat.name)}
                            className="bg-[#F4F7F6] hover:bg-white border border-transparent hover:border-[#8FD9A8] rounded-[20px] p-4 flex flex-col items-start gap-3 transition-all text-left group shadow-sm hover:shadow-md"
                          >
                            <span className="text-2xl drop-shadow-sm shrink-0 group-hover:scale-110 transition-transform">{stat.icon}</span>
                            <div>
                              <span className="text-xs font-bold text-[#1B5E4B] leading-tight line-clamp-2 group-hover:text-[#2F8F6E] transition-colors">{stat.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>

                    </div>
                  </div>
                )}

                {/* THẺ TỔNG EXP */}
                <div className="bg-gradient-to-r from-[#2F8F6E] to-[#8FD9A8] p-5 rounded-[24px] shadow-sm flex justify-between items-center text-white relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-[#1B5E4B] uppercase tracking-widest mb-1 drop-shadow-sm">Thành tựu chủ đề</p>
                        <p className="text-3xl font-black drop-shadow-sm text-white">{userExp} <span className="text-sm text-[#1B5E4B]">XP</span></p>
                    </div>
                    <div className="text-5xl drop-shadow-lg relative z-10">🏅</div>
                </div>
              </div>

              {/* KHỐI DANH SÁCH BÀI HỌC (LÁ SEN) */}
              <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden flex flex-col max-h-[400px]">
                <div className="p-6 border-b border-slate-100 bg-[#F4F7F6] flex items-center gap-2">
                  <span className="text-xl">📖</span>
                  <h3 className="font-black text-[#1B5E4B] text-base">Danh sách Bài học</h3>
                </div>
                <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                    {levelsData.map(lvl => {
                        const isActive = lvl.level === viewingLevel;
                        return (
                            <button 
                                key={lvl.level}
                                onClick={() => handleLevelChange(lvl)}
                                className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
                                    isActive ? 'border-[#2F8F6E] bg-[#8FD9A8]/10 shadow-sm' : 'border-transparent bg-[#F4F7F6] hover:border-[#8FD9A8] hover:bg-white'
                                }`}
                            >
                                <div className="text-left">
                                    <p className={`font-black text-sm ${isActive ? 'text-[#1B5E4B]' : 'text-slate-700'}`}>
                                        Bài số {lvl.level}
                                    </p>
                                    <p className={`text-[11px] font-bold mt-0.5 ${isActive ? 'text-[#2F8F6E]' : 'text-slate-400'}`}>
                                        {lvl.words.length} từ vựng
                                    </p>
                                </div>
                                <div className={`w-10 h-10 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] flex items-center justify-center text-lg transition-transform shadow-sm border ${isActive ? 'bg-white border-[#8FD9A8] scale-110 drop-shadow-sm text-[#2F8F6E]' : 'bg-white border-slate-200 grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100'}`}>
                                    {isActive ? '🔥' : '📘'}
                                </div>
                            </button>
                        );
                    })}
                </div>
              </div>

            </aside>

            {/* ==========================================================
                CỘT PHẢI: KHU VỰC FLASHCARD CHÍNH (8 cols)
                ========================================================== */}
            <div className="lg:col-span-8 w-full flex flex-col gap-6">
              
              {/* THANH TIẾN ĐỘ BÀI HỌC */}
              <div className="bg-white p-8 rounded-[32px] shadow-sm border border-slate-100">
                  <div className="flex justify-between items-center mb-5">
                      <h2 className="text-xl font-black text-[#1B5E4B] flex items-center gap-2">
                        <span className="text-2xl">🎯</span> Tiến độ Bài {viewingLevel}
                      </h2>
                      <span className="font-black text-[#2F8F6E] text-xl bg-[#8FD9A8]/20 px-4 py-1.5 rounded-xl border border-[#8FD9A8]/50 shadow-sm">{progressPercent}%</span>
                  </div>
                  <div className="h-3.5 bg-[#8FD9A8]/20 rounded-full overflow-hidden mb-6 shadow-inner">
                      <div className="h-full bg-[#2F8F6E] transition-all duration-700 shadow-[0_0_10px_rgba(47,143,110,0.5)]" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 p-1.5 bg-[#F4F7F6] rounded-2xl border border-slate-100 w-fit">
                      <button onClick={() => handleFilterChange("all")} className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${filter === 'all' ? 'bg-white shadow-sm border border-slate-200 text-[#1B5E4B]' : 'text-slate-500 hover:text-[#1B5E4B]'}`}>Tất cả</button>
                      <button onClick={() => handleFilterChange("learning")} className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${filter === 'learning' ? 'bg-white shadow-sm border border-slate-200 text-[#F2765B]' : 'text-slate-500 hover:text-[#1B5E4B]'}`}>Chưa thuộc</button>
                      <button onClick={() => handleFilterChange("mastered")} className={`px-6 py-2.5 rounded-xl font-bold text-xs transition-all ${filter === 'mastered' ? 'bg-white shadow-sm border border-slate-200 text-[#2F8F6E]' : 'text-slate-500 hover:text-[#1B5E4B]'}`}>Đã thuộc</button>
                  </div>
              </div>

              {filteredWords.length > 0 && activeWord ? (
                <div className="flex flex-col gap-6 animate-fade-in">
                  
                  {/* === KHUNG FLASHCARD 3D BENTO === */}
                  <div 
                    onClick={() => setIsFlipped(!isFlipped)}
                    className="w-full bg-white p-8 md:p-14 rounded-[40px] shadow-sm hover:shadow-xl border border-slate-100 border-b-[8px] border-b-[#2F8F6E] text-center cursor-pointer transition-all hover:-translate-y-1 relative min-h-[460px] flex flex-col justify-center items-center group overflow-hidden"
                  >
                    <div className="absolute right-8 top-8 flex gap-2 z-20">
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm ${wordProgress[wordDisplay] === 'mastered' ? 'bg-[#8FD9A8]/30 text-[#1B5E4B] border border-[#8FD9A8]' : 'bg-slate-50 text-slate-400 border border-slate-200'}`}>
                        {wordProgress[wordDisplay] === 'mastered' ? '✓ Đã thuộc' : 'Đang học'}
                        </span>
                    </div>

                    <button 
                        onClick={(e) => { e.stopPropagation(); speak(wordDisplay); }} 
                        className="w-16 h-16 bg-[#F4F7F6] text-[#2F8F6E] border border-[#E2E8F0] rounded-[40%_60%_70%_30%/40%_50%_60%_50%] text-2xl shadow-sm hover:scale-110 hover:bg-[#2F8F6E] hover:text-white transition-all mb-8 z-20 flex items-center justify-center"
                    >
                        🔊
                    </button>
                    
                    <h3 className="text-7xl md:text-8xl font-black text-[#1B5E4B] tracking-tight mb-8 drop-shadow-sm z-10">{wordDisplay}</h3>
                    
                    {isFlipped ? (
                        <div className="animate-fade-in w-full px-4 flex flex-col items-center z-10">
                          <p className="text-2xl font-bold text-slate-400 mb-3 tracking-widest uppercase">{pinyinDisplay}</p>
                          <p className="text-3xl font-black text-[#2F8F6E] mb-6">{meaningDisplay}</p>
                          {exampleDisplay && (
                              <div className="bg-white border border-[#8FD9A8] px-6 py-4 rounded-2xl shadow-sm max-w-lg mt-2 relative">
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-3 py-0.5 border border-[#8FD9A8] rounded-full font-black text-[#2F8F6E] text-[9px] uppercase tracking-widest shadow-sm">Mẫu câu</span>
                                <p className="text-base font-medium text-[#1B5E4B] leading-relaxed mt-2">{exampleDisplay}</p>
                              </div>
                          )}
                        </div>
                    ) : (
                        <div className="mt-8 z-10">
                          <p className="text-xs font-bold text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity flex items-center gap-2 bg-[#F4F7F6] px-5 py-2.5 rounded-full border border-slate-100 shadow-inner">
                            👆 Chạm vào thẻ để lật xem nghĩa
                          </p>
                        </div>
                    )}
                  </div>

                  {/* === KHUNG TƯƠNG TÁC (SHADOWING & NÚT ACTION) === */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                    
                    {/* Shadowing Box */}
                    <div className="w-full bg-white p-8 rounded-[32px] shadow-sm border border-slate-100 flex flex-col justify-center">
                      <div className="flex items-center gap-3 mb-6 justify-center">
                        <span className="text-2xl">🎙️</span>
                        <p className="font-black text-[#1B5E4B] text-base">Luyện Phát Âm</p>
                      </div>
                      
                      {!isRecording ? (
                      <button onClick={startRecording} className="w-full py-4 bg-[#1B5E4B] text-white rounded-[20px] font-black text-sm hover:bg-[#2F8F6E] flex justify-center items-center gap-2 transition-all shadow-md hover:-translate-y-1">
                          Nhấn để Ghi âm
                      </button>
                      ) : (
                      <button onClick={stopRecordingAndGrade} className="w-full py-4 bg-[#F2765B] text-white rounded-[20px] font-black text-sm animate-pulse flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(242,118,91,0.5)] transition-all">
                          ⏹️ Đang thu... Bấm nộp
                      </button>
                      )}

                      {shadowingResult === "loading" && <p className="text-[#2F8F6E] font-bold text-xs mt-4 animate-bounce text-center uppercase tracking-widest">AI đang phân tích...</p>}
                      
                      {shadowingResult && shadowingResult !== "loading" && (
                      <div className="mt-5 p-5 bg-[#8FD9A8]/10 rounded-2xl border border-[#8FD9A8]/50 text-left animate-fade-in shadow-inner">
                          <div className="flex justify-between items-center mb-3 border-b border-[#8FD9A8]/50 pb-3">
                            <span className="font-black text-[#1B5E4B] text-xs uppercase tracking-widest flex items-center gap-1.5"><span className="text-lg">🤖</span> Điểm AI</span>
                            <span className={`text-3xl font-black ${shadowingResult.score >= 80 ? 'text-[#2F8F6E]' : 'text-[#F2765B]'}`}>{shadowingResult.score}</span>
                          </div>
                          <p className="text-sm text-[#1B5E4B] font-medium leading-relaxed"><span className="font-bold text-slate-400 text-[10px] uppercase tracking-widest block mb-1">Nhận xét chi tiết</span> {shadowingResult.feedback}</p>
                      </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-4 w-full justify-center">
                        <button 
                          onClick={() => markWord("learning")}
                          className="w-full py-5 bg-white border-2 border-slate-100 text-[#1B5E4B] rounded-[32px] font-black text-sm uppercase tracking-widest hover:border-[#F2765B] hover:bg-[#F2765B]/10 hover:text-[#F2765B] transition-all shadow-sm hover:-translate-y-1 flex justify-center items-center gap-2"
                        >
                          <span className="text-lg">❌</span> Chưa thuộc
                        </button>
                        <button 
                          onClick={() => markWord("mastered")}
                          className="w-full py-5 bg-[#2F8F6E] text-white rounded-[32px] font-black text-sm uppercase tracking-widest hover:bg-[#1B5E4B] shadow-lg shadow-[#8FD9A8] transition-all hover:-translate-y-1 flex justify-center items-center gap-2"
                        >
                          <span className="text-lg">✓</span> Đã thuộc <span className="bg-white/20 px-2 py-0.5 rounded-md text-[10px]">+20 XP</span>
                        </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 text-center flex flex-col items-center justify-center min-h-[400px]">
                    <div className="text-7xl mb-6 drop-shadow-sm">🐸🎉</div>
                    <h3 className="text-2xl font-black text-[#1B5E4B] mb-3">Bạn đã hoàn thành chủ đề!</h3>
                    <p className="text-slate-500 font-medium max-w-sm leading-relaxed">Tuyệt vời! Bạn đã chăm sóc xong góc vườn này. Hãy dạo bước sang chủ đề khác ở cột bên trái để tiếp tục nhé 🌱.</p>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* SEARCH / AI / HANDWRITING MODAL */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[8vh]">
          <div className="absolute inset-0 bg-[#1B5E4B]/80 backdrop-blur-md transition-opacity" onClick={closeSearch} />

          <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-[32px] border border-[#8FD9A8]/50 bg-white shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col border-b border-[#E2E8F0]">
              <div className="flex items-center px-6 py-5">
                <span className="mr-4 text-2xl opacity-50">✨</span>
                <input autoFocus type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.trim()) handleAskAI(); }} placeholder="Tra từ vựng hoặc hỏi AI kiến thức..." className="flex-1 bg-transparent text-xl font-bold text-[#1B5E4B] outline-none placeholder:font-medium placeholder:text-slate-300" />
                <div className="flex items-center gap-3">
                  <button onClick={() => setShowHandwriting(!showHandwriting)} className={`rounded-xl border p-2 text-xl font-black transition-all ${showHandwriting ? "border-[#2F8F6E] bg-[#2F8F6E] text-white shadow-md" : "border-[#E2E8F0] bg-slate-50 text-slate-400 hover:text-[#2F8F6E]"}`} title="Viết tay">✍️</button>
                  <button onClick={closeSearch} className="rounded-xl bg-[#F2765B]/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#F2765B] transition-colors hover:bg-[#F2765B] hover:text-white">ESC</button>
                </div>
              </div>

              {showHandwriting && (
                <div className="animate-slide-down border-t border-[#8FD9A8] bg-[#F4F7F6] p-4">
                  <div className="flex gap-4">
                    <div className="relative mx-auto flex h-[200px] w-full max-w-[200px] justify-center overflow-hidden rounded-2xl border-2 border-[#8FD9A8] bg-white shadow-inner">
                      <div className="pointer-events-none absolute inset-0 flex flex-col opacity-20">
                        <div className="flex-1 border-b border-dashed border-[#1B5E4B]" /><div className="flex-1" />
                        <div className="absolute inset-0 flex"><div className="flex-1 border-r border-dashed border-[#1B5E4B]" /><div className="flex-1" /></div>
                      </div>
                      <canvas ref={canvasRef} width={200} height={200} className="relative z-10 h-full w-full cursor-crosshair touch-none" onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerOut={stopDrawing} />
                      <button onClick={clearCanvas} className="absolute bottom-2 right-2 z-20 rounded-lg bg-slate-100/80 p-1.5 text-[10px] font-bold text-slate-500 backdrop-blur-sm transition hover:bg-[#F2765B] hover:text-white">🗑️ Xóa</button>
                    </div>

                    <div className="flex w-[110px] shrink-0 flex-col">
                      <p className="mb-2 border-b border-[#8FD9A8] pb-2 text-center text-[10px] font-black uppercase tracking-wider text-[#2F8F6E]">Dự đoán</p>
                      <div className="custom-scrollbar grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto pr-1">
                        {handwritingResult.length > 0 ? (
                          handwritingResult.map((char, i) => (
                            <button key={i} onClick={() => { setSearchQuery((prev) => prev + char); clearCanvas(); }} className="flex aspect-square items-center justify-center rounded-xl border border-[#8FD9A8] bg-white text-xl font-black text-[#1B5E4B] shadow-sm transition-all hover:bg-[#2F8F6E] hover:text-white">{char}</button>
                          ))
                        ) : (
                          <div className="col-span-2 flex aspect-[2/1] items-center justify-center rounded-xl border-2 border-dashed border-[#8FD9A8] bg-white text-center text-xs text-[#2F8F6E]">Viết chữ để<br />nhận diện</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto bg-[#F4F7F6] p-6">
              {searchQuery.trim() !== "" && !aiResponse && !isAiLoading && (
                <div onClick={handleAskAI} className="group mb-6 flex cursor-pointer items-center gap-4 rounded-2xl border border-[#8FD9A8] bg-white p-4 transition hover:shadow-md">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#FFD666] text-2xl shadow-sm transition group-hover:scale-110">🤖</div>
                  <div><h4 className="font-black text-[#1B5E4B]">Hỏi Ếch Canh AI</h4><p className="text-xs font-bold text-[#2F8F6E]">Bấm vào đây để AI giải đáp kiến thức: <span className="font-black text-[#F2765B]">"{searchQuery}"</span></p></div>
                  <div className="ml-auto rounded-lg bg-[#8FD9A8]/30 px-3 py-1 font-black text-[#1B5E4B] opacity-0 transition group-hover:opacity-100">Enter ↵</div>
                </div>
              )}

              {isAiLoading && (
                <div className="mb-6 flex animate-pulse items-start gap-4 rounded-[24px] border border-[#8FD9A8] bg-white p-6 shadow-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#2F8F6E] text-xl text-white">🐸</div>
                  <div className="pt-2"><div className="flex gap-1.5"><div className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#8FD9A8]" style={{ animationDelay: "0ms" }} /><div className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#2F8F6E]" style={{ animationDelay: "150ms" }} /><div className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#1B5E4B]" style={{ animationDelay: "300ms" }} /></div><p className="mt-2 text-xs font-bold text-[#2F8F6E]">Ếch Canh đang suy nghĩ...</p></div>
                </div>
              )}

              {aiResponse && !isAiLoading && (
                <div className="relative mb-6 flex animate-fade-in items-start gap-4 overflow-hidden rounded-[24px] border border-[#8FD9A8] bg-white p-6 shadow-sm">
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-[40%_60%_70%_30%/40%_50%_60%_50%] bg-[#2F8F6E] text-xl text-white shadow-md">🐸</div>
                  <div className="relative z-10 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <h4 className="font-black text-[#1B5E4B]">Ếch Canh AI</h4>
                      <span className="rounded-md bg-[#8FD9A8]/30 px-2 py-0.5 text-[9px] font-bold text-[#2F8F6E]">AI ASSISTANT</span>
                    </div>
                    <div className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-[#1B5E4B]">{aiResponse}</div>
                  </div>
                </div>
              )}

              {!aiResponse && !isAiLoading && searchQuery.trim() !== "" && searchResults.length > 0 && (
                <div className="space-y-2">
                  <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">Kết quả từ điển nhanh</p>
                  {searchResults.map((item, idx) => (
                    <div key={idx} className="group flex cursor-pointer items-center justify-between rounded-2xl border border-transparent bg-white p-4 shadow-sm transition-all hover:border-[#8FD9A8] hover:bg-[#8FD9A8]/10">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F4F7F6] text-2xl font-black text-[#1B5E4B] shadow-inner group-hover:bg-white border border-[#E2E8F0]">{item.hanzi}</div>
                        <div><h4 className="font-bold text-[#1B5E4B] group-hover:text-[#2F8F6E]">{item.pinyin}</h4><p className="text-sm font-medium text-slate-500">{item.meaning}</p></div>
                      </div>
                      <span className="rounded-lg bg-[#8FD9A8]/30 px-3 py-1 text-[10px] font-bold text-[#2F8F6E] shadow-sm">{item.type}</span>
                    </div>
                  ))}
                </div>
              )}

              {searchQuery.trim() === "" && !aiResponse && (
                <div className="flex flex-col items-center justify-center py-16 text-center opacity-60">
                  <span className="mb-4 text-6xl grayscale opacity-50">🔍</span>
                  <p className="text-lg font-bold text-slate-500">Tìm kiếm từ vựng, ngữ pháp...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}