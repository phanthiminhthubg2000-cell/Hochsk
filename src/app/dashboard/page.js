"use client";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { collection, getDocs } from "firebase/firestore";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Kiểm tra quyền Giáo viên
  const isTeacher = user?.publicMetadata?.role === "teacher";

  useEffect(() => {
    async function fetchStudentsProgress() {
      if (isTeacher) {
        try {
          const querySnapshot = await getDocs(collection(db, "progress"));
          const studentList = [];
          querySnapshot.forEach((doc) => {
            studentList.push({ id: doc.id, ...doc.data() });
          });
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

  if (!isLoaded || loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50"><h1 className="text-xl font-bold animate-pulse text-rose-500">Đang tải bảng quản lý...</h1></main>;
  }

  // Nếu không phải giáo viên thì chặn lại
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
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <Link href="/">
          <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl shadow-sm hover:bg-slate-100 transition flex items-center gap-2">
            <span>←</span> Về Trang Chủ
          </button>
        </Link>
        <h1 className="text-3xl font-extrabold text-rose-600">Bảng Quản Lý Học Sinh</h1>
      </div>

      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl border p-8">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h2 className="text-xl font-bold text-slate-800">Tiến độ từ vựng học viên trên hệ thống</h2>
          <span className="px-4 py-1.5 bg-rose-50 text-rose-600 rounded-full font-bold text-sm">Tổng số tài khoản: {students.length}</span>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 font-medium">Chưa có học sinh nào đồng bộ dữ liệu học tập lên đám mây.</p>
            <p className="text-slate-400 text-sm mt-1">Hãy thử đăng nhập bằng một tài khoản học sinh khác và bấm "Đã thuộc" vài từ vựng nhé!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {students.map((student) => (
              <div key={student.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex justify-between items-center hover:shadow-md transition">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Mã Định Danh Học Sinh (UID)</p>
                  <p className="font-mono text-sm font-bold text-slate-700">{student.id}</p>
                  <p className="text-xs text-slate-500 mt-2">Cập nhật lần cuối: {student.updatedAt?.toDate ? student.updatedAt.toDate().toLocaleString() : "Vừa xong"}</p>
                </div>
                <div className="text-right bg-white px-6 py-3 rounded-xl border border-slate-100 shadow-sm">
                  <span className="text-xs font-bold text-blue-500 uppercase">Từ vựng đã thuộc</span>
                  <p className="text-3xl font-black text-blue-600">{student.learnedVocab?.length || 0}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
