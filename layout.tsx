import '@/styles/globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Kanban Board',
  description: 'Sistema de gerenciamento de produção',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background">
        {children}
      </body>
    </html>
  )
} 