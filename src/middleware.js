// src/middleware.js
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Khai báo các đường dẫn được phép truy cập tự do (không cần đăng nhập)
const isPublicRoute = createRouteMatcher([
  "/", // Trang chủ
  "/sign-in(.*)", // Trang đăng nhập (bắt buộc mở cửa)
  "/sign-up(.*)", // Trang đăng ký (bắt buộc mở cửa)
]);

export default clerkMiddleware((auth, req) => {
  // Nếu vào một trang KHÔNG NẰM TRONG danh sách public ở trên (ví dụ: "/vocab"), bắt buộc bảo vệ
  if (!isPublicRoute(req)) {
    // protect() sẽ tự động kiểm tra tài khoản, và nếu chưa có, nó sẽ "đẩy" khách về trang đăng nhập ("/sign-in") một cách mượt mà.
    auth().protect();
  }
});

export const config = {
  matcher: [
    // Bỏ qua các file tĩnh và file nội bộ của Next.js
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Luôn chạy middleware cho các API routes
    '/(api|trpc)(.*)',
  ],
};