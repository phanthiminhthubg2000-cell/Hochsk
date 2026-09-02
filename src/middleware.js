import { clerkMiddleware } from "@clerk/nextjs/server";

// Lệnh clerkMiddleware để trống sẽ cho phép mọi người truy cập tất cả các trang mà không bị chặn
export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};