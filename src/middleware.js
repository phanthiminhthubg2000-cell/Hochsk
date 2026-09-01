import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Khai báo các đường dẫn được phép truy cập tự do (không cần đăng nhập)
// Ở đây chúng ta chỉ mở cửa cho Trang chủ ("/")
const isPublicRoute = createRouteMatcher(["/"]);

export default clerkMiddleware((auth, req) => {
  // Nếu người dùng vào một trang KHÔNG NẰM TRONG danh sách public ở trên, bắt buộc đăng nhập
  if (!isPublicRoute(req)) {
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