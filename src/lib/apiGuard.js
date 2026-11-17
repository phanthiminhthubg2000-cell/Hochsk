// Bảo vệ các API tốn phí (gọi AI): bắt buộc đăng nhập + giới hạn số lượt mỗi người mỗi ngày.
// Bộ đếm nằm trong bộ nhớ của từng máy chủ (đủ để chặn gọi ồ ạt; không chính xác tuyệt đối khi có nhiều máy chủ).
import { auth } from "@clerk/nextjs/server";

const hits = new Map();
const day = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // ngày theo giờ Việt Nam

export async function guard(name, limit = 80) {
  let userId = null;
  try { ({ userId } = await auth()); } catch { userId = null; }
  if (!userId) {
    const msg = "Bạn cần đăng nhập để dùng chức năng chấm/gợi ý bằng AI.";
    return Response.json({ error: msg, reply: msg, feedback: msg }, { status: 401 });
  }
  const key = `${name}:${userId}:${day()}`;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (hits.size > 5000) for (const k of hits.keys()) { if (!k.endsWith(day())) hits.delete(k); }
  if (n > limit) {
    const msg = `Hôm nay bạn đã dùng hết ${limit} lượt cho chức năng này. Ngày mai quay lại nhé!`;
    return Response.json({ error: msg, reply: msg, feedback: msg }, { status: 429 });
  }
  return null;
}
