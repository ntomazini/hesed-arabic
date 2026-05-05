'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  ChevronDown, ChevronRight, FileText, CheckCircle2,
  Edit3, FolderOpen, Search, Loader2, Calendar, AlertCircle,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import Link from 'next/link'
import { clsx } from 'clsx'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProjectFile {
  id: string
  name: string
  originalName: string
  status: string
  wordCount: number
  totalSegments: number
  confirmedSegments: number
  deadline: string | null
}

interface AssignedProject {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  status: string
  files: ProjectFile[]
}

// Helper: return the editor URL for a file
function editorUrl(projectId: string, fileId: string) {
  return `/editor/projetos/${projectId}/arquivos/${fileId}`
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return '—'
  const date = new Date(d)
  const today = new Date()
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  if (diffDays < 0) return `⚠️ ${label} (atrasado)`
  if (diffDays <= 3) return `⏰ ${label} (${diffDays}d)`
  return label
}

function fileProgress(f: ProjectFile) {
  if (f.totalSegments === 0) return 0
  return Math.round((f.confirmedSegments / f.totalSegments) * 100)
}

// ── FileRow ────────────────────────────────────────────────────────────────────

function FileRow({ file, projectId }: { file: ProjectFile; projectId: string }) {
  const isDone = file.status === 'DONE' || file.status === 'TRANSLATED'
  const isActive = file.status === 'TRANSLATING'
  const progress = fileProgress(file)

  return (
    <div className={clsx(
      'flex items-center gap-4 px-5 py-3 rounded-lg border transition-colors',
      isDone
        ? 'bg-green-50/60 border-green-100'
        : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
    )}>
      <div className="shrink-0">
        {isDone
          ? <CheckCircle2 className="w-5 h-5 text-green-500" />
          : <FileText className="w-5 h-5 text-blue-400" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium truncate',
          isDone ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-900')}>
          {file.originalName ?? file.name}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
          <span>{file.wordCount.toLocaleString('pt-BR')} palavras</span>
          {file.totalSegments > 0 && (
            <span>{file.confirmedSegments}/{file.totalSegments} seg.</span>
          )}
          {file.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(file.deadline)}
            </span>
          )}
        </div>
        {file.totalSegments > 0 && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-[#1e3a5f] rounded-full transition-all"
                style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-slate-400 w-7 text-right">{progress}%</span>
          </div>
        )}
      </div>

      {isDone ? (
        <Button variant="ghost" size="sm" icon={<Edit3 className="w-3.5 h-3.5" />} disabled>
          Concluído
        </Button>
      ) : (
        <Link href={editorUrl(projectId, file.id)}>
          <Button variant={isActive ? 'primary' : 'secondary'} size="sm" icon={<Edit3 className="w-3.5 h-3.5" />}>
            {isActive ? 'Continuar' : 'Traduzir'}
          </Button>
        </Link>
      )}
    </div>
  )
}

// ── ProjectAccordion ───────────────────────────────────────────────────────────

function ProjectAccordion({ project }: { project: AssignedProject }) {
  const [open, setOpen] = useState(true)
  const done = project.files.filter(f => f.status === 'DONE' || f.status === 'TRANSLATED').length
  const total = project.files.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors text-left">
        <span className="shrink-0 text-slate-400">
          {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">{project.name}</h3>
            <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
              {project.sourceLang.toUpperCase()} → {project.targetLang.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{total} arquivo(s) · {done} concluído(s)</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 bg-slate-100 rounded-full h-1.5">
            <div className="h-1.5 bg-blue-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-semibold text-slate-600 w-8 text-right">{progress}%</span>
        </div>
      </button>
      {open && (
        <div className="px-6 pb-5 space-y-2 border-t border-slate-50 pt-4">
          {project.files.map(f => <FileRow key={f.id} file={f} projectId={project.id} />)}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ArquivosPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-files-editor'],
    queryFn: async () => {
      const { data } = await api.get('/api/my-files')
      return data as { projects: AssignedProject[]; stats: { totalFiles: number; inProgress: number; done: number; available: number } }
    },
    retry: false,
    refetchInterval: 60_000,
  })

  const projects = data?.projects ?? []
  const stats    = data?.stats ?? { totalFiles: 0, inProgress: 0, done: 0, available: 0 }

  const filtered = search
    ? projects.map(p => ({
        ...p,
        files: p.files.filter(f =>
          (f.originalName ?? f.name).toLowerCase().includes(search.toLowerCase())
        ),
      })).filter(p => p.files.length > 0)
    : projects

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Meus Arquivos</h2>
        <p className="text-slate-500 text-sm mt-0.5">Arquivos atribuídos para tradução.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.totalFiles}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total atribuídos</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          <p className="text-xs text-slate-500 mt-0.5">Em tradução</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.done}</p>
          <p className="text-xs text-slate-500 mt-0.5">Concluídos</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input-field pl-9" placeholder="Buscar arquivo..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
            <AlertCircle className="w-10 h-10 text-red-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">Erro ao carregar arquivos</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
            <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {search ? 'Nenhum arquivo encontrado' : 'Nenhum arquivo atribuído'}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {search ? 'Tente outro termo de busca.' : 'Entre em contato com o gerente para receber atribuições.'}
            </p>
          </div>
        ) : (
          filtered.map(p => <ProjectAccordion key={p.id} project={p} />)
        )}
      </div>
    </div>
  )
}
