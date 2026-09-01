import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata = {
  title: 'Hành Trình HSK',
  description: 'Nền tảng học và thi HSK trực tuyến',
}

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      <html lang="vi">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}