"use client";
// =====================================================================
// Nhận kết quả bài kiểm tra / đề thi ngữ âm do bài giảng (iframe) gửi lên
// và lưu vào Firestore (collection "phonetics_tests").
// Dùng chung cho trang giáo viên (/teacher) và trang học viên.
//
// Đặt file này CÙNG THƯ MỤC với firebase.js (thư mục gốc dự án).
//
// Cách dùng trong một trang:
//   import { usePhoneticsResultSaver } from "../../phoneticsResultSaver";
//   usePhoneticsResultSaver({ role: "student", userId, userName: user?.fullName });
// và thẻ <iframe> hiển thị bài phải có:  allow="microphone; autoplay; fullscreen"
// =====================================================================
import { useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore";

const isFromOwnIframe = (src) =>
  !!src && Array.from(document.querySelectorAll("iframe")).some((f) => f.contentWindow === src);

export function usePhoneticsResultSaver({ role = "student", userId = null, userName = "", onSaved } = {}) {
  useEffect(() => {
    const onMessage = async (e) => {
      const d = e.data;
      if (!d || d.source !== "hochsk-lecture") return;
      // Chỉ nhận tin nhắn từ khung bài giảng nằm trong chính trang này
      if (!isFromOwnIframe(e.source)) return;

      const reply = (msg) => {
        try { e.source.postMessage({ source: "hochsk-dashboard", ...msg }, "*"); } catch (_) {}
      };

      // Bài thi hỏi: đang mở ở trang giáo viên hay học viên?
      if (d.type === "phonetics-hello") {
        reply({ type: "phonetics-role", role, userName: userName || "" });
        return;
      }
      if (d.type !== "phonetics-test-result") return;

      const p = d.payload || {};
      const isTeacher = role === "teacher";
      try {
        // Giáo viên chấm thêm phần đọc ngay trong đề → cập nhật bài đã lưu
        if (p.docId) {
          if (!isTeacher) { reply({ type: "phonetics-test-saved", id: p.docId }); return; }
          await updateDoc(doc(db, "phonetics_tests", p.docId), {
            "reading.rubric": p.reading?.rubric || [],
            "reading.score": p.reading?.score ?? null,
            "reading.graded": !!p.reading?.graded,
            readingScore: p.reading?.score ?? null,
            totalScore: p.total ?? null,
            status: p.reading?.graded ? "graded" : "pending_teacher",
            gradedAt: serverTimestamp()
          });
          reply({ type: "phonetics-test-saved", id: p.docId });
          onSaved?.();
          return;
        }

        // Học viên tự làm: không nhận điểm phần đọc do trình duyệt gửi lên
        const reading = isTeacher
          ? (p.reading || {})
          : { ...(p.reading || {}), graded: false, score: null, rubric: (p.reading?.rubric || []).map(r => ({ ...r, score: null })) };

        const ref = await addDoc(collection(db, "phonetics_tests"), {
          ...p,
          reading,
          status: reading.graded ? "graded" : "pending_teacher",
          listeningScore: p.listening?.score ?? 0,
          readingScore: reading.graded ? (reading.score ?? null) : null,
          totalScore: reading.graded ? (p.total ?? null) : null,
          submittedBy: isTeacher ? "teacher" : "student",
          studentUserId: isTeacher ? null : (userId || null),
          studentAccountName: isTeacher ? "" : (userName || ""),
          teacherId: isTeacher ? (userId || null) : null,
          teacherName: isTeacher ? (userName || "") : "",
          teacherFeedback: "",
          submittedAt: serverTimestamp()
        });
        reply({ type: "phonetics-test-saved", id: ref.id });
        onSaved?.();
      } catch (err) {
        console.error("Lỗi lưu kết quả ngữ âm:", err);
        reply({ type: "phonetics-test-error", message: err.message });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [role, userId, userName, onSaved]);
}
