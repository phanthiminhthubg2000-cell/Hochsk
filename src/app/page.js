"use client";
import Link from "next/link";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { db } from "../firebase"; 
import { doc, setDoc, getDoc, serverTimestamp } from "firebase/firestore";

export default function Home() {
  const { isSignedIn } = useAuth(); 
  const { user, isLoaded } = useUser(); 
  const isTeacher = user?.publicMetadata?.role === "teacher";
  
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    async function syncUserAndCheckStreak() {
      if (user) {
        try {
          const studentRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(studentRef);
          
          const todayObj = new Date();
          const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
          
          let currentStreak = 1;

          if (docSnap.exists()) {
            const data = docSnap.data();
            const lastStreakDate = data.lastStreakDate;
            const savedStreak = data.streakCount || 0;

            if (lastStreakDate === todayStr) {
              currentStreak = savedStreak;
            } else {
              const yesterdayObj = new Date();
              yesterdayObj.setDate(yesterdayObj.getDate() - 1);
              const yesterdayStr = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayObj.getDate()).padStart(2, '0')}`;

              if (lastStreakDate === yesterdayStr) {
                currentStreak = savedStreak + 1;
              } else {
                currentStreak = 1;
              }
            }
          }

          setStreak(currentStreak);

          await setDoc(studentRef, {
            email: user.primaryEmailAddress?.emailAddress || "Không rõ email",
            name: user.fullName || "Học viên",
            lastLogin: serverTimestamp(),
            lastStreakDate: todayStr,
            streakCount: currentStreak,
          }, { merge: true });

        } catch (error) {
          console.error("Lỗi đồng bộ tài khoản lên Firebase:", error);
        }
      }
    }
    
    if (isLoaded) syncUserAndCheckStreak();
  }, [user, isLoaded]);

  const handleUnlockAll = async () => {
    if (!user) return;
    try {
      const studentRef = doc(db, "progress", user.id);
      await setDoc(studentRef, {
        passedHSK1: true,
        passedHSK2: true,
        passedHSK3: true,
        passedHSK4: true,
        passedHSK5: true,
        passedHSK6: true,
      }, { merge: true });

      alert("⚡ Đã mở khóa toàn bộ các cấp độ HSK 1-6! Bạn có thể truy cập mọi tab.");
      window.location.reload();
    } catch (error) {
      console.error("Lỗi mở khóa:", error);
    }
  };

  const handleResetData = async () => {
    if (!user) return;
    const confirmReset = window.confirm("⚠️ CẢNH BÁO TỐI KHẨN: Bạn có chắc chắn muốn XÓA TOÀN BỘ EXP, số từ vựng đã học và các chứng chỉ HSK không?");
    if (!confirmReset) return;

    try {
      localStorage.removeItem("hskk_exp");
      localStorage.removeItem("hskk_word_progress");

      const studentRef = doc(db, "progress", user.id);
      await setDoc(studentRef, {
        vocabExp: 0,
        roleplayExp: 0,
        learnedVocab: [],
        passedHSK1: false,
        passedHSK2: false,
        passedHSK3: false,
        passedHSK4: false,
        passedHSK5: false,
        passedHSK6: false
      }, { merge: true });

      alert("🔄 Đã xóa toàn bộ dữ liệu học tập.");
      window.location.reload();
    } catch (error) {
      console.error("Lỗi xóa dữ liệu:", error);
    }
  };

  const features = [
    { id: "vocab", name: "HSK Từ Vựng", icon: "🗂️", color: "text-blue-600", bg: "bg-blue-50", link: "/vocab", desc: "Học qua Flashcard 3D" },
    { id: "topic", name: "Chủ Đề", icon: "📚", color: "text-pink-600", bg: "bg-pink-50", link: "/topic", desc: "Từ vựng theo thực tế" },
    { id: "dictation", name: "Chép Chính Tả", icon: "🎧", color: "text-teal-600", bg: "bg-teal-50", link: "/dictation", desc: "Luyện nghe tiếng Trung" },
    { id: "translate", name: "Dịch Câu", icon: "✍️", color: "text-indigo-600", bg: "bg-indigo-50", link: "/translate", desc: "AI chấm điểm dịch thuật" },
    { id: "arrange", name: "Sắp Xếp", icon: "🧩", color: "text-orange-600", bg: "bg-orange-50", link: "/arrange", desc: "Luyện tư duy ngữ pháp" },
    { id: "roleplay", name: "Thực Chiến", icon: "💬", color: "text-green-600", bg: "bg-green-50", link: "/roleplay", desc: "Chat cùng người bản xứ AI" },
    { id: "hskk", name: "Thi HSKK", icon: "🎤", color: "text-rose-600", bg: "bg-rose-50", link: "/hskk", desc: "Phòng thi khẩu ngữ tự động" },
    { id: "placement-test", name: "Kiểm Tra Trình Độ", icon: "🎯", color: "text-purple-600", bg: "bg-purple-50", link: "/test", desc: "Làm test 6 phần mở khóa cấp độ" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-800">
      
      {/* 1. SIDEBAR TRÁI */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col justify-between sticky top-0 h-screen p-6">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-emerald-600 text-white font-black px-3 py-2 rounded-xl text-base shadow-sm">HỌC HSK</div>
          </div>

          <nav className="space-y-2">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-2xl font-bold">
              <span>🏠</span> Trang chủ
            </Link>
            <Link href="/test" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl font-medium transition">
              <span>🎯</span> Kiểm tra trình độ
            </Link>
            <Link href="/vocab" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl font-medium transition">
              <span>📚</span> Học tập
            </Link>
            <Link href="/hskk" className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-2xl font-medium transition">
              <span>🎤</span> HSKK Khẩu ngữ
            </Link>
          </nav>
        </div>

        <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 text-xs text-emerald-800">
          <p className="font-bold mb-1">坚持 (Kiên trì)</p>
          <p className="opacity-75">你会看到更好的自己</p>
        </div>
      </aside>

      {/* 2. MAIN CONTENT PHẢI */}
      <main className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-6 md:px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="w-full max-w-md relative hidden sm:block">
            <input 
              type="text" 
              placeholder="🔍 Tìm từ vựng, ngữ pháp, chủ đề..." 
              className="w-full bg-slate-100 border-none rounded-2xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 ml-auto">
            {isSignedIn && (
              <>
                <button 
                  onClick={handleUnlockAll}
                  className="px-3.5 py-2 bg-amber-100 text-amber-700 rounded-xl font-bold hover:bg-amber-200 transition text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Mở khóa tất cả các cấp độ ngay lập tức"
                >
                  ⚡ Mở Khóa
                </button>
                <button 
                  onClick={handleResetData}
                  className="px-3.5 py-2 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200 transition text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Xóa toàn bộ dữ liệu và học lại từ đầu"
                >
                  🔄 Reset
                </button>
              </>
            )}

            {isTeacher && (
              <Link href="/dashboard">
                <button className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold shadow-md hover:bg-rose-700 transition text-xs flex items-center gap-1.5 cursor-pointer">
                  👩‍🏫 Quản lý
                </button>
              </Link>
            )}

            {isSignedIn ? (
              <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-1 bg-orange-100 text-orange-600 px-2.5 py-1 rounded-lg font-black text-xs">
                  🔥 {streak} Ngày
                </div>
                <UserButton afterSignOutUrl="/" />
              </div>
            ) : (
              <SignInButton mode="modal">
                <button className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-bold shadow-md hover:bg-slate-800 transition text-sm cursor-pointer">
                  👤 Đăng nhập
                </button>
              </SignInButton>
            )}
          </div>
        </header>

        {/* Nội dung trang chủ */}
        <div className="p-6 md:p-8 max-w-6xl mx-auto w-full space-y-8">
          
          {/* Banner Hero Chào mừng */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-8 text-white relative overflow-hidden flex items-center justify-between shadow-lg">
            <div className="max-w-xl z-10">
              <h1 className="text-2xl md:text-3xl font-black mb-3">Biết chính xác bạn đang ở đâu và chạm tới mục tiêu HSK!</h1>
              <p className="text-emerald-100 text-sm mb-6">Một lộ trình học cá nhân hóa – dành riêng cho bạn. Đánh giá toàn diện 6 kỹ năng.</p>
              <Link href="/test" className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl shadow transition inline-block text-sm">
                Kiểm tra trình độ ngay →
              </Link>
            </div>
            <div className="hidden lg:block opacity-90 text-right text-6xl">
              加油
            </div>
          </div>

          {/* Khối Thống kê tiến độ & Thành tích (Đưa lên trên cho nổi bật) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Tiến độ học tập */}
            <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800 text-lg">📊 Tiến độ học tập</h3>
                <span className="text-xs font-bold text-emerald-600 cursor-pointer hover:underline">Xem chi tiết →</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-emerald-50/60 p-4 rounded-2xl text-center">
                  <div className="text-2xl font-black text-emerald-700">124</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">Từ đã học</div>
                </div>
                <div className="bg-blue-50/60 p-4 rounded-2xl text-center">
                  <div className="text-2xl font-black text-blue-700">18</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">Bài luyện tập</div>
                </div>
                <div className="bg-orange-50/60 p-4 rounded-2xl text-center">
                  <div className="text-2xl font-black text-orange-700">{streak}</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">Ngày liên tiếp</div>
                </div>
                <div className="bg-purple-50/60 p-4 rounded-2xl text-center">
                  <div className="text-2xl font-black text-purple-700">2h 15m</div>
                  <div className="text-xs text-slate-500 mt-1 font-medium">Thời gian học</div>
                </div>
              </div>
            </div>

            {/* Thành tích huy hiệu */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-slate-800 text-lg">🏆 Thành tích</h3>
                <span className="text-xs font-bold text-emerald-600 cursor-pointer hover:underline">Xem tất cả →</span>
              </div>
              <div className="flex items-center justify-around">
                <div className="text-center">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-xl mx-auto mb-2 shadow-sm">🎖️</div>
                  <span className="text-xs font-bold text-slate-600">Bắt đầu</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-amber-200 rounded-full flex items-center justify-center text-xl mx-auto mb-2 shadow-sm">🔥</div>
                  <span className="text-xs font-bold text-slate-600">Kiên trì</span>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xl mx-auto mb-2 opacity-50">🔒</div>
                  <span className="text-xs font-bold text-slate-400">100 từ</span>
                </div>
              </div>
            </div>

          </div>

          {/* Danh mục công cụ học tập */}
          <div className="pb-12">
            <h2 className="text-xl font-black text-slate-800 mb-4">Khám phá các công cụ học tập</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature) => (
                <Link href={feature.link} key={feature.id}>
                  <div className="flex flex-col p-6 bg-white rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1 group h-full">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-4 ${feature.bg}`}>
                      {feature.icon}
                    </div>
                    <h3 className={`text-xl font-black mb-1 ${feature.color}`}>{feature.name}</h3>
                    <p className="text-slate-500 text-sm font-medium">{feature.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}