// ============================================================
// Service worker của app Sơn Hải Thư Viện
//  - Trang: mạng trước, mất mạng thì lấy bản đã lưu, không có thì trang /offline.html
//  - Tệp tĩnh của Next (/_next/static), biểu tượng, phông: lưu lâu (tên tệp có mã băm)
//  - Dữ liệu học (thẻ từ, bài giảng, Con đường, ảnh, audio đọc): dùng bản lưu, cập nhật ngầm
//  - KHÔNG lưu: phòng thi (/hsk-exam, /hsk2-exam, /hskk-exam…), /api (trừ /api/tts), đăng nhập, Firebase
// Đổi VERSION khi cần xoá bộ nhớ đệm cũ.
// ============================================================
const VERSION = "shtv-v2";
const STATIC = `${VERSION}-static`, PAGES = `${VERSION}-pages`, DATA = `${VERSION}-data`, MEDIA = `${VERSION}-media`;
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];
const NO_CACHE = /^\/(hsk-exam|hsk2-exam|hsk3-exam|hskk-exam|de-thi-hsk|api(?!\/tts)|sign-in|sign-up|teacher)(\/|$)/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

async function trim(name, max) {
  const c = await caches.open(name); const ks = await c.keys();
  for (let i = 0; i < ks.length - max; i++) await c.delete(ks[i]);
}
async function cacheFirst(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) { c.put(req, res.clone()); if (max) trim(name, max); }
  return res;
}
async function staleWhileRevalidate(req, name, max) {
  const c = await caches.open(name);
  const hit = await c.match(req);
  const net = fetch(req).then((res) => { if (res.ok && res.status === 200) { c.put(req, res.clone()); if (max) trim(name, max); } return res; }).catch(() => hit);
  return hit || net;
}
async function networkFirst(req) {
  const c = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    if (res.ok && res.status === 200) { c.put(req, res.clone()); trim(PAGES, 40); }
    return res;
  } catch (_) {
    return (await c.match(req, { ignoreSearch: true })) || (await caches.match("/offline.html"));
  }
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;            // Clerk, Firebase, phông Google… để trình duyệt tự lo
  const p = url.pathname;
  if (NO_CACHE.test(p) || req.headers.has("range")) return;   // phòng thi luôn lấy mới; audio tua (range) không chặn
  if (req.mode === "navigate") return e.respondWith(networkFirst(req));
  if (p.startsWith("/_next/static/") || p.startsWith("/icons/") || /\.(woff2?|ttf)$/.test(p)) return e.respondWith(cacheFirst(req, STATIC));
  if ((p.startsWith("/api/tts") || p.startsWith("/audio/")) && !p.endsWith(".json")) return e.respondWith(cacheFirst(req, MEDIA, 400));
  if (/\.(png|jpe?g|webp|svg|gif)$/.test(p)) return e.respondWith(cacheFirst(req, MEDIA, 400));
  if (p.startsWith("/data/") || p.startsWith("/lectures/") || p.endsWith(".json")) return e.respondWith(staleWhileRevalidate(req, DATA, 300));
});

// Thông báo nhắc học (để sẵn cho bước sau)
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { title: "Sơn Hải Thư Viện", body: e.data?.text() || "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Sơn Hải Thư Viện", { body: d.body || "", icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: d.url || "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url || "/"));
});
