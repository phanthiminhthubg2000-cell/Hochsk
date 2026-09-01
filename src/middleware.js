import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Chỉ mở cửa cho trang chủ "/"
const isPublicRoute = createRouteMatcher(["/"]);

export default clerkMiddleware((auth, req) => {
  // Nếu vào các trang không phải trang chủ
  if (!isPublicRoute(req)) {
    // Lấy thông tin xem người dùng đã đăng nhập chưa
    const { userId } = auth();
    
    // Nếu chưa đăng nhập (không có userId), lập tức chuyển hướng về trang chủ
    if (!userId) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
});

export const config = {
  matcher: [
    // Bỏ qua các file tĩnh để web tải nhanh
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Chạy bảo mật cho API
    '/(api|trpc)(.*)',
  ],
};