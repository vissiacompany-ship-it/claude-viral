'use client'

import Link from 'next/link'
import { LayoutGrid, User, Settings, Library, MessageSquare } from 'lucide-react'
import LogoMark from './LogoMark'

const navItemCls = (active: boolean) =>
  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14.5px] font-semibold transition-all cursor-pointer ${
    active ? '' : 'hover:brightness-125'
  }`

const navIconWrap = 'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors'

// Navegação lateral persistente — usada no Dashboard e em Perfis (e em qualquer
// outra página "de app", fora do editor de template, que tem seu próprio layout full-screen).
export default function Sidebar({ active }: { active: 'dashboard' | 'profiles' | 'library' | 'chat' | 'settings' }) {
  return (
    <aside className="w-64 flex-shrink-0 flex flex-col" style={{ background: 'var(--bo-cloud)', borderRight: '1px solid var(--bo-hairline)' }}>
      <div className="flex items-center gap-3 px-5 h-[68px] shrink-0">
        <div className="w-9 h-9 flex items-center justify-center shrink-0">
          <LogoMark size={32}/>
        </div>
        <span className="text-[16px] font-bold tracking-tight truncate">Claude Viral</span>
      </div>

      <nav className="flex-1 flex flex-col gap-5 px-3.5 py-3 min-h-0">
        <div>
          <p className="px-3.5 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--bo-ash)' }}>Principal</p>
          <div className="flex flex-col gap-1">
            <Link href="/">
              <div className={navItemCls(active === 'dashboard')}
                style={active === 'dashboard' ? { background: 'rgba(255,138,30,0.14)', border: '1px solid var(--accent)', color: 'var(--accent2)' } : { color: 'var(--bo-graphite)' }}>
                <div className={navIconWrap} style={{ background: active === 'dashboard' ? 'var(--grad)' : 'var(--bo-mist)' }}>
                  <LayoutGrid size={16} strokeWidth={2.25} className={active === 'dashboard' ? 'text-black' : ''}/>
                </div>
                Dashboard
              </div>
            </Link>
            <Link href="/chat">
              <div className={navItemCls(active === 'chat')}
                style={active === 'chat' ? { background: 'rgba(255,138,30,0.14)', border: '1px solid var(--accent)', color: 'var(--accent2)' } : { color: 'var(--bo-graphite)' }}>
                <div className={navIconWrap} style={{ background: active === 'chat' ? 'var(--grad)' : 'var(--bo-mist)' }}>
                  <MessageSquare size={16} strokeWidth={active === 'chat' ? 2.25 : 1.9} className={active === 'chat' ? 'text-black' : ''}/>
                </div>
                Chat
              </div>
            </Link>
            <Link href="/library">
              <div className={navItemCls(active === 'library')}
                style={active === 'library' ? { background: 'rgba(255,138,30,0.14)', border: '1px solid var(--accent)', color: 'var(--accent2)' } : { color: 'var(--bo-graphite)' }}>
                <div className={navIconWrap} style={{ background: active === 'library' ? 'var(--grad)' : 'var(--bo-mist)' }}>
                  <Library size={16} strokeWidth={active === 'library' ? 2.25 : 1.9} className={active === 'library' ? 'text-black' : ''}/>
                </div>
                Biblioteca
              </div>
            </Link>
            <Link href="/profiles">
              <div className={navItemCls(active === 'profiles')}
                style={active === 'profiles' ? { background: 'rgba(255,138,30,0.14)', border: '1px solid var(--accent)', color: 'var(--accent2)' } : { color: 'var(--bo-graphite)' }}>
                <div className={navIconWrap} style={{ background: active === 'profiles' ? 'var(--grad)' : 'var(--bo-mist)' }}>
                  <User size={16} strokeWidth={active === 'profiles' ? 2.25 : 1.9} className={active === 'profiles' ? 'text-black' : ''}/>
                </div>
                Perfis
              </div>
            </Link>
          </div>
        </div>
      </nav>

      <div className="p-3.5 shrink-0" style={{ borderTop: '1px solid var(--bo-hairline)' }}>
        <Link href="/settings">
          <div className={navItemCls(active === 'settings') + ' text-[13.5px]'}
            style={active === 'settings' ? { background: 'rgba(255,138,30,0.14)', border: '1px solid var(--accent)', color: 'var(--accent2)' } : { color: 'var(--bo-graphite)' }}>
            <div className={navIconWrap} style={{ background: active === 'settings' ? 'var(--grad)' : 'var(--bo-mist)' }}>
              <Settings size={15} className={active === 'settings' ? 'text-black' : ''}/>
            </div>
            Configurações
          </div>
        </Link>
      </div>
    </aside>
  )
}
