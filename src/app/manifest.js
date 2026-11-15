// Web app manifest — cài Sơn Hải Thư Viện thành app (PWA). Next sinh ra /manifest.webmanifest
export default function manifest() {
  return {
    name: "Sơn Hải Thư Viện 山海书院",
    short_name: "Sơn Hải",
    description: "Học tiếng Trung, luyện thi HSK theo con đường tu tiên.",
    id: "/",
    start_url: "/?src=app",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#EFE7D6",
    theme_color: "#1C1A17",
    lang: "vi",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Luyện Đan · ôn từ", url: "/luyen-dan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Khảo Thí Điện · thi thử", url: "/?tab=exam", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Con đường tu luyện", url: "/con-duong", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
