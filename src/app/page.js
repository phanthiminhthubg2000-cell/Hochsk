"use client";
import Link from "next/link";
import { useAuth, useUser, SignInButton, UserButton } from "@clerk/nextjs";
import { useEffect } from "react";
import { db } from "../firebase"; // Lưu ý: Đảm bảo đường dẫn này trỏ đúng file firebase.js của bạn
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

export default function Home() {
  const { isSignedIn } = useAuth(); 
  // Lấy thông tin chi tiết của người dùng hiện tại
  const { user, isLoaded } = useUser(); 

  // Kiểm tra xem user này có role là teacher không
  const isTeacher = user?.publicMetadata?.role === "teacher";

  // ĐỒNG BỘ DỮ LIỆU TÀI KHOẢN LÊN FIREBASE
  useEffect(() => {
    async function syncUserToFirebase() {
      if (user) {
        try {
          const studentRef = doc(db, "progress", user.id);
          // Lệnh setDoc với { merge: true } sẽ tạo mới tài khoản nếu chưa có, hoặc chỉ cập nhật lastLogin nếu đã có
          await setDoc(studentRef, {
            email: user.primaryEmailAddress?.emailAddress || "Không rõ email",
            name: user.fullName || "Học viên",
            lastLogin: serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          console.error("Lỗi đồng bộ tài khoản lên Firebase:", error);
        }
      }
    }
    
    if (isLoaded) {
      syncUserToFirebase();
    }
  }, [user, isLoaded]);

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
        
        <div className="flex items-center gap-4">
          {/* NÚT BÍ MẬT DÀNH RIÊNG CHO GIÁO VIÊN */}
          {isTeacher && (
            <Link href="/dashboard">
              <button className="px-5 py-2.5 bg-rose-600 text-white rounded-xl font-bold shadow-md hover:bg-rose-700 transition animate-pulse">
                👩‍🏫 Quản lý Học sinh
              </button>
            </Link>
          )}

          {isSignedIn ? (
            <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
              <span className="font-bold text-slate-600">Xin chào, {user?.firstName || "bạn"}!</span>
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
            <div className="flex flex-col p-6 bg-white rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl transition-all cursor-pointer hover:-translate-y-1 group">
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