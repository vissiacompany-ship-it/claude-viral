'use client'

import Sidebar from '@/components/Sidebar'
import ChatAssistant from '@/components/ChatAssistant'

export default function ChatPage() {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="chat"/>

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="px-8 pt-6 pb-5" style={{ borderBottom: '1px solid var(--bo-hairline)' }}>
          <h1 className="text-xl font-bold tracking-[-0.01em] mb-1">Chat</h1>
          <p className="text-[12px]" style={{ color: 'var(--bo-graphite)' }}>Ideias, briefing e copy completa de carrossel — a mesma inteligência do Claude Viral, em forma de chat.</p>
        </div>
        <div className="flex-1 overflow-hidden p-8">
          <ChatAssistant/>
        </div>
      </main>
    </div>
  )
}
