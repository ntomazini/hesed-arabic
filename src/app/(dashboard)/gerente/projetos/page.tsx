'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  FolderOpen, Plus, Upload, Pencil, Archive, Loader2,
  Globe, Calendar, FileText, TrendingUp, Clock,
  CheckCircle2, ChevronRight, Trash2, AlertTriangle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { clsx } from 'clsx'
import Link from 'next/link'

type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED'

interface Project {
  id: string
  name: string
  description?: string | null
  sourceLang: string
  targetLang: string
  status: ProjectStatus
  deadline?: string | null
  manager: { id: string; name: string }
  fileCount: number
  wordCount: number
  translationProgress: number
  reviewProgress: number
  createdAt: string
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Rascunho', ACTIVE: 'Ativo', PAUSED: 'Pausado', COMPLETED: 'Concluído', ARCHIVED: 'Arquivado',
}
const STATUS_COLORS: Record<ProjectStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  ARCHIVED: 'bg-slate-100 text-slate-400',
}

const LANGUAGES = [
  { value: 'en', label: 'Inglês (EN)' },
  { value: 'pt-BR', label: 'Português BR (PT-BR)' },
  { value: 'es', label: 'Espanhol (ES)' },
  { value: 'ar', label: 'Árabe (AR)' },
]

interface FormState {
  name: string; description: string; sourceLang: string; targetLang: string; deadline: string
}
const EMPTY_FORM: FormState = { name: '', description: '', sourceLang: 'en', targetLang: 'pt-BR', deadline: '' }

export default function ProjetosPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingProject, setEditingProject]       = useState<Project | null>(null)
  const [form, setForm]                           = useState<FormState>(EMPTY_FORM)
  const [filterStatus, setFilterStatus]           = useState<ProjectStatus | 'TODOS'>('TODOS')
  const [deleteProjectId, setDeleteProjectId]     = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/api/projects')
      return data.projects as Project[]
    },
  })
  const projects = data ?? []

  const createMutation = useMutation({
    mutationFn: (body: FormState) => api.post('/api/projects', {
      name: body.name,
      description: body.description || undefined,
      sourceLang: body.sourceLang,
      targetLang: body.targetLang,
      deadline: body.deadline ? new Date(body.deadline + 'T12:00:00').toISOString() : null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      closeModal()
      toast.success('Projeto criado com sucesso!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao criar projeto'
      toast.error(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<FormState> & { status?: ProjectStatus } }) =>
      api.patch(`/api/projects/${id}`, {
        ...body,
        ...(body.deadline !== undefined
          ? { deadline: body.deadline ? new Date(body.deadline + 'T12:00:00').toISOString() : null }
          : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      closeModal()
      toast.success('Projeto atualizado!')
    },
    onError: () => toast.error('Erro ao atualizar projeto'),
  })

  function openCreate() { setEditingProject(null); setForm(EMPTY_FORM); setShowModal(true) }
  function openEdit(p: Project) {
    setEditingProject(p)
    setForm({
      name: p.name,
      description: p.description ?? '',
      sourceLang: p.sourceLang,
      targetLang: p.targetLang,
      deadline: p.deadline ? p.deadline.slice(0, 10) : '',
    })
    setShowModal(true)
  }
  function closeModal() { setShowModal(false); setEditingProject(null); setForm(EMPTY_FORM) }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, body: form })
    } else {
      createMutation.mutate(form)
    }
  }

  function handleArchive(id: string) {
    if (!confirm('Arquivar este projeto?')) return
    updateMutation.mutate({ id, body: { status: 'ARCHIVED' } })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setDeleteProjectId(null)
      toast.success('Projeto excluído permanentemente.')
    },
    onError: () => {
      toast.error('Erro ao excluir projeto.')
      setDeleteProjectId(null)
    },
  })

  const filtered = filterStatus === 'TODOS' ? projects : projects.filter(p => p.status === filterStatus)
  const isBusy = createMutation.isPending || updateMutation.isPending

  const stats = {
    total: projects.length,
    active: projects.filter(p => p.status === 'ACTIVE').length,
    completed: projects.filter(p => p.status === 'COMPLETED').length,
    draft: projects.filter(p => p.status === 'DRAFT').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Projetos</h2>
          <p className="text-slate-500 text-sm mt-0.5">Gerencie todos os projetos de tradução.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Upload className="w-4 h-4" />}>Importar</Button>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Novo Projeto</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-slate-700', bg: 'bg-slate-50', icon: FolderOpen },
          { label: 'Ativos', value: stats.active, color: 'text-green-700', bg: 'bg-green-50', icon: CheckCircle2 },
          { label: 'Concluídos', value: stats.completed, color: 'text-blue-700', bg: 'bg-blue-50', icon: TrendingUp },
          { label: 'Rascunhos', value: stats.draft, color: 'text-slate-500', bg: 'bg-slate-50', icon: Clock },
        ].map(s => (
          <div key={s.label} className={clsx('rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-3', s.bg)}>
            <s.icon className={clsx('w-5 h-5', s.color)} />
            <div>
              <p className={clsx('text-xl font-bold', s.color)}>{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['TODOS', 'DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={clsx('px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
              filterStatus === s ? 'bg-[#1e3a5f] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50')}>
            {s === 'TODOS' ? 'Todos' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
          <FolderOpen className="w-14 h-14 text-slate-200 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">
            {filterStatus !== 'TODOS' ? 'Nenhum projeto neste status' : 'Nenhum projeto ainda'}
          </h3>
          <p className="text-slate-400 text-sm mb-6 max-w-sm">
            Crie seu primeiro projeto para começar a gerenciar traduções, fazer upload de arquivos e atribuir tradutores.
          </p>
          <Button variant="primary" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Criar Projeto</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold text-slate-900 text-base truncate">{p.name}</h3>
                    <span className={clsx('px-2.5 py-0.5 rounded-full text-xs font-semibold', STATUS_COLORS[p.status])}>
                      {STATUS_LABELS[p.status]}
                    </span>
                  </div>
                  {p.description && (
                    <p className="text-slate-500 text-sm mt-1 line-clamp-1">{p.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5" />
                      {p.sourceLang.toUpperCase()} → {p.targetLang.toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />{p.fileCount} arquivo{p.fileCount !== 1 ? 's' : ''}
                    </span>
                    {p.wordCount > 0 && (
                      <span>{p.wordCount.toLocaleString('pt-BR')} palavras</span>
                    )}
                    {p.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(p.deadline).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 rounded-lg transition-colors" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {p.status !== 'ARCHIVED' && (
                    <button onClick={() => handleArchive(p.id)}
                      className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors" title="Arquivar">
                      <Archive className="w-4 h-4" />
                    </button>
                  )}
                  {/* Botão excluir com confirmação inline */}
                  {deleteProjectId === p.id ? (
                    <span className="flex items-center gap-1 ml-1">
                      <span className="text-xs text-red-600 font-medium">Excluir?</span>
                      <button
                        onClick={() => deleteMutation.mutate(p.id)}
                        disabled={deleteMutation.isPending}
                        className="px-2 py-1 bg-red-600 text-white text-xs font-semibold rounded-md hover:bg-red-700 transition-colors disabled:opacity-50">
                        {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Sim'}
                      </button>
                      <button
                        onClick={() => setDeleteProjectId(null)}
                        className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md hover:bg-slate-200 transition-colors">
                        Não
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setDeleteProjectId(p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Excluir projeto permanentemente">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <Link href={`/gerente/projetos/${p.id}`}
                    className="p-1.5 text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 rounded-lg transition-colors" title="Abrir projeto">
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {p.fileCount > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Tradução</span><span>{p.translationProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${p.translationProgress}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                      <span>Revisão</span><span>{p.reviewProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${p.reviewProgress}%` }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg">
            <div className="bg-[#1e3a5f] rounded-t-2xl px-6 py-5 text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">{editingProject ? 'Editar Projeto' : 'Novo Projeto'}</h3>
                <p className="text-blue-200 text-sm">
                  {editingProject ? editingProject.name : 'Preencha os dados do projeto'}
                </p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do projeto *</label>
                <input
                  type="text" className="input-field"
                  placeholder="Ex: Bíblia de Estudo — Comentários"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição</label>
                <textarea
                  className="input-field resize-none" rows={2}
                  placeholder="Descrição opcional do projeto"
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Globe className="inline w-3.5 h-3.5 mr-1 opacity-60" />Idioma fonte *
                  </label>
                  <select className="input-field" value={form.sourceLang}
                    onChange={e => setForm({ ...form, sourceLang: e.target.value })}>
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    <Globe className="inline w-3.5 h-3.5 mr-1 opacity-60" />Idioma alvo *
                  </label>
                  <select className="input-field" value={form.targetLang}
                    onChange={e => setForm({ ...form, targetLang: e.target.value })}>
                    {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  <Calendar className="inline w-3.5 h-3.5 mr-1 opacity-60" />Prazo (opcional)
                </label>
                <input
                  type="date" className="input-field"
                  value={form.deadline}
                  onChange={e => setForm({ ...form, deadline: e.target.value })}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={closeModal} disabled={isBusy}>Cancelar</Button>
                <Button type="submit" variant="primary" className="flex-1" loading={isBusy}>
                  {editingProject ? 'Salvar alterações' : 'Criar projeto'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
