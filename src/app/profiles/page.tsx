'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Profile } from '@/types'
import { ArrowLeft, Plus, Trash2, Edit3, User } from 'lucide-react'

const TONES = ['Profissional', 'Educativo', 'Inspiracional', 'Casual', 'Direto', 'Polêmico', 'Jornalístico']
const CONTENT_TYPES = ['Tendência Interpretada', 'Tese Contraintuitiva', 'Case/Benchmark', 'Previsão/Futuro', 'Análise Cultural', 'Investigação']

const EMPTY: Omit<Profile, 'id' | 'createdAt'> = {
  name: '', instagram: '', niche: '', audience: '',
  tone: '', contentType: '', extraInstructions: '', primaryColor: '#E8421A', logo: undefined,
  brandText: '', brandPosition: 'tr', verifiedBadge: true,
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const data = await fetch('/api/profiles').then(r => r.json())
    setProfiles(data)
  }, [])

  useEffect(() => { load() }, [load])

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY)
    setShowForm(true)
  }

  const openEdit = (p: Profile) => {
    setEditing(p)
    setForm({ name: p.name, instagram: p.instagram, niche: p.niche, audience: p.audience, tone: p.tone, contentType: p.contentType, extraInstructions: p.extraInstructions, primaryColor: p.primaryColor, logo: p.logo, brandText: p.brandText, brandPosition: p.brandPosition, verifiedBadge: p.verifiedBadge !== false })
    setShowForm(true)
  }

  const save = async () => {
    setSaving(true)
    const payload = editing ? { ...editing, ...form } : { ...form }
    await fetch('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    })
    await load()
    setShowForm(false)
    setSaving(false)
  }

  const deleteProfile = async (id: string) => {
    if (!confirm('Excluir este perfil?')) return
    await fetch('/api/profiles', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' }
    })
    setProfiles(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <button className="p-2 rounded-xl hover:opacity-80 transition-opacity" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <ArrowLeft size={18}/>
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Perfis</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Configure sua marca, nicho e estilo de conteúdo</p>
          </div>
          <button onClick={openNew} className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-black" style={{ background: 'var(--grad)' }}>
            <Plus size={16}/> Novo perfil
          </button>
        </div>

        {/* Profile list */}
        <div className="space-y-3 mb-8">
          {profiles.length === 0 && !showForm && (
            <div className="text-center py-16 rounded-2xl" style={{ background: 'var(--bg2)', border: '1px dashed var(--border)' }}>
              <User size={40} className="mx-auto mb-3" style={{ color: 'var(--muted)' }}/>
              <p className="font-semibold mb-1">Nenhum perfil criado</p>
              <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>Crie um perfil para cada projeto ou cliente</p>
              <button onClick={openNew} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-black" style={{ background: 'var(--grad)' }}>
                Criar primeiro perfil
              </button>
            </div>
          )}
          {profiles.map(p => (
            <div key={p.id} className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white flex-shrink-0 overflow-hidden" style={{ background: p.primaryColor }}>
                {p.logo ? <img src={p.logo} alt="" className="w-full h-full object-cover"/> : p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm">{p.name}</p>
                  {p.instagram && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>@{p.instagram}</span>}
                </div>
                <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{p.niche} {p.tone ? `· ${p.tone}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openEdit(p)} className="p-2 rounded-lg hover:opacity-80 transition-opacity" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                  <Edit3 size={14}/>
                </button>
                <button onClick={() => deleteProfile(p.id)} className="p-2 rounded-lg hover:opacity-80 transition-opacity" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Form */}
        {showForm && (
          <div className="rounded-2xl p-6" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <h2 className="font-bold mb-5">{editing ? 'Editar perfil' : 'Novo perfil'}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Nome do perfil *">
                <input className="w-full" placeholder="Ex: Meu perfil principal" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
              </Field>
              <Field label="@ do Instagram">
                <input className="w-full" placeholder="@seuperfil" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value.replace('@','') }))}/>
              </Field>
            </div>
            <Field label="Nicho / Área de atuação" className="mb-4">
              <input className="w-full" placeholder="Ex: Marketing digital, Fitness, Imobiliário..." value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}/>
            </Field>
            <Field label="Público-alvo" className="mb-4">
              <textarea className="w-full h-20 resize-none" placeholder="Ex: Empreendedores iniciantes, Mulheres 25-40 anos..." value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}/>
            </Field>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Tom de voz">
                <div className="flex flex-wrap gap-2">
                  {TONES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, tone: t }))} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={form.tone === t ? { background: 'var(--grad)', color: '#000' } : { background: 'var(--bg3)', color: 'var(--muted)' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Tipo de conteúdo preferido">
                <div className="flex flex-wrap gap-2">
                  {CONTENT_TYPES.map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, contentType: t }))} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={form.contentType === t ? { background: 'var(--grad)', color: '#000' } : { background: 'var(--bg3)', color: 'var(--muted)' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Field label="Cor principal da marca">
                <div className="flex items-center gap-3">
                  <input type="color" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} className="w-10 h-10 rounded-lg cursor-pointer border-0" style={{ background: 'var(--bg3)' }}/>
                  <input className="flex-1" value={form.primaryColor} onChange={e => setForm(f => ({ ...f, primaryColor: e.target.value }))} placeholder="#E8421A"/>
                </div>
              </Field>
              <Field label="Foto de perfil (avatar)">
                <div className="flex items-center gap-2">
                  {form.logo && <img src={form.logo} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>}
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer"
                    style={{ background: 'var(--bg3)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                    {form.logo ? 'Trocar' : 'Enviar foto'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => setForm(f => ({ ...f, logo: ev.target?.result as string }))
                      reader.readAsDataURL(file)
                    }}/>
                  </label>
                </div>
              </Field>
              <Field label="Texto da marca (rodapé pequeno)">
                <input className="w-full" placeholder="Ex: Powered by Claude Viral" value={form.brandText || ''} onChange={e => setForm(f => ({ ...f, brandText: e.target.value }))}/>
              </Field>
              <Field label="Selo de verificado">
                <button type="button" onClick={() => setForm(f => ({ ...f, verifiedBadge: !f.verifiedBadge }))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg"
                  style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <span className="text-xs">{form.verifiedBadge ? 'Perfil verificado' : 'Sem selo'}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: form.verifiedBadge ? 'var(--grad)' : 'var(--bg2)', color: form.verifiedBadge ? '#000' : 'var(--muted)' }}>
                    {form.verifiedBadge ? 'Mostrando' : 'Escondido'}
                  </span>
                </button>
              </Field>
            </div>
            <Field label="Instruções extras (opcional)" className="mb-6">
              <textarea className="w-full h-20 resize-none" placeholder="Ex: Sempre use linguagem simples, mencione resultados práticos..." value={form.extraInstructions} onChange={e => setForm(f => ({ ...f, extraInstructions: e.target.value }))}/>
            </Field>
            <div className="flex gap-3">
              <button onClick={save} disabled={!form.name || saving} className="flex-1 py-3 rounded-xl font-semibold text-black disabled:opacity-50" style={{ background: 'var(--grad)' }}>
                {saving ? 'Salvando...' : editing ? 'Salvar alterações' : 'Criar perfil'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-6 py-3 rounded-xl font-semibold" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  )
}
