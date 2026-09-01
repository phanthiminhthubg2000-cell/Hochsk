import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Chỉ mở cửa cho trang chủ "/"
const isPublicRoute = createRouteMatcher(["/"]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // Bỏ qua các file tĩnh, hình ảnh, cấu hình hệ thống
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Luôn chạy middleware cho các đường dẫn API
    '/(api|trpc)(.*)',
  ],
};