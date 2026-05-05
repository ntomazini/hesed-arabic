'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  CheckCircle2,
  Lock,
  ClipboardCheck,
  FolderOpen,
} from 'lucide-react'
import Badge, { fileStatusToBadge } from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { clsx } from 'clsx'

interface ProjectFile {
  id: string
  name: string
  status: string
  wordCount: number
  deadline: string | null
  editorDone: boolean // true when editor finished (status DONE → available for revision)
}

interface AssignedProject {
  id: string
  name: string
  sourceLang: string
  targetLang: string
  files: ProjectFile[]
}

const mockProjects: AssignedProject[] = [
  {
    id: '1',
    name: 'Novo Testamento 2026',
    sourceLang: 'grc',
    targetLang: 'pt',
    files: [
      { id: 'f1', name: 'Mateus_Cap01.txt', status: 'DONE', wordCount: 890, deadline: '2026-02-28', editorDone: true },
      { id: 'f2', name: 'Mateus_Cap02.txt', status: 'DONE', wordCount: 742, deadline: '2026-02-28', editorDone: true },
      { id: 'f3', name: 'Mateus_Cap03.txt', status: 'TRANSLATING', wordCount: 651, deadline: '2026-03-07', editorDone: false },
      { id: 'f4', name: 'Mateus_Cap04.txt', status: 'READY', wordCount: 820, deadline: '2026-03-14', editorDone: false },
      { id: 'f5', name: 'Mateus_Cap05.txt', status: 'READY', wordCount: 1240, deadline: '2026-03-21', editorDone: false },
    ],
  },
  {
    id: '2',
    name: 'Salmos — Edição Estudo',
    sourceLang: 'heb',
    targetLang: 'pt',
    files: [
      { id: 'f6', name: 'Salmo_001.txt', status: 'REVIEWED', wordCount: 320, deadline: '2026-01-31', editorDone: true },
      { id: 'f7', name: 'Salmo_002.txt', status: 'DONE', wordCount: 280, deadline: '2026-01-31', editorDone: true },
      { id: 'f8', name: 'Salmo_003.txt', status: 'TRANSLATING', wordCount: 185, deadline: '2026-02-07', editorDone: false },
    ],
  },
  {
    id: '3',
    name: 'Epístolas de Paulo',
    sourceLang: 'grc',
    targetLang: 'pt',
    files: [
      { id: 'f9', name: 'Romanos_Cap01.txt', status: 'READY', wordCount: 980, deadline: '2026-04-30', editorDone: false },
      { id: 'f10', name: 'Romanos_Cap02.txt', status: 'READY', wordCount: 870, deadline: '2026-04-30', editorDone: false },
    ],
  },
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatLang(lang: string): string {
  const langs: Record<string, string> = { pt: 'PT', en: 'EN', grc: 'GRC', heb: 'HEB' }
  return langs[lang] ?? lang.toUpperCase()
}

function FileRow({ file }: { file: ProjectFile }) {
  const isReviewed = file.status === 'REVIEWED'
  const canReview = file.editorDone && !isReviewed
  const isBlocked = !file.editorDone && !isReviewed

  return (
    <div
      className={clsx(
        'flex items-center gap-4 px-5 py-3 rounded-lg border transition-colors',
        isReviewed
          ? 'bg-green-50/60 border-green-100'
          : isBlocked
          ? 'bg-slate-50 border-slate-100 opacity-70'
          : 'bg-white border-slate-100 hover:border-slate-200'
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isReviewed ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : isBlocked ? (
          <Lock className="w-5 h-5 text-slate-300" />
        ) : (
          <FileText className="w-5 h-5 text-orange-400" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            'text-sm font-medium truncate',
            isReviewed
              ? 'text-slate-400 line-through decoration-slate-300'
              : isBlocked
              ? 'text-slate-400'
              : 'text-slate-900'
          )}
        >
          {file.name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {file.wordCount.toLocaleString('pt-BR')} palavras &middot; Prazo: {formatDate(file.deadline)}
        </p>
      </div>

      {/* Badge */}
      <Badge variant={fileStatusToBadge(file.status)} />

      {/* Action */}
      {isBlocked ? (
        <div className="relative group">
          <Button variant="secondary" size="sm" disabled icon={<Lock className="w-3.5 h-3.5" />}>
            Revisar
          </Button>
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 w-48 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center z-10">
            Aguardando o editor finalizar
            <div className="absolute top-full right-4 w-2 h-2 bg-slate-800 rotate-45 -translate-y-1" />
          </div>
        </div>
      ) : isReviewed ? (
        <Button variant="ghost" size="sm" icon={<CheckCircle2 className="w-3.5 h-3.5 text-green-500" />} disabled>
          Revisado
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          icon={<ClipboardCheck className="w-3.5 h-3.5" />}
        >
          Revisar
        </Button>
      )}
    </div>
  )
}

function ProjectAccordion({ project }: { project: AssignedProject }) {
  const [open, setOpen] = useState(true)

  const reviewedCount = project.files.filter((f) => f.status === 'REVIEWED').length
  const availableCount = project.files.filter((f) => f.editorDone && f.status !== 'REVIEWED').length
  const blockedCount = project.files.filter((f) => !f.editorDone).length
  const totalCount = project.files.length
  const progress = totalCount > 0 ? Math.round((reviewedCount / totalCount) * 100) : 0

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/50 transition-colors text-left"
      >
        <div className="flex-shrink-0 text-slate-400">
          {open
            ? <ChevronDown className="w-5 h-5" />
            : <ChevronRight className="w-5 h-5" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-semibold text-slate-900">{project.name}</h3>
            <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
              {formatLang(project.sourceLang)} → {formatLang(project.targetLang)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {reviewedCount} revisados &middot; {availableCount} disponíveis &middot;{' '}
            {blockedCount} aguardando editor
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-24 bg-slate-100 rounded-full h-1.5">
            <div
              className="h-1.5 bg-green-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-600 w-8 text-right">{progress}%</span>
        </div>
      </button>

      {/* File list */}
      {open && (
        <div className="px-6 pb-5 space-y-2 border-t border-slate-50 pt-4">
          {project.files.map((file) => (
            <FileRow key={file.id} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RevisorDashboard() {
  const { data: session } = useSession()
  const firstName = session?.user?.name?.split(' ')[0] ?? 'Revisor'

  const { data: projects = mockProjects } = useQuery({
    queryKey: ['revisor-projects'],
    queryFn: async () => {
      const { data } = await axios.get('/api/projects?role=revisor')
      return data.projects as AssignedProject[]
    },
    initialData: mockProjects,
    retry: false,
  })

  const totalFiles = projects.reduce((acc, p) => acc + p.files.length, 0)
  const availableFiles = projects.reduce(
    (acc, p) => acc + p.files.filter((f) => f.editorDone && f.status !== 'REVIEWED').length,
    0
  )
  const reviewedFiles = projects.reduce(
    (acc, p) => acc + p.files.filter((f) => f.status === 'REVIEWED').length,
    0
  )
  const blockedFiles = projects.reduce(
    (acc, p) => acc + p.files.filter((f) => !f.editorDone).length,
    0
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Olá, {firstName}!
        </h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Aqui estão os arquivos atribuídos para sua revisão.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalFiles}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{availableFiles}</p>
          <p className="text-xs text-slate-500 mt-0.5">Disponíveis</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{reviewedFiles}</p>
          <p className="text-xs text-slate-500 mt-0.5">Revisados</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-400">{blockedFiles}</p>
          <p className="text-xs text-slate-500 mt-0.5">Aguardando editor</p>
        </div>
      </div>

      {/* Project list */}
      <div className="space-y-4">
        {projects.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center">
            <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">Nenhum projeto atribuído</p>
            <p className="text-slate-400 text-sm mt-1">
              Entre em contato com o gerente para receber atribuições.
            </p>
          </div>
        ) : (
          projects.map((project) => (
            <ProjectAccordion key={project.id} project={project} />
          ))
        )}
      </div>
    </div>
  )
}
