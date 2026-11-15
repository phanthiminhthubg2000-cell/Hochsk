import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import AppInstall from './AppInstall'

export const metadata = {
  title: 'Sơn Hải Thư Viện 山海书院',
  description: '一书藏山海，心明向远途。 Học tiếng Trung, luyện thi HSK theo con đường tu tiên.',
  applicationName: 'Sơn Hải Thư Viện',
  appleWebApp: { capable: true, title: 'Sơn Hải', statusBarStyle: 'black' },
  icons: { icon: [{ url: '/favicon.ico' }, { url: '/icons/icon-192.png', type: 'image/png', sizes: '192x192' }], apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
}

export const viewport = {
  themeColor: '#1C1A17',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="vi">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&family=Noto+Serif:wght@600;700;800&family=Noto+Serif+SC:wght@500;700;900&family=Ma+Shan+Zheng&display=swap" />
        </head>
        <body>{children}<AppInstall /></body>
      </html>
    </ClerkProvider>
  )
}
