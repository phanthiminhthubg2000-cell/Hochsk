// Proxy cùng tên miền để mở tệp đề thi / bài giảng .html lưu trên Firebase Storage trong iframe.
// Lý do: Firebase Storage có thể trả tệp với Content-Type sai (application/octet-stream),
// kèm Content-Disposition hoặc chặn nhúng → iframe hiện trang trắng.
// Ở đây tải tệp phía máy chủ rồi trả lại đúng "text/html; charset=utf-8".
export const runtime = "edge";

const ALLOWED_HOSTS = ["firebasestorage.googleapis.com", "storage.googleapis.com"];

export async function GET(req) {
  const u = new URL(req.url).searchParams.get("u");
  let target;
  try { target = new URL(u); } catch { return new Response("URL không hợp lệ", { status: 400 }); }

  const okHost = ALLOWED_HOSTS.includes(target.hostname) || target.hostname.endsWith(".firebasestorage.app");
  if (target.protocol !== "https:" || !okHost) return new Response("Không cho phép", { status: 403 });

  const upstream = await fetch(target.toString(), { cache: "no-store" });
  if (!upstream.ok) {
    return new Response(
      `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:40px;color:#b91c1c">
       <h2>Không tải được đề thi (mã lỗi ${upstream.status})</h2>
       <p>Tệp có thể đã bị xoá khỏi Firebase Storage hoặc quy tắc Storage không cho phép đọc. Hãy up lại đề ở trang giáo viên.</p></body>`,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "private, max-age=300",
    },
  });
}
