'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import {
  FolderOpen,
  PlayCircle,
  CheckCircle2,
  FileWarning,
  Plus,
  ChevronRight,
  MoreVertical,
  TrendingUp,
} from 'lucide-react'
import Badge, { projectStatusToBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { clsx } from 'clsx'

interface ProjectStats {
  total: number
  active: number
  completed: number
  pendingFiles: number
}

interface Project {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  status: string
  deadline: string | null
  translationProgress: number
  reviewProgress: number
  fileCount: number
  wordCount: number
}

// Mock data used when API is unavailable / loading
const mockStats: ProjectStats = {
  total: 12,
  active: 5,
  completed: 6,
  pendingFiles: 8,
}

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Novo Testamento 2026',
    sourceLang: 'grc',
    targetLang: 'pt',
    status: 'ACTIVE',
    deadline: '2026-06-30',
    translationProgress: 68,
    reviewProgress: 42,
    fileCount: 27,
    wordCount: 138420,
  },
  {
    id: '2',
    name: 'Salmos — Edição Estudo',
    sourceLang: 'heb',
    targetLang: 'pt',
    status: 'ACTIVE',
    deadline: '2026-03-15',
    translationProgress: 92,
    reviewProgress: 78,
    fileCount: 10,
    wordCount: 42800,
  },
  {
    id: '3',
    name: 'Provérbios Completo',
    sourceLang: 'heb',
    targetLang: 'pt',
    status: 'COMPLETED',
    deadline: '2025-12-31',
    translationProgress: 100,
    reviewProgress: 100,
    fileCount: 8,
    wordCount: 15600,
  },
  {
    id: '4',
    name: 'Epístolas de Paulo',
    sourceLang: 'grc',
    targetLang: 'pt',
    status: 'ACTIVE',
    deadline: '2026-09-01',
    translationProgress: 31,
    reviewProgress: 12,
    fileCount: 14,
    wordCount: 56200,
  },
  {
    id: '5',
    name: 'Evangelhos Sinóticos',
    sourceLang: 'grc',
    targetLang: 'pt',
    status: 'PAUSED',
    deadline: null,
    translationProgress: 55,
    reviewProgress: 35,
    fileCount: 12,
    wordCount: 89000,
  },
]

function ProgressBar({ value, color = 'blue' }: { value: number; color?: 'blue' | 'green' }) {
  return (
    <div className="w-full bg-slate-100 rounded-full h-1.5">
      <div
        className={clsx(
          'h-1.5 rounded-full transition-all',
          color === 'blue' ? 'bg-blue-500' : 'bg-green-500'
        )}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  )
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', color)}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{title}</p>
      </div>
    </div>
  )
}

interface FormState { name: string; description: string; sourceLang: string; targetLang: string; deadline: string }
const EMPTY_FORM: FormState = { name: '', description: '', sourceLang: 'en', targetLang: 'pt-BR', deadline: '' }

export default function GerenteDashboard() {
  const { data: session } = useSession()
  const queryClient = useQueryClient()
  const [showNewProject, setShowNewProject] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Gerente'

  const { data: projects = mockProjects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await api.get('/api/projects')
      return data.projects as Project[]
    },
    initialData: mockProjects,
    retry: false,
  })

  const stats: ProjectStats = {
    total: projects.length,
    active: projects.filter((p) => p.status === 'ACTIVE').length,
    completed: projects.filter((p) => p.status === 'COMPLETED').length,
    pendingFiles: projects.reduce((acc, p) => acc + (p.fileCount || 0), 0),
  }

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
      setShowNewProject(false)
      setForm(EMPTY_FORM)
      toast.success('Projeto criado com sucesso!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao criar projeto'
      toast.error(msg)
    },
  })

  function handleCreateProject(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate(form)
  }

  const getHour = () => new Date().getHours()
  const greeting =
    getHour() < 12 ? 'Bom dia' : getHour() < 18 ? 'Boa tarde' : 'Boa noite'

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  function formatLang(lang: string): string {
    const langs: Record<string, string> = {
      pt: 'PT',
      en: 'EN',
      es: 'ES',
      grc: 'GRC',
      heb: 'HEB',
    }
    return langs[lang] ?? lang.toUpperCase()
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            {greeting}, {firstName}!
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Aqui está o resumo da sua plataforma de tradução.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowNewProject(true)}
        >
          Novo Projeto
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Projetos"
          value={stats.total}
          icon={<FolderOpen className="w-6 h-6 text-blue-600" />}
          color="bg-blue-50"
        />
        <StatCard
          title="Em Andamento"
          value={stats.active}
          icon={<PlayCircle className="w-6 h-6 text-indigo-600" />}
          color="bg-indigo-50"
        />
        <StatCard
          title="Concluídos"
          value={stats.completed}
          icon={<CheckCircle2 className="w-6 h-6 text-green-600" />}
          color="bg-green-50"
        />
        <StatCard
          title="Arquivos Pendentes"
          value={stats.pendingFiles}
          icon={<FileWarning className="w-6 h-6 text-orange-600" />}
          color="bg-orange-50"
        />
      </div>

      {/* Projects table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            <h3 className="font-semibold text-slate-900">Projetos</h3>
          </div>
          <span className="text-xs text-slate-400">{projects.length} projetos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Projeto
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Idioma
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[140px]">
                  % Traduzido
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[140px]">
                  % Revisado
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Prazo
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {projects.map((project) => (
                <tr key={project.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{project.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {project.fileCount} arquivos &middot;{' '}
                        {project.wordCount.toLocaleString('pt-BR')} palavras
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-1 rounded">
                      {formatLang(project.sourceLang)} → {formatLang(project.targetLang)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">{project.translationProgress}%</span>
                      </div>
                      <ProgressBar value={project.translationProgress} color="blue" />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">{project.reviewProgress}%</span>
                      </div>
                      <ProgressBar value={project.reviewProgress} color="green" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-slate-600 text-sm">
                    {formatDate(project.deadline)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={projectStatusToBadge(project.status)} />
                  </td>
                  <td className="px-4 py-4">
                    <button className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Project Modal */}
      {showNewProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md">
            <div className="bg-[#1e3a5f] rounded-t-2xl px-6 py-5 text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">Novo Projeto</h3>
                <p className="text-blue-200 text-sm">Preencha os dados do projeto</p>
              </div>
            </div>
            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome do projeto *</label>
                <input type="text" className="input-field" placeholder="Ex: Evangelhos — Ed. 2026"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Idioma origem *</label>
                  <select className="input-field" value={form.sourceLang} onChange={e => setForm({ ...form, sourceLang: e.target.value })}>
                    <option value="grc">Grego (GRC)</option>
                    <option value="heb">Hebraico (HEB)</option>
                    <option value="en">Inglês (EN)</option>
                    <option value="es">Espanhol (ES)</option>
                    <option value="pt-BR">Português (PT-BR)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Idioma destino *</label>
                  <select className="input-field" value={form.targetLang} onChange={e => setForm({ ...form, targetLang: e.target.value })}>
                    <option value="pt-BR">Português (PT-BR)</option>
                    <option value="en">Inglês (EN)</option>
                    <option value="es">Espanhol (ES)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Prazo (opcional)</label>
                <input type="date" className="input-field" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (opcional)</label>
                <textarea className="input-field resize-none" rows={2} placeholder="Descreva o projeto..."
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" className="flex-1"
                  onClick={() => { setShowNewProject(false); setForm(EMPTY_FORM) }} disabled={createMutation.isPending}>
                  Cancelar
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={createMutation.isPending}>
                  Criar Projeto
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
