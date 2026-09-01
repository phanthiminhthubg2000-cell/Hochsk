import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Khai báo trang chủ ("/") là nơi duy nhất được tự do truy cập
const isPublicRoute = createRouteMatcher(["/"]);

export default clerkMiddleware((auth, req) => {
  // Nếu khách click vào các trang học tập (không nằm trong danh sách mở cửa)
  if (!isPublicRoute(req)) {
    // Kiểm tra xem khách đã đăng nhập chưa
    const { userId } = auth();
    
    // Nếu chưa có tài khoản, tự động "quay xe" đẩy sang trang Đăng nhập của Clerk
    if (!userId) {
      return auth().redirectToSignIn();
    }
  }
});

export const config = {
  matcher: [
    // Bỏ qua các file cấu hình, hình ảnh, CSS để web tải nhanh hơn
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Luôn chạy bảo mật cho các đường dẫn API
    '/(api|trpc)(.*)',
  ],
};