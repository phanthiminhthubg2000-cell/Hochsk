"use client";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs, query } from "firebase/firestore";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const isTeacher = user?.publicMetadata?.role === "teacher";

  useEffect(() => {
    async function fetchStudentsProgress() {
      if (isTeacher) {
        try {
          const q = query(collection(db, "progress"));
          const querySnapshot = await getDocs(q);
          const studentList = [];
          querySnapshot.forEach((doc) => {
            studentList.push({ id: doc.id, ...doc.data() });
          });
          
          // Sắp xếp học sinh mới đăng nhập lên đầu
          studentList.sort((a, b) => (b.lastLogin?.toMillis() || 0) - (a.lastLogin?.toMillis() || 0));
          
          setStudents(studentList);
        } catch (e) {
          console.error("Lỗi lấy dữ liệu:", e);
        } finally {
          setLoading(false);
        }
      } else if (isLoaded) {
        setLoading(false);
      }
    }
    if (isLoaded) fetchStudentsProgress();
  }, [isLoaded, isTeacher]);

  const toggleStudent = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (!isLoaded || loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50"><h1 className="text-xl font-bold animate-pulse text-rose-500">Đang tải bảng quản lý...</h1></main>;
  
  if (!isTeacher) return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
      <h1 className="text-3xl font-black text-slate-800 mb-2">🚫 Truy cập bị từ chối</h1>
      <p className="text-slate-500 mb-6">Trang này chỉ dành riêng cho tài khoản Giáo viên.</p>
      <Link href="/" className="mt-4 px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition">Về Trang Chủ</Link>
    </main>
  );

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-6xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2">
            <span>←</span> Về Trang Chủ
          </button>
        </Link>
        <h1 className="text-3xl font-extrabold text-rose-600">Bảng Quản Lý Học Sinh</h1>
      </div>

      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl border p-8">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-slate-800">Tiến độ chi tiết của học viên</h2>
          <span className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-full font-bold text-sm">Tổng học sinh: {students.length}</span>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12 text-slate-500 font-medium">Chưa có học sinh nào đăng ký.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {students.map((student) => (
              <div key={student.id} className={`rounded-2xl border transition-all duration-300 overflow-hidden ${expandedId === student.id ? 'border-rose-300 shadow-md bg-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}>
                
                {/* THANH TIÊU ĐỀ HỌC SINH */}
                <div onClick={() => toggleStudent(student.id)} className="p-5 flex justify-between items-center cursor-pointer select-none">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-black text-xl">
                      {student.name ? student.name.charAt(0).toUpperCase() : "👤"}
                    </div>
                    <div>
                      <p className="font-bold text-lg text-slate-800">{student.name || "Học viên chưa cập nhật tên"}</p>
                      <p className="text-sm text-slate-500">{student.email || student.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-slate-400 font-bold uppercase mb-1">Đăng nhập lần cuối</p>
                      <p className="text-sm font-medium text-slate-600">
                        {student.lastLogin?.toDate ? student.lastLogin.toDate().toLocaleString('vi-VN') : "Chưa rõ"}
                      </p>
                    </div>
                    <div className={`transform transition-transform text-slate-400 text-xl ${expandedId === student.id ? 'rotate-180' : ''}`}>▼</div>
                  </div>
                </div>

                {/* BẢNG ĐIỂM CHI TIẾT CÁC MÔN */}
                {expandedId === student.id && (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-5 bg-white">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      
                      {/* 1. Từ vựng HSK */}
                      <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col justify-between">
                        <p className="font-bold text-blue-700 mb-2">🗂️ HSK Từ Vựng</p>
                        {student.learnedVocab?.length > 0 ? <p className="text-2xl font-black text-blue-600">{student.learnedVocab.length} <span className="text-sm font-medium text-blue-500">từ</span></p> : <p className="text-slate-400 text-sm italic">Chưa học</p>}
                      </div>

                      {/* 2. Chủ đề */}
                      <div className="p-4 rounded-xl border border-pink-100 bg-pink-50/50 flex flex-col justify-between">
                        <p className="font-bold text-pink-700 mb-2">📚 Chủ Đề</p>
                        {student.topicExp ? <p className="text-2xl font-black text-pink-600">{student.topicExp} <span className="text-sm font-medium text-pink-500">EXP</span></p> : <p className="text-slate-400 text-sm italic">Chưa học</p>}
                      </div>

                      {/* 3. Nghe chép */}
                      <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/50 flex flex-col justify-between">
                        <p className="font-bold text-teal-700 mb-2">🎧 Nghe Chép</p>
                        {student.dictationExp ? <p className="text-2xl font-black text-teal-600">{student.dictationExp} <span className="text-sm font-medium text-teal-500">EXP</span></p> : <p className="text-slate-400 text-sm italic">Chưa học</p>}
                      </div>

                      {/* 4. Dịch câu */}
                      <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between">
                        <p className="font-bold text-indigo-700 mb-2">✍️ Dịch Câu</p>
                        {student.translateExp ? <p className="text-2xl font-black text-indigo-600">{student.translateExp} <span className="text-sm font-medium text-indigo-500">EXP</span></p> : <p className="text-slate-400 text-sm italic">Chưa học</p>}
                      </div>

                      {/* 5. Sắp xếp */}
                      <div className="p-4 rounded-xl border border-orange-100 bg-orange-50/50 flex flex-col justify-between">
                        <p className="font-bold text-orange-700 mb-2">🧩 Sắp Xếp</p>
                        {student.arrangeExp ? <p className="text-2xl font-black text-orange-600">{student.arrangeExp} <span className="text-sm font-medium text-orange-500">EXP</span></p> : <p className="text-slate-400 text-sm italic">Chưa học</p>}
                      </div>

                      {/* 6. Thực chiến (Sẽ hiển thị Chưa học nếu bạn chưa làm tab này) */}
                      <div className="p-4 rounded-xl border border-green-100 bg-green-50/50 flex flex-col justify-between">
                        <p className="font-bold text-green-700 mb-2">💬 Thực Chiến</p>
                        {student.roleplayExp ? <p className="text-2xl font-black text-green-600">{student.roleplayExp} <span className="text-sm font-medium text-green-500">EXP</span></p> : <p className="text-slate-400 text-sm italic">Chưa học</p>}
                      </div>

                      {/* 7. HSKK */}
                      <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/50 flex flex-col justify-between">
                        <p className="font-bold text-rose-700 mb-2">🎤 Thi HSKK</p>
                        {student.hskkScore ? <p className="text-2xl font-black text-rose-600">{student.hskkScore} <span className="text-sm font-medium text-rose-500">Điểm</span></p> : <p className="text-slate-400 text-sm italic">Chưa thi</p>}
                      </div>

                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}