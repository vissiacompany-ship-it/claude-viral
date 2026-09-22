'use client'

import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() =>
    typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark')

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('claude-viral-theme', next)
  }

  return (
    <button onClick={toggle} title={theme === 'light' ? 'Mudar para modo escuro' : 'Mudar para modo claro'}
      className="fixed bottom-4 right-4 z-50 w-9 h-9 rounded-full flex items-center justify-center transition-colors"
      style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--muted)', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
      {theme === 'light' ? <Moon size={15}/> : <Sun size={15}/>}
    </button>
  )
}
