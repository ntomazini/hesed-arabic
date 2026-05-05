'use client'

import './globals.css'
import { Inter, Scheherazade_New } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

const inter = Inter({ subsets: ['latin'] })

// Arabic font for biblical text display
const scheherazade = Scheherazade_New({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-arabic',
  display: 'swap',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  }))

  return (
    <html lang="ar" dir="ltr">
      <body className={`${inter.className} ${scheherazade.variable}`}>
        <SessionProvider basePath="/app/api/auth">
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#1e3a5f',
                  color: '#fff',
                  borderRadius: '8px',
                  fontSize: '14px',
                },
                success: {
                  iconTheme: { primary: '#22c55e', secondary: '#fff' },
                },
                error: {
                  iconTheme: { primary: '#ef4444', secondary: '#fff' },
                },
              }}
            />
          </QueryClientProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
