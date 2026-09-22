'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Profile } from '@/types'
import { ArrowLeft, Plus, Trash2, Edit3, User, X, Sparkles, Loader2, ChevronDown } from 'lucide-react'
import BrandColorField from '@/components/BrandColorField'
import Sidebar from '@/components/Sidebar'
import MicDictateButton from '@/components/MicDictateButton'

const SELLS_OPTIONS = ['Infoproduto', 'Mentoria/Consultoria', 'Serviço', 'Produto físico', 'SaaS/Software', 'Outro']
const VOICE_PERSONALITY_OPTIONS = ['Direta', 'Didática', 'Provocativa', 'Energética', 'Sóbria', 'Acolhedora', 'Polêmica', 'Sarcástica', 'Inspiradora', 'Técnica']

const AWARENESS_OPTIONS = [
  { value: 'nao-sabe', label: 'Ainda não sabe que tem esse problema', tag: 'N1' },
  { value: 'sabe-problema', label: 'Sabe do problema, mas não conhece a solução', tag: 'N2' },
  { value: 'conhece-solucoes', label: 'Já conhece soluções, mas não a sua', tag: 'N3' },
  { value: 'conhece-voce', label: 'Já conhece você, mas ainda não decidiu', tag: 'N4' },
  { value: 'pronto', label: 'Já está pronto pra comprar', tag: 'N5' },
]

const FORMALITY_OPTIONS = [
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
]

const SOPHISTICATION_OPTIONS = [
  { value: 'primeira-vez', label: 'É a primeira vez que veem uma promessa assim', tag: 'S1' },
  { value: 'ja-viram', label: 'Já viram promessa parecida antes', tag: 'S2' },
  { value: 'ceticos', label: 'Estão desconfiados de promessas do tipo', tag: 'S3' },
  { value: 'so-mecanismo-novo', label: 'Só acreditam se o mecanismo for novo/diferente', tag: 'S4' },
  { value: 'so-prova', label: 'Só acreditam com prova concreta na mesa', tag: 'S5' },
]

const EMPTY: Omit<Profile, 'id' | 'createdAt'> = {
  name: '', instagram: '',
  niche: '', subniche: '', professionalOneLiner: '', audienceType: undefined,
  sells: [], audience: '', realProblem: '',
  desiredOutcome: '', emotionalDriver: '', awarenessLevel: '', marketSophistication: '',
  mechanism: '', promiseResult: '', promiseDeadline: '', promiseObjection: '',
  pastAttempts: [], lifeTransformation: '', proofBank: [],
  positioningBeliefs: [], coreValues: [], successDefinition: '', whatYouReject: '', shadowTrait: '',
  formality: undefined, voicePersonality: [], voiceReference: '', signaturePhrases: [], avoidWords: [],
  extraInstructions: '', primaryColor: '#E8421A', primaryColors: [], logo: undefined,
  brandText: '', brandTextVisible: true, brandPosition: 'tr', verifiedBadge: true, imageStyleReference: undefined,
}

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [editing, setEditing] = useState<Profile | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [openSection, setOpenSection] = useState('')

  // Preenchimento em massa — a pessoa conta tudo num texto livre e a IA distribui nos campos
  // certos, pra não precisar preencher um por um do zero
  const [bulkText, setBulkText] = useState('')
  const [bulkFilling, setBulkFilling] = useState(false)
  const [bulkError, setBulkError] = useState('')
  const [bulkFilledCount, setBulkFilledCount] = useState<number | null>(null)

  // "load" fica exposto pra recarregar depois de salvar (chamado de novo mais abaixo); a
  // busca inicial roda separada, com "ignore" pra não aplicar a resposta se o efeito já
  // tiver rodado de novo antes do fetch terminar.
  const load = useCallback(async () => {
    const data = await fetch('/api/profiles').then(r => r.json())
    setProfiles(data)
  }, [])

  useEffect(() => {
    let ignore = false
    fetch('/api/profiles').then(r => r.json()).then(data => { if (!ignore) setProfiles(data) })
    return () => { ignore = true }
  }, [])

  const openNew = () => {
    setEditing(null)
    setForm(EMPTY)
    setOpenSection('')
    setBulkText(''); setBulkError(''); setBulkFilledCount(null)
    setShowForm(true)
  }

  const bulkFill = async () => {
    if (!bulkText.trim()) return
    setBulkFilling(true)
    setBulkError('')
    setBulkFilledCount(null)
    try {
      const res = await fetch('/api/ai/profile-bulk-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: bulkText }),
      }).then(r => r.json())
      if (res.error) {
        setBulkError(res.error)
      } else {
        const parsed = res.profile as Record<string, unknown>
        let filled = 0
        setForm(f => {
          const next = { ...f } as Record<string, unknown>
          for (const key of Object.keys(parsed)) {
            const newVal = parsed[key]
            const curVal = next[key]
            const curEmpty = curVal === undefined || curVal === '' || (Array.isArray(curVal) && curVal.length === 0)
            const newHasValue = newVal !== undefined && newVal !== null && newVal !== '' && !(Array.isArray(newVal) && newVal.length === 0)
            if (curEmpty && newHasValue) {
              next[key] = newVal
              filled++
            }
          }
          return next as typeof f
        })
        setBulkFilledCount(filled)
      }
    } catch (e) {
      setBulkError(String(e))
    }
    setBulkFilling(false)
  }

  const openEdit = (p: Profile) => {
    setEditing(p)
    setForm({
      name: p.name, instagram: p.instagram,
      niche: p.niche, subniche: p.subniche || '', professionalOneLiner: p.professionalOneLiner || '', audienceType: p.audienceType,
      sells: p.sells || [], audience: p.audience, realProblem: p.realProblem || '',
      desiredOutcome: p.desiredOutcome || '', emotionalDriver: p.emotionalDriver || '', awarenessLevel: p.awarenessLevel || '', marketSophistication: p.marketSophistication || '',
      mechanism: p.mechanism || '', promiseResult: p.promiseResult || '', promiseDeadline: p.promiseDeadline || '', promiseObjection: p.promiseObjection || '',
      pastAttempts: p.pastAttempts || [], lifeTransformation: p.lifeTransformation || '', proofBank: p.proofBank || [],
      positioningBeliefs: p.positioningBeliefs || [], coreValues: p.coreValues || [], successDefinition: p.successDefinition || '', whatYouReject: p.whatYouReject || '', shadowTrait: p.shadowTrait || '',
      formality: p.formality, voicePersonality: p.voicePersonality || [], voiceReference: p.voiceReference || '', signaturePhrases: p.signaturePhrases || [], avoidWords: p.avoidWords || [],
      extraInstructions: p.extraInstructions, primaryColor: p.primaryColor, primaryColors: p.primaryColors || [], logo: p.logo,
      brandText: p.brandText, brandTextVisible: p.brandTextVisible !== false, brandPosition: p.brandPosition, verifiedBadge: p.verifiedBadge !== false,
      imageStyleReference: p.imageStyleReference,
    })
    setOpenSection('')
    setBulkText(''); setBulkError(''); setBulkFilledCount(null)
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
    <div className="h-screen overflow-hidden flex" style={{ background: 'var(--bo-paper)', color: 'var(--bo-ink)' }}>
      <Sidebar active="profiles"/>
      <main className="flex-1 overflow-auto p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/">
            <button className="p-2 rounded-xl hover:opacity-80 transition-opacity" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <ArrowLeft size={18}/>
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Perfis</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>A base de tudo: sua marca, seu nicho e o que te diferencia</p>
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
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-black flex-shrink-0 overflow-hidden" style={{ background: p.primaryColor }}>
                {p.logo ? <img src={p.logo} alt="" className="w-full h-full object-cover"/> : p.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-sm">{p.name}</p>
                  {p.instagram && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>@{p.instagram}</span>}
                </div>
                <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{p.niche} {p.mechanism ? `· ${p.mechanism}` : ''}</p>
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

            <div className="mb-6 p-4 rounded-xl" style={{ background: 'var(--bg3)' }}>
              <div className="flex items-center justify-between mb-2">
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--accent2)' }}>
                  <Sparkles size={12}/> Conta tudo de uma vez, a IA preenche os campos pra você
                </label>
                <MicDictateButton onTranscript={t => setBulkText(v => v ? `${v} ${t}` : t)}/>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                Não precisa preencher campo por campo — escreva (ou clica no microfone e fala) livremente sobre seu negócio, seu público, seu método, seu jeito de falar... a IA distribui isso nos campos certos. Depois é só revisar seção por seção e completar o que faltar.
              </p>
              <textarea className="w-full h-28 resize-none mb-2" placeholder="Ex: Sou fisioterapeuta há 12 anos, especialista em dor crônica. Atendo principalmente mulheres de 35-55 anos que já tentaram fisioterapia tradicional e não resolveram porque só tratam o sintoma, não a causa. Meu método chama Reset Postural..."
                value={bulkText} onChange={e => setBulkText(e.target.value)}/>
              <button type="button" onClick={bulkFill} disabled={bulkFilling || !bulkText.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)' }}>
                {bulkFilling ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Preencher tudo com IA
              </button>
              {bulkError && <p className="text-xs mt-2" style={{ color: '#ef4444' }}>{bulkError}</p>}
              {bulkFilledCount !== null && !bulkError && (
                <p className="text-xs mt-2" style={{ color: 'var(--accent2)' }}>
                  {bulkFilledCount > 0
                    ? `${bulkFilledCount} campo(s) preenchido(s). Abre cada seção abaixo pra revisar e completar o que faltou.`
                    : 'Não consegui inferir nada de novo com clareza — preencha manualmente ou dê mais detalhe.'}
                </p>
              )}
            </div>

            <AccordionSection title="Dados Básicos" sectionKey="Dados Básicos" open={openSection} onToggle={setOpenSection}
              summary={form.niche || form.name || 'Nome, nicho, o que vende, cliente ideal'}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="Nome do perfil *">
                  <input className="w-full" placeholder="Ex: Meu perfil principal" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
                </Field>
                <Field label="@ do Instagram">
                  <input className="w-full" placeholder="@seuperfil" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value.replace('@','') }))}/>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="Nicho / Área de atuação">
                  <input className="w-full" placeholder="Ex: Marketing digital, Fitness, Imobiliário..." value={form.niche} onChange={e => setForm(f => ({ ...f, niche: e.target.value }))}/>
                </Field>
                <Field label="Subnicho (opcional)">
                  <input className="w-full" placeholder="Ex: Marketing pra clínicas odontológicas" value={form.subniche || ''} onChange={e => setForm(f => ({ ...f, subniche: e.target.value }))}/>
                </Field>
              </div>
              <Field label="Quem você é profissionalmente" tag="afeta o tom e os exemplos" className="mb-4"
                assistField="professionalOneLiner" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, professionalOneLiner: v }))}>
                <input className="w-full" placeholder="Ex: Fisioterapeuta há 12 anos, especialista em dor crônica" value={form.professionalOneLiner || ''} onChange={e => setForm(f => ({ ...f, professionalOneLiner: e.target.value }))}/>
              </Field>
              <Field label="Você fala principalmente com..." className="mb-4">
                <div className="flex gap-2">
                  {[{ v: 'b2c', l: 'Pessoas (B2C)' }, { v: 'b2b', l: 'Empresas (B2B)' }, { v: 'mix', l: 'Os dois' }].map(o => (
                    <ToggleBtn key={o.v} active={form.audienceType === o.v} onClick={() => setForm(f => ({ ...f, audienceType: o.v as Profile['audienceType'] }))}>{o.l}</ToggleBtn>
                  ))}
                </div>
              </Field>
              <Field label="O que você vende" className="mb-4">
                <MultiSelect options={SELLS_OPTIONS} selected={form.sells || []} onChange={v => setForm(f => ({ ...f, sells: v }))}/>
              </Field>
              <Field label="Seu cliente ideal, em 1 linha" tag="ICP" className="mb-2"
                assistField="audience" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, audience: v }))}>
                <textarea className="w-full h-16 resize-none" placeholder="Ex: Mulheres de 30-45 anos, donas de negócio, sobrecarregadas e sem tempo pra cuidar da própria saúde" value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}/>
              </Field>
            </AccordionSection>

            <AccordionSection title="Diferencial" sectionKey="Diferencial" open={openSection} onToggle={setOpenSection}
              summary={form.mechanism || 'Real problema, mecanismo, promessa'}>
              <Field label="Por que seu público não resolve isso sozinho — qual é a causa real, não o sintoma?" tag="Real Problema" className="mb-4"
                assistField="realProblem" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, realProblem: v }))}>
                <textarea className="w-full h-16 resize-none" placeholder="Ex: todo mundo culpa 'falta de disciplina' pra quem não emagrece, mas a causa real costuma ser outra — qual é a versão disso no seu nicho?" value={form.realProblem || ''} onChange={e => setForm(f => ({ ...f, realProblem: e.target.value }))}/>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>Não precisa ser perfeito — se não souber de cara, clique em &quot;me ajuda&quot; que a IA sugere a partir do resto do perfil.</p>
              </Field>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="O que seu público deseja, no fundo?" tag="Desejo Universal"
                  assistField="desiredOutcome" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, desiredOutcome: v }))}>
                  <input className="w-full" placeholder="Ex: Se sentir no controle da própria vida" value={form.desiredOutcome || ''} onChange={e => setForm(f => ({ ...f, desiredOutcome: e.target.value }))}/>
                </Field>
                <Field label="Que emoção move essa decisão?" tag="Driver Emocional"
                  assistField="emotionalDriver" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, emotionalDriver: v }))}>
                  <input className="w-full" placeholder="Ex: Medo de ficar pra trás" value={form.emotionalDriver || ''} onChange={e => setForm(f => ({ ...f, emotionalDriver: e.target.value }))}/>
                </Field>
              </div>
              <Field label="Qual o nome do seu método ou jeito único de resolver isso?" tag="Mecanismo Único" className="mb-4"
                assistField="mechanism" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, mechanism: v }))}>
                <input className="w-full" placeholder="Ex: Método Reset Postural" value={form.mechanism || ''} onChange={e => setForm(f => ({ ...f, mechanism: e.target.value }))}/>
              </Field>
              <Field label="Sua promessa — o que o seu método entrega" tag="Promessa" className="mb-4"
                assistField="promiseResult" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, promiseResult: v }))}>
                <p className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>
                  Escreva como 1 promessa só, numa frase — o que a pessoa recebe, em quanto tempo, e mesmo que ela ache que X, sem separar em campos.
                </p>
                <textarea className="w-full h-20 resize-none" placeholder="Ex: Canal com crescimento orgânico e virando ativo de receita, com sinais de distribuição melhor em 1-2 meses de programação consistente — mesmo que ache que não tem tempo, equipamento ou talento pra câmera."
                  value={form.promiseResult || ''} onChange={e => setForm(f => ({ ...f, promiseResult: e.target.value }))}/>
              </Field>
              <Field label="O quanto seu público já entende sobre esse problema?" tag="Nível de Consciência" className="mb-4"
                assistField="awarenessLevel" assistProfile={form} assistChoices={AWARENESS_OPTIONS} onAssistPick={v => setForm(f => ({ ...f, awarenessLevel: v }))}>
                <div className="flex flex-col gap-2">
                  {AWARENESS_OPTIONS.map(o => (
                    <RadioRow key={o.value} active={form.awarenessLevel === o.value} tag={o.tag} label={o.label} onClick={() => setForm(f => ({ ...f, awarenessLevel: o.value }))}/>
                  ))}
                </div>
              </Field>
              <Field label="Quantas promessas parecidas com a sua seu público já viu?" tag="Nível de Sofisticação" className="mb-4"
                assistField="marketSophistication" assistProfile={form} assistChoices={SOPHISTICATION_OPTIONS} onAssistPick={v => setForm(f => ({ ...f, marketSophistication: v }))}>
                <div className="flex flex-col gap-2">
                  {SOPHISTICATION_OPTIONS.map(o => (
                    <RadioRow key={o.value} active={form.marketSophistication === o.value} tag={o.tag} label={o.label} onClick={() => setForm(f => ({ ...f, marketSophistication: o.value }))}/>
                  ))}
                </div>
              </Field>
              <Field label="O que seu público já tentou e não resolveu?" tag="Tentativas Frustradas" className="mb-4"
                assistField="pastAttempts" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, pastAttempts: [...(f.pastAttempts || []), v] }))}>
                <TagListInput values={form.pastAttempts || []} onChange={v => setForm(f => ({ ...f, pastAttempts: v }))} placeholder="Ex: Dieta restritiva — digite e aperte Enter"/>
              </Field>
              <Field label="Como a vida da pessoa muda depois?" tag="Transformação de Vida" className="mb-4"
                assistField="lifeTransformation" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, lifeTransformation: v }))}>
                <textarea className="w-full h-16 resize-none" placeholder="Ex: Deixa de adiar decisões por medo e passa a agir com clareza" value={form.lifeTransformation || ''} onChange={e => setForm(f => ({ ...f, lifeTransformation: e.target.value }))}/>
              </Field>
              <Field label="Provas concretas que você já tem" tag="Provas Reais" className="mb-2">
                <TagListInput values={form.proofBank || []} onChange={v => setForm(f => ({ ...f, proofBank: v }))} placeholder="Ex: Cliente X foi de 2 mil pra 20 mil seguidores em 4 meses — digite e aperte Enter"/>
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>Só o que você mesmo confirmar entra aqui — a IA nunca inventa nem sugere dado nesse campo.</p>
              </Field>
            </AccordionSection>

            <AccordionSection title="Posicionamento" sectionKey="Posicionamento" open={openSection} onToggle={setOpenSection}
              summary={form.positioningBeliefs?.length ? `${form.positioningBeliefs.length} crença(s) de posicionamento` : 'O que separa essa marca do resto do nicho'}>
              <Field label="O que você defende vs. o que o mercado ensina errado" tag="Crenças de Posicionamento" className="mb-4"
                assistField="positioningBeliefs" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, positioningBeliefs: [...(f.positioningBeliefs || []), v] }))}>
                <TagListInput values={form.positioningBeliefs || []} onChange={v => setForm(f => ({ ...f, positioningBeliefs: v }))} placeholder="Ex: Eu defendo vender 1 a 1 com estratégia — o mercado ensina só tentar viralizar. Digite e aperte Enter"/>
              </Field>
              <Field label="Valores inegociáveis (e como você vive isso na prática)" tag="Valores" className="mb-4"
                assistField="coreValues" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, coreValues: [...(f.coreValues || []), v] }))}>
                <TagListInput values={form.coreValues || []} onChange={v => setForm(f => ({ ...f, coreValues: v }))} placeholder="Ex: Transparência — mostro resultado real, nunca só print bonito. Digite e aperte Enter"/>
              </Field>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="O que é sucesso pra você" tag="Definição de Sucesso"
                  assistField="successDefinition" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, successDefinition: v }))}>
                  <input className="w-full" placeholder="Ex: Ter tempo livre pra família, não só faturamento" value={form.successDefinition || ''} onChange={e => setForm(f => ({ ...f, successDefinition: e.target.value }))}/>
                </Field>
                <Field label="O que você abomina no seu nicho" tag="Rejeição"
                  assistField="whatYouReject" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, whatYouReject: v }))}>
                  <input className="w-full" placeholder="Ex: Prometer resultado sem falar do esforço por trás" value={form.whatYouReject || ''} onChange={e => setForm(f => ({ ...f, whatYouReject: e.target.value }))}/>
                </Field>
              </div>
              <Field label="Sua 'sombra' — a imperfeição que você topa mostrar" tag="Sombra" className="mb-2"
                assistField="shadowTrait" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, shadowTrait: v }))}>
                <input className="w-full" placeholder="Ex: Já quebrei duas vezes antes de aprender a precificar" value={form.shadowTrait || ''} onChange={e => setForm(f => ({ ...f, shadowTrait: e.target.value }))}/>
              </Field>
            </AccordionSection>

            <AccordionSection title="Identidade" sectionKey="Identidade" open={openSection} onToggle={setOpenSection}
              summary={form.voicePersonality?.length ? form.voicePersonality.join(', ') : 'Personalidade, linguagem e visual da marca'}>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--accent2)' }}>Personalidade</p>
              <Field label="Formalidade" className="mb-4"
                assistField="formality" assistProfile={form} assistChoices={FORMALITY_OPTIONS} onAssistPick={v => setForm(f => ({ ...f, formality: v as Profile['formality'] }))}>
                <div className="flex gap-2">
                  <ToggleBtn active={form.formality === 'formal'} onClick={() => setForm(f => ({ ...f, formality: 'formal' }))}>Formal</ToggleBtn>
                  <ToggleBtn active={form.formality === 'informal'} onClick={() => setForm(f => ({ ...f, formality: 'informal' }))}>Informal</ToggleBtn>
                </div>
              </Field>
              <Field label="Personalidade" className="mb-4"
                assistField="voicePersonality" assistProfile={form}
                assistChoices={VOICE_PERSONALITY_OPTIONS.map(o => ({ value: o, label: o }))}
                onAssistPick={v => setForm(f => ({ ...f, voicePersonality: Array.from(new Set([...(f.voicePersonality || []), v])) }))}>
                <MultiSelect options={VOICE_PERSONALITY_OPTIONS} selected={form.voicePersonality || []} onChange={v => setForm(f => ({ ...f, voicePersonality: v }))}/>
              </Field>

              <p className="text-[11px] font-bold uppercase tracking-wider mb-3 mt-2" style={{ color: 'var(--accent2)' }}>Linguagem</p>
              <Field label="Se sua voz fosse um tipo de texto, qual seria?" tag="Espelho de Escrita" className="mb-4"
                assistField="voiceReference" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, voiceReference: v }))}>
                <input className="w-full" placeholder="Ex: Como uma newsletter direta de startup, como um médico explicando pro paciente" value={form.voiceReference || ''} onChange={e => setForm(f => ({ ...f, voiceReference: e.target.value }))}/>
              </Field>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <Field label="Palavras/frases que você costuma usar"
                  assistField="signaturePhrases" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, signaturePhrases: [...(f.signaturePhrases || []), v] }))}>
                  <TagListInput values={form.signaturePhrases || []} onChange={v => setForm(f => ({ ...f, signaturePhrases: v }))} placeholder="Digite e aperte Enter"/>
                </Field>
                <Field label="Palavras a evitar">
                  <TagListInput values={form.avoidWords || []} onChange={v => setForm(f => ({ ...f, avoidWords: v }))} placeholder="Digite e aperte Enter"/>
                </Field>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-wider mb-3 mt-2" style={{ color: 'var(--accent2)' }}>Visual</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <BrandColorField label="Cor principal da marca" color={form.primaryColor} colors={form.primaryColors || []}
                  onColorChange={c => setForm(f => ({ ...f, primaryColor: c }))}
                  onColorsChange={cs => setForm(f => ({ ...f, primaryColors: cs }))}/>
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
                  <input className="w-full mb-2" placeholder="Ex: Powered by Claude Viral" value={form.brandText || ''} onChange={e => setForm(f => ({ ...f, brandText: e.target.value }))}/>
                  <button type="button" onClick={() => setForm(f => ({ ...f, brandTextVisible: f.brandTextVisible === false }))}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <span className="text-xs">Mostrar esse rodapé nos carrosséis desse perfil</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: form.brandTextVisible === false ? 'var(--bg2)' : 'rgba(255,138,30,0.16)', color: form.brandTextVisible === false ? 'var(--muted)' : 'var(--accent2)' }}>
                      {form.brandTextVisible === false ? 'Não' : 'Sim'}
                    </span>
                  </button>
                  <p className="text-[10px] mt-1.5" style={{ color: 'var(--muted)' }}>
                    Vale como padrão pra todo carrossel novo desse perfil — continua ajustável carrossel a carrossel no editor.
                  </p>
                </Field>
                <Field label="Selo de verificado">
                  <button type="button" onClick={() => setForm(f => ({ ...f, verifiedBadge: !f.verifiedBadge }))}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                    <span className="text-xs">{form.verifiedBadge ? 'Perfil verificado' : 'Sem selo'}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: form.verifiedBadge ? 'rgba(255,138,30,0.16)' : 'var(--bg2)', color: form.verifiedBadge ? 'var(--accent2)' : 'var(--muted)' }}>
                      {form.verifiedBadge ? 'Mostrando' : 'Escondido'}
                    </span>
                  </button>
                </Field>
              </div>
              <Field label="Imagem de referência de estilo pra geração com IA (opcional)" className="mb-4">
                <p className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>
                  Uma foto que representa o visual que você quer nas imagens geradas (grade de cor, luz, clima). Anexada automaticamente em toda geração desse perfil — sem precisar colar imagem toda vez. Só tem efeito quando o provedor de imagem em Configurações é o Gemini.
                </p>
                <div className="flex items-center gap-2">
                  {form.imageStyleReference && <img src={form.imageStyleReference} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0"/>}
                  <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs cursor-pointer"
                    style={{ background: 'var(--bg3)', border: '1.5px dashed var(--border)', color: 'var(--muted)' }}>
                    {form.imageStyleReference ? 'Trocar referência' : 'Enviar imagem de referência'}
                    <input type="file" accept="image/*" className="hidden" onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => setForm(f => ({ ...f, imageStyleReference: ev.target?.result as string }))
                      reader.readAsDataURL(file)
                    }}/>
                  </label>
                  {form.imageStyleReference && (
                    <button type="button" onClick={() => setForm(f => ({ ...f, imageStyleReference: undefined }))}
                      className="px-3 py-2.5 rounded-lg text-xs" style={{ background: 'var(--bg3)', color: 'var(--muted)' }}>
                      Remover
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Instruções extras (opcional)" className="mb-2"
                assistField="extraInstructions" assistProfile={form} onAssistPick={v => setForm(f => ({ ...f, extraInstructions: v }))}>
                <textarea className="w-full h-20 resize-none" placeholder='Ex: Sempre use linguagem simples, mencione resultados práticos. Fechar todo carrossel pedindo pra comentar a palavra "GUIA".' value={form.extraInstructions} onChange={e => setForm(f => ({ ...f, extraInstructions: e.target.value }))}/>
              </Field>
            </AccordionSection>

            <div className="flex gap-3 mt-6">
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
      </main>
    </div>
  )
}

function AccordionSection({ title, sectionKey, open, onToggle, summary, children }: {
  title: string; sectionKey: string; open: string; onToggle: (key: string) => void; summary?: string; children: React.ReactNode
}) {
  const isOpen = open === sectionKey
  return (
    <div className="rounded-xl mb-3" style={{ border: '1px solid var(--border)' }}>
      <button type="button" onClick={() => onToggle(isOpen ? '' : sectionKey)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left rounded-xl"
        style={{ background: isOpen ? 'var(--bg3)' : 'var(--bg2)' }}>
        <div className="min-w-0">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--accent2)' }}>{title}</span>
          {!isOpen && summary && <p className="text-xs truncate mt-0.5" style={{ color: 'var(--muted)' }}>{summary}</p>}
        </div>
        <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ color: 'var(--muted)', transform: isOpen ? 'rotate(180deg)' : 'none' }}/>
      </button>
      {isOpen && <div className="p-4 pt-4 rounded-b-xl" style={{ background: 'var(--bg2)' }}>{children}</div>}
    </div>
  )
}

function Field({ label, tag, children, className = '', assistField, assistProfile, onAssistPick, assistChoices }: {
  label: string; tag?: string; children: React.ReactNode; className?: string
  assistField?: string; assistProfile?: Partial<Profile>; onAssistPick?: (text: string) => void
  assistChoices?: { value: string; label: string }[]
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-2 flex-wrap min-w-0 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
          {label}
          {tag && <span className="normal-case text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ background: 'var(--bg3)', color: 'var(--muted)', letterSpacing: 0 }}>{tag}</span>}
        </span>
        {assistField && onAssistPick && (
          <AssistButton field={assistField} profile={assistProfile || {}} onPick={onAssistPick} choices={assistChoices}/>
        )}
      </div>
      {children}
    </div>
  )
}

function AssistButton({ field, profile, onPick, choices }: { field: string; profile: Partial<Profile>; onPick: (text: string) => void; choices?: { value: string; label: string }[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [generated, setGenerated] = useState(false)

  const hasContext = Object.entries(profile).some(([k, v]) => k !== 'name' && k !== 'instagram' && k !== 'primaryColor' && v && (Array.isArray(v) ? v.length : true))

  const run = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/ai/profile-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, profile, hint, choices }),
      }).then(r => r.json())
      if (res.error) setError(res.error)
      else { setOptions(res.options || []); setGenerated(true) }
    } catch {
      setError('Não consegui gerar agora. Verifique o Claude/API em Configurações.')
    }
    setLoading(false)
  }

  return (
    <span className="relative normal-case flex-shrink-0" style={{ letterSpacing: 0 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap transition-opacity hover:opacity-80"
        style={{ background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)', border: '1px solid rgba(255,138,30,0.3)' }}>
        <Sparkles size={11}/> me ajuda
      </button>
      {open && (
        <div className="absolute z-30 top-full right-0 mt-1.5 w-80 p-3 rounded-xl shadow-xl" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          {!generated && (
            <>
              <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                {hasContext ? 'Vou usar o que já foi preenchido no perfil. Quer dar uma pista extra?' : 'Ainda não tem contexto suficiente no perfil — me dê uma pista rápida pra eu não chutar.'}
              </p>
              <textarea className="w-full h-16 resize-none text-xs mb-2" placeholder={hasContext ? 'Opcional...' : 'Ex: nicho de estética facial, público mulheres 30-45...'}
                value={hint} onChange={e => setHint(e.target.value)}/>
              {error && <p className="text-xs mb-2" style={{ color: '#ef4444' }}>{error}</p>}
              <button type="button" onClick={run} disabled={loading || (!hasContext && !hint.trim())}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: 'var(--grad)', color: '#000' }}>
                {loading ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} Gerar opções
              </button>
            </>
          )}
          {generated && (
            <>
              {options.map((o, i) => (
                <button key={i} type="button" onClick={() => { onPick(o); setOpen(false) }}
                  className="w-full text-left text-xs px-2.5 py-2 rounded-lg hover:opacity-80 mb-1.5" style={{ background: 'var(--bg3)' }}>
                  {choices?.find(c => c.value === o)?.label || o}
                </button>
              ))}
              <button type="button" onClick={() => { setGenerated(false); setOptions([]) }} className="w-full text-center text-[10px] px-2 py-1.5 rounded-lg" style={{ color: 'var(--muted)' }}>
                ← Gerar de novo
              </button>
            </>
          )}
        </div>
      )}
    </span>
  )
}

function ToggleBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={active ? { background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)', border: '1px solid var(--accent)' } : { background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid transparent' }}>
      {children}
    </button>
  )
}

function RadioRow({ active, tag, label, onClick }: { active: boolean; tag: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 text-left px-3 py-2 rounded-lg text-xs transition-colors"
      style={active ? { background: 'rgba(255,138,30,0.16)', color: 'var(--accent2)', border: '1px solid var(--accent)' } : { background: 'var(--bg3)', color: 'var(--muted)', border: '1px solid transparent' }}>
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0" style={{ background: 'var(--bg2)' }}>{tag}</span>
      <span>{label}</span>
    </button>
  )
}

function MultiSelect({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) => {
    onChange(selected.includes(o) ? selected.filter(s => s !== o) : [...selected, o])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <ToggleBtn key={o} active={selected.includes(o)} onClick={() => toggle(o)}>{o}</ToggleBtn>
      ))}
    </div>
  )
}

function TagListInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const v = draft.trim()
    if (!v) return
    onChange([...values, v])
    setDraft('')
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2 mb-2">
        {values.map((v, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ background: 'var(--bg3)', color: 'var(--bo-ink)' }}>
            {v}
            <button type="button" onClick={() => onChange(values.filter((_, idx) => idx !== i))} className="hover:opacity-70">
              <X size={11}/>
            </button>
          </span>
        ))}
      </div>
      <input className="w-full" placeholder={placeholder} value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        onBlur={add}/>
    </div>
  )
}
