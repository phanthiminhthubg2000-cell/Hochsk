import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware((auth, req) => {
  // Lấy đường dẫn hiện tại mà khách đang truy cập
  const path = req.nextUrl.pathname;

  // Nếu khách đang ở đúng Trang chủ ("/") thì cho phép đi qua, không làm gì cả
  if (path === "/") {
    return;
  }

  // Nếu khách vào bất kỳ trang nào khác, tự động bảo vệ và yêu cầu đăng nhập
  auth().protect();
});

export const config = {
  matcher: [
    // Bỏ qua các file tĩnh (hình ảnh, css, phông chữ...) để web không bị lỗi giao diện
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Luôn bảo mật các đường dẫn API
    '/(api|trpc)(.*)',
  ],
};