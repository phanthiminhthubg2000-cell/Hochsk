"use client";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs, orderBy, query } from "firebase/firestore";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State dùng để theo dõi học sinh nào đang được click mở rộng
  const [expandedId, setExpandedId] = useState(null);

  const isTeacher = user?.publicMetadata?.role === "teacher";

  useEffect(() => {
    async function fetchStudentsProgress() {
      if (isTeacher) {
        try {
          // Lấy danh sách học sinh từ bảng progress
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
          console.error("Lỗi lấy dữ liệu học sinh:", e);
        } finally {
          setLoading(false);
        }
      } else if (isLoaded) {
        setLoading(false);
      }
    }
    if (isLoaded) {
      fetchStudentsProgress();
    }
  }, [isLoaded, isTeacher]);

  // Hàm xử lý khi click vào tên 1 học sinh
  const toggleStudent = (id) => {
    if (expandedId === id) {
      setExpandedId(null); // Click lần 2 thì thu gọn
    } else {
      setExpandedId(id); // Click lần 1 thì mở rộng
    }
  };

  if (!isLoaded || loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50"><h1 className="text-xl font-bold animate-pulse text-rose-500">Đang tải bảng quản lý...</h1></main>;
  }

  if (!isTeacher) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <h1 className="text-3xl font-black text-slate-800 mb-2">🚫 Truy cập bị từ chối</h1>
        <p className="text-slate-500 mb-6">Trang này chỉ dành riêng cho tài khoản Giáo viên.</p>
        <Link href="/" className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition">Về Trang Chủ</Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center py-10 bg-slate-50 px-4">
      <div className="w-full max-w-5xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2">
            <span>←</span> Về Trang Chủ
          </button>
        </Link>
        <h1 className="text-3xl font-extrabold text-rose-600">Bảng Quản Lý Học Sinh</h1>
      </div>

      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-xl border p-8">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-slate-800">Tiến độ chi tiết của học viên</h2>
          <span className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-full font-bold text-sm">Tổng số học sinh: {students.length}</span>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 font-medium">Chưa có học sinh nào đăng ký trên hệ thống.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {students.map((student) => (
              <div 
                key={student.id} 
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${expandedId === student.id ? 'border-rose-300 shadow-md bg-white' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:shadow-sm'}`}
              >
                {/* THANH TIÊU ĐỀ (Click để mở) */}
                <div 
                  onClick={() => toggleStudent(student.id)}
                  className="p-5 flex justify-between items-center cursor-pointer select-none"
                >
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
                    <div className={`transform transition-transform text-slate-400 text-xl ${expandedId === student.id ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>

                {/* KHU VỰC CHI TIẾT (Chỉ hiện khi click) */}
                {expandedId === student.id && (
                  <div className="px-5 pb-5 border-t border-slate-100 pt-5 bg-white">
                    <p className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Chi tiết tiến độ học tập</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      
                      {/* Thẻ 1: Từ Vựng & Sắp Xếp */}
                      <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">🗂️</span>
                          <span className="font-bold text-blue-700">HSK Từ Vựng</span>
                        </div>
                        {student.learnedVocab && student.learnedVocab.length > 0 ? (
                          <div>
                            <p className="text-3xl font-black text-blue-600">{student.learnedVocab.length} <span className="text-sm font-medium text-blue-500">từ</span></p>
                            <p className="text-xs text-blue-500 mt-1">Đã được đánh dấu thuộc</p>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-slate-400 italic py-2">Chưa học</p>
                        )}
                      </div>

                      {/* Thẻ 2: Nghe chép chính tả */}
                      <div className="p-4 rounded-xl border border-teal-100 bg-teal-50/50 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">🎧</span>
                          <span className="font-bold text-teal-700">Nghe Chép Chính Tả</span>
                        </div>
                        {student.dictationExp ? (
                          <div>
                            <p className="text-3xl font-black text-teal-600">{student.dictationExp} <span className="text-sm font-medium text-teal-500">EXP</span></p>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-slate-400 italic py-2">Chưa học</p>
                        )}
                      </div>

                      {/* Thẻ 3: HSKK Khẩu Ngữ */}
                      <div className="p-4 rounded-xl border border-rose-100 bg-rose-50/50 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">🎤</span>
                          <span className="font-bold text-rose-700">Thi HSKK</span>
                        </div>
                        {student.hskkScore ? (
                          <div>
                            <p className="text-3xl font-black text-rose-600">{student.hskkScore} <span className="text-sm font-medium text-rose-500">Điểm</span></p>
                            <p className="text-xs text-rose-500 mt-1">Lần thi gần nhất</p>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-slate-400 italic py-2">Chưa thi</p>
                        )}
                      </div>
                      
                      {/* Thẻ 4: Dịch câu */}
                      <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">✍️</span>
                          <span className="font-bold text-indigo-700">Dịch Câu</span>
                        </div>
                        {student.translateExp ? (
                          <div>
                            <p className="text-3xl font-black text-indigo-600">{student.translateExp} <span className="text-sm font-medium text-indigo-500">EXP</span></p>
                          </div>
                        ) : (
                          <p className="text-sm font-bold text-slate-400 italic py-2">Chưa học</p>
                        )}
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