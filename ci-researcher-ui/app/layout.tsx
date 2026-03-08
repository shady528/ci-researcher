import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CI Researcher v2 — Multi-Agent System',
  description: 'Enterprise competitive intelligence with LangGraph, RAG, and auto-delivery',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}