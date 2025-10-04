import './globals.css'
import { ReactNode } from 'react'
import Providers from './providers'

export const metadata = {
  title: '场地管理器 - 羽毛球赛事系统',
  description: '裁判员专用的场地比分管理界面',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="zh">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}