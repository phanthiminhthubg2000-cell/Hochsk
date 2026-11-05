"use client";
// Hồ sơ thư sinh trực tiếp (users/{uid}) + trạng thái tu vi — dùng cho các trang tu tiên v2
import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { db } from "../firebase";
import { doc, onSnapshot, setDoc, increment } from "firebase/firestore";
import { tuViState } from "./tuVi";

export function useTuVi() {
  const { isSignedIn, userId, isLoaded } = useAuth();
  const [u, setU] = useState(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!isSignedIn || !userId) { setLoaded(isLoaded !== false); return; }
    let off = () => {};
    try { off = onSnapshot(doc(db, "users", userId), (s) => { setU(s.exists() ? s.data() : {}); setLoaded(true); }, () => setLoaded(true)); } catch (_) { setLoaded(true); }
    return () => { try { off(); } catch (_) {} };
  }, [isSignedIn, userId, isLoaded]);
  const tv = u ? tuViState(u.xp || 0, u.tuVi, u.doKiep) : null;
  // Cộng tu vi — các trang tu tiên v2 gọi hàm này
  const gain = async (n, extra = {}) => {
    if (!userId || !(n > 0)) { if (userId && Object.keys(extra).length) await setDoc(doc(db, "users", userId), extra, { merge: true }).catch(() => {}); return; }
    // Tu vi tuần (users.week) do thanh điều hướng ghi khi thấy xp tăng — ở đây chỉ cộng tổng
    await setDoc(doc(db, "users", userId), { xp: increment(n), ...extra }, { merge: true }).catch(() => {});
  };
  return { u, tv, loaded, userId, isSignedIn, gain };
}

// Tuần ISO đơn giản: thứ Hai đầu tuần, theo giờ máy
export function weekKey(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

// Tu vi tuần: gọi khi xp vừa tăng n (thanh điều hướng trang con, trang chủ)
export function weekBump(d, n) {
  const wk = weekKey();
  return d?.week?.k === wk ? { week: { k: wk, xp: increment(n) } } : { week: { k: wk, xp: n } };
}
