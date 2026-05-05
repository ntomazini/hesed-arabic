'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  ChevronDown, ChevronRight, FileText, CheckCircle2,
  Lock, ClipboardCheck, FolderOpen, Search, Loader2,
  Calendar, AlertCircle,
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
  reviewedSegments: number
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

/** A file is available for review when the editor has finished (status TRANSLATED or REVIEWING/DONE) */
function canReview(file: ProjectFile) {
  return ['TRANSLATED', 'REVIEWING'].includes(file.status)
}

function isDone(file: ProjectFile) {
  return file.status === 'DONE'
}

function isBlocked(file: ProjectFile) {
  return !canReview(file) && !isDone(file)
}

// ── FileRow ────────────────────────────────────────────────────────────────────

function revisorUrl(projectId: string, fileId: string) {
  return `/revisor/projetos/${projectId}/arquivos/${fileId}`
}

function FileRow({ file, projectId }: { file: ProjectFile; projectId: string }) {
  const available = canReview(file)
  const done      = isDone(file)
  const blocked   = isBlocked(file)

  const progress = file.totalSegments > 0
    ? Math.round((file.reviewedSegments / file.totalSegments) * 100)
    : 0

  return (
    <div className={clsx(
      'flex items-center gap-4 px-5 py-3 rounded-lg border transition-colors',
      done    ? 'bg-green-50/60 border-green-100' :
      blocked ? 'bg-slate-50 border-slate-100 opacity-70' :
                'bg-white border-slate-100 hover:border-slate-200 hover:shadow-sm'
    )}>
      <div className="shrink-0">
        {done    ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
         blocked ? <Lock className="w-5 h-5 text-slate-300" /> :
                   <FileText className="w-5 h-5 text-orange-400" />}
      </div>

      <div className="flex-1 min-w-0">
        <p className={clsx('text-sm font-medium truncate',
          done ? 'text-slate-400 line-through' : blocked ? 'text-slate-400' : 'text-slate-900')}>
          {file.originalName ?? file.name}
        </p>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400 flex-wrap">
          <span>{file.wordCount.toLocaleString('pt-BR')} palavras</span>
          {file.totalSegments > 0 && (
            <span>{file.reviewedSegments}/{file.totalSegments} seg. revisados</span>
          )}
          {blocked && <span className="text-amber-500">Aguardando editor finalizar</span>}
          {file.deadline && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(file.deadline)}
            </span>
          )}
        </div>
        {file.totalSegments > 0 && available && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-slate-400 w-7 text-right">{progress}%</span>
          </div>
        )}
      </div>

      {blocked ? (
        <div className="relative group">
          <Button variant="secondary" size="sm" disabled icon={<Lock className="w-3.5 h-3.5" />}>
            Bloqueado
          </Button>
          <div className="absolute bottom-full right-0 mb-2 w-52 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center z-10">
            Disponível após o editor finalizar a tradução
          </div>
        </div>
      ) : done ? (
        <Button variant="ghost" size="sm" disabled icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}>
          Revisado
        </Button>
      ) : (
        <Link href={revisorUrl(projectId, file.id)}>
          <Button variant="primary" size="sm" icon={<ClipboardCheck className="w-3.5 h-3.5" />}>
            Revisar
          </Button>
        </Link>
      )}
    </div>
  )
}

// ── ProjectAccordion ───────────────────────────────────────────────────────────

function ProjectAccordion({ project }: { project: AssignedProject }) {
  const [open, setOpen] = useState(true)
  const total     = project.files.length
  const reviewed  = project.files.filter(f => isDone(f)).length
  const available = project.files.filter(f => canReview(f)).length
  const blocked   = project.files.filter(f => isBlocked(f)).length
  const progress  = total > 0 ? Math.round((reviewed / total) * 100) : 0

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
          <p className="text-xs text-slate-400 mt-0.5">
            {reviewed} revisados · {available} disponíveis · {blocked} aguardando editor
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 bg-slate-100 rounded-full h-1.5">
            <div className="h-1.5 bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
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

export default function RevisoesPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-files-revisor'],
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
        <h2 className="text-2xl font-bold text-slate-900">Revisões</h2>
        <p className="text-slate-500 text-sm mt-0.5">Arquivos disponíveis para revisão.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{stats.available}</p>
          <p className="text-xs text-slate-500 mt-0.5">Disponíveis para revisar</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.done}</p>
          <p className="text-xs text-slate-500 mt-0.5">Revisados</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-700">{projects.length}</p>
          <p className="text-xs text-slate-500 mt-0.5">Projetos</p>
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
            <p className="text-slate-500 text-sm">Erro ao carregar revisões</p>
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
