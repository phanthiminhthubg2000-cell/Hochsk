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
  
  // State lưu trữ số ngày đăng nhập liên tiếp
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    async function syncUserAndCheckStreak() {
      if (user) {
        try {
          const studentRef = doc(db, "progress", user.id);
          const docSnap = await getDoc(studentRef);
          
          // Lấy ngày hiện tại theo định dạng YYYY-MM-DD
          const todayObj = new Date();
          const todayStr = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
          
          let currentStreak = 1; // Mặc định là 1 nếu là người mới

          if (docSnap.exists()) {
            const data = docSnap.data();
            const lastStreakDate = data.lastStreakDate;
            const savedStreak = data.streakCount || 0;

            if (lastStreakDate === todayStr) {
              // Hôm nay đã đăng nhập rồi -> Giữ nguyên chuỗi
              currentStreak = savedStreak;
            } else {
              // Tính ngày hôm qua
              const yesterdayObj = new Date();
              yesterdayObj.setDate(yesterdayObj.getDate() - 1);
              const yesterdayStr = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayObj.getDate()).padStart(2, '0')}`;

              if (lastStreakDate === yesterdayStr) {
                // Đăng nhập liên tiếp -> Cộng 1
                currentStreak = savedStreak + 1;
              } else {
                // Bỏ lỡ quá 1 ngày -> Reset chuỗi về 1
                currentStreak = 1;
              }
            }
          }

          setStreak(currentStreak);

          // Cập nhật lên Firebase
          await setDoc(studentRef, {
            email: user.primaryEmailAddress?.emailAddress || "Không rõ email",
            name: user.fullName || "Học viên",
            lastLogin: serverTimestamp(),
            lastStreakDate: todayStr,
            streakCount: currentStreak
          }, { merge: true });

        } catch (error) {
          console.error("Lỗi đồng bộ tài khoản lên Firebase:", error);
        }
      }
    }
    
    if (isLoaded) syncUserAndCheckStreak();
  }, [user, isLoaded]);

  // Hàm thiết lập lại dữ liệu học tập
  const handleResetData = async () => {
    if (!user) return;
    
    const confirmReset = window.confirm("⚠️ CẢNH BÁO TỐI KHẨN: Bạn có chắc chắn muốn XÓA TOÀN BỘ EXP, số từ vựng đã học và các chứng chỉ HSK không? Hành động này không thể hoàn tác!");
    
    if (!confirmReset) return;

    try {
      // 1. Xóa dữ liệu lưu trên bộ nhớ trình duyệt (LocalStorage)
      localStorage.removeItem("hskk_exp");
      localStorage.removeItem("hskk_word_progress");

      // 2. Xóa dữ liệu điểm và chứng chỉ trên Firebase (Giữ lại Chuỗi Streak để động viên)
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

      alert("🔄 Đã xóa toàn bộ dữ liệu học tập. Bắt đầu hành trình mới nào!");
      window.location.reload(); // Tải lại trang để áp dụng thay đổi
      
    } catch (error) {
      console.error("Lỗi xóa dữ liệu:", error);
      alert("Đã xảy ra lỗi khi thiết lập lại dữ liệu.");
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
  ];

  return (
    <main className="flex min-h-screen flex-col items-center py-12 bg-slate-50 px-4">
      <div className="w-full max-w-5xl flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-800 tracking-tight">Hành Trình HSK</h1>
          <p className="text-slate-500 mt-2 font-medium">Chọn một kỹ năng bên dưới để bắt đầu luyện tập</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {isSignedIn && (
            <button 
              onClick={handleResetData}
              className="px-4 py-2.5 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200 transition text-sm flex items-center gap-2"
              title="Xóa toàn bộ dữ liệu và học lại từ đầu"
            >
              🔄 Học lại từ đầu
            </button>
          )}

          {isTeacher && (
            <Link href="/dashboard">
              <button className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold shadow-md hover:bg-rose-700 transition animate-pulse text-sm flex items-center gap-2">
                👩‍🏫 Quản lý
              </button>
            </Link>
          )}

          {isSignedIn ? (
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-1 bg-orange-100 text-orange-600 px-3 py-1 rounded-lg font-black text-sm">
                🔥 {streak} Ngày
              </div>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <span className="font-bold text-slate-600 text-sm hidden sm:block">Xin chào, {user?.firstName || "bạn"}!</span>
              <UserButton afterSignOutUrl="/" />
            </div>
          ) : (
            <SignInButton mode="modal">
              <button className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold shadow-md hover:bg-slate-700 transition">
                👤 Đăng nhập
              </button>
            </SignInButton>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full max-w-5xl">
        {features.map((feature) => (
          <Link href={feature.link} key={feature.id}>
            <div className="flex flex-col p-6 bg-white rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1 group h-full">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 ${feature.bg}`}>
                {feature.icon}
              </div>
              <h2 className={`text-2xl font-black mb-1 ${feature.color}`}>{feature.name}</h2>
              <p className="text-slate-500 text-sm font-medium">{feature.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}