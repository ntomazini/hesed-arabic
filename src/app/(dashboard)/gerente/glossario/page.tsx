'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  BookOpen, Plus, Upload, Download, Search, Pencil,
  Trash2, Loader2, Globe, AlertTriangle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'

interface Term {
  id: string
  sourceLang: string
  targetLang: string
  sourceTerm: string
  targetTerm: string
  definition?: string | null
  domain?: string | null
  notes?: string | null
  forbidden: boolean
  createdAt: string
}

interface FormState {
  sourceLang: string; targetLang: string
  sourceTerm: string; targetTerm: string
  definition: string; domain: string; notes: string
  forbidden: boolean
}
const EMPTY_FORM: FormState = {
  sourceLang: 'en', targetLang: 'pt-BR',
  sourceTerm: '', targetTerm: '',
  definition: '', domain: '', notes: '', forbidden: false,
}

const LANG_PAIRS = [
  { src: 'en', tgt: 'pt-BR', label: 'EN → PT-BR' },
  { src: 'en', tgt: 'es', label: 'EN → ES' },
  { src: 'es', tgt: 'pt-BR', label: 'ES → PT-BR' },
  { src: 'pt-BR', tgt: 'en', label: 'PT-BR → EN' },
]

export default function GlossarioPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingTerm, setEditingTerm] = useState<Term | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [q, setQ] = useState('')
  const [langFilter, setLangFilter] = useState<string>('all')
  const [showImportModal, setShowImportModal] = useState(false)
  const [csvFile, setCsvFile] = useState<File | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['termbase', q, langFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (langFilter !== 'all') {
        const pair = LANG_PAIRS.find(p => `${p.src}_${p.tgt}` === langFilter)
        if (pair) { params.set('sourceLang', pair.src); params.set('targetLang', pair.tgt) }
      }
      const { data } = await api.get(`/api/termbase?${params}`)
      return data.terms as Term[]
    },
  })
  const terms = data ?? []

  const createMutation = useMutation({
    mutationFn: (body: FormState) => api.post('/api/termbase', {
      ...body,
      definition: body.definition || null,
      domain: body.domain || null,
      notes: body.notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termbase'] })
      closeModal()
      toast.success('Termo adicionado!')
    },
    onError: () => toast.error('Erro ao adicionar termo'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<FormState> }) =>
      api.patch(`/api/termbase/${id}`, {
        ...body,
        definition: body.definition || null,
        domain: body.domain || null,
        notes: body.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termbase'] })
      closeModal()
      toast.success('Termo atualizado!')
    },
    onError: () => toast.error('Erro ao atualizar termo'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/termbase/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['termbase'] })
      toast.success('Termo removido!')
    },
    onError: () => toast.error('Erro ao remover termo'),
  })

  function openCreate() { setEditingTerm(null); setForm(EMPTY_FORM); setShowModal(true) }
  function openEdit(t: Term) {
    setEditingTerm(t)
    setForm({
      sourceLang: t.sourceLang, targetLang: t.targetLang,
      sourceTerm: t.sourceTerm, targetTerm: t.targetTerm,
      definition: t.definition ?? '', domain: t.domain ?? '',
      notes: t.notes ?? '', forbidden: t.forbidden,
    })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditingTerm(null); setForm(EMPTY_FORM) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingTerm) {
      updateMutation.mutate({ id: editingTerm.id, body: form })
    } else {
      createMutation.mutate(form)
    }
  }

  function handleDelete(id: string) {
    if (!confirm('Remover este termo do glossário?')) return
    deleteMutation.mutate(id)
  }

  function exportCSV() {
    if (terms.length === 0) { toast.error('Nenhum termo para exportar'); return }
    const rows = [
      ['sourceLang', 'targetLang', 'sourceTerm', 'targetTerm', 'definition', 'domain', 'forbidden'],
      ...terms.map(t => [t.sourceLang, t.targetLang, t.sourceTerm, t.targetTerm, t.definition ?? '', t.domain ?? '', String(t.forbidden)]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'glossario-hesed.csv'; a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV exportado!')
  }

  async function handleCSVImport() {
    if (!csvFile) return
    const text = await csvFile.text()
    const lines = text.split('\n').filter(Boolean)
    // skip header row
    const dataLines = lines.slice(1)
    if (dataLines.length === 0) { toast.error('Arquivo vazio'); return }

    let success = 0
    let fail = 0
    for (const line of dataLines) {
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'))
      if (cols.length < 4) { fail++; continue }
      const [sourceLang, targetLang, sourceTerm, targetTerm, definition, domain] = cols
      if (!sourceLang || !targetLang || !sourceTerm || !targetTerm) { fail++; continue }
      try {
        await api.post('/api/termbase', { sourceLang, targetLang, sourceTerm, targetTerm, definition: definition || null, domain: domain || null })
        success++
      } catch { fail++ }
    }
    queryClient.invalidateQueries({ queryKey: ['termbase'] })
    setShowImportModal(false)
    setCsvFile(null)
    toast.success(`${success} termos importados${fail > 0 ? `, ${fail} ignorados` : ''}`)
  }

  const isBusy = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Glossário Teológico</h2>
          <p className="text-slate-500 text-sm mt-0.5">Termos padronizados destacados automaticamente no editor.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={exportCSV}>Exportar CSV</Button>
          <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => setShowImportModal(true)}>Importar CSV</Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Novo Termo</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input className="input-field pl-9" placeholder="Buscar termos..."
              value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="input-field w-44" value={langFilter} onChange={e => setLangFilter(e.target.value)}>
            <option value="all">Todos os pares</option>
            {LANG_PAIRS.map(p => (
              <option key={`${p.src}_${p.tgt}`} value={`${p.src}_${p.tgt}`}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : terms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <BookOpen className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">Nenhum termo encontrado</p>
            <button onClick={openCreate} className="mt-3 text-[#1e3a5f] text-sm font-medium hover:underline">Adicionar primeiro termo</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Termo Fonte</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Termo Alvo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Par</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Domínio</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Definição</th>
                  <th className="px-4 py-3 w-20" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {terms.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">{t.sourceTerm}</span>
                        {t.forbidden && (
                          <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="w-3 h-3" />Proibido
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{t.targetTerm}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {t.sourceLang.toUpperCase()} → {t.targetLang.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{t.domain ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-xs truncate">{t.definition ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(t)}
                          className="p-1.5 text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(t.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-slate-50 text-xs text-slate-400">
              {terms.length} termo{terms.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[#1e3a5f] rounded-t-2xl px-6 py-5 text-white flex items-center gap-3 sticky top-0">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{editingTerm ? 'Editar Termo' : 'Novo Termo'}</h3>
                <p className="text-blue-200 text-sm">{editingTerm ? editingTerm.sourceTerm : 'Adicionar ao glossário'}</p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Globe className="inline w-3.5 h-3.5 mr-1 opacity-60" />Idioma fonte
                  </label>
                  <select className="input-field" value={form.sourceLang}
                    onChange={e => setForm({ ...form, sourceLang: e.target.value })} disabled={!!editingTerm}>
                    <option value="en">EN</option>
                    <option value="pt-BR">PT-BR</option>
                    <option value="es">ES</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Globe className="inline w-3.5 h-3.5 mr-1 opacity-60" />Idioma alvo
                  </label>
                  <select className="input-field" value={form.targetLang}
                    onChange={e => setForm({ ...form, targetLang: e.target.value })} disabled={!!editingTerm}>
                    <option value="pt-BR">PT-BR</option>
                    <option value="en">EN</option>
                    <option value="es">ES</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Termo fonte *</label>
                  <input type="text" className="input-field" placeholder="Ex: Covenant"
                    value={form.sourceTerm} onChange={e => setForm({ ...form, sourceTerm: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Termo alvo *</label>
                  <input type="text" className="input-field" placeholder="Ex: Aliança"
                    value={form.targetTerm} onChange={e => setForm({ ...form, targetTerm: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Definição</label>
                <textarea className="input-field resize-none" rows={2}
                  placeholder="Definição teológica opcional..."
                  value={form.definition} onChange={e => setForm({ ...form, definition: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Domínio</label>
                  <input type="text" className="input-field" placeholder="Ex: Teologia, Bíblia"
                    value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Notas</label>
                  <input type="text" className="input-field" placeholder="Observações..."
                    value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" className="rounded border-slate-300 text-red-500"
                  checked={form.forbidden} onChange={e => setForm({ ...form, forbidden: e.target.checked })} />
                <span className="text-sm text-slate-700">
                  <span className="font-medium text-red-600">Termo proibido</span>
                  <span className="text-slate-400"> — alertar quando usado</span>
                </span>
              </label>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeModal} disabled={isBusy}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1" loading={isBusy}>
                  {editingTerm ? 'Salvar alterações' : 'Adicionar termo'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md p-6">
            <h3 className="font-bold text-slate-900 mb-1">Importar CSV</h3>
            <p className="text-sm text-slate-500 mb-4">
              O arquivo deve ter as colunas: <code className="bg-slate-100 px-1 rounded text-xs">sourceLang, targetLang, sourceTerm, targetTerm, definition, domain</code>
            </p>
            <input
              type="file" accept=".csv"
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#1e3a5f] file:text-white hover:file:bg-[#1e40af] cursor-pointer mb-4"
              onChange={e => setCsvFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowImportModal(false); setCsvFile(null) }}>Cancelar</Button>
              <Button variant="primary" className="flex-1" onClick={handleCSVImport} disabled={!csvFile}>Importar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
