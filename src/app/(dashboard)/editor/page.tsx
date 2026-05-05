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
  Clock,
  Edit3,
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
      { id: 'f1', name: 'Mateus_Cap01.txt', status: 'DONE', wordCount: 890, deadline: '2026-02-28' },
      { id: 'f2', name: 'Mateus_Cap02.txt', status: 'DONE', wordCount: 742, deadline: '2026-02-28' },
      { id: 'f3', name: 'Mateus_Cap03.txt', status: 'TRANSLATING', wordCount: 651, deadline: '2026-03-07' },
      { id: 'f4', name: 'Mateus_Cap04.txt', status: 'READY', wordCount: 820, deadline: '2026-03-14' },
      { id: 'f5', name: 'Mateus_Cap05.txt', status: 'READY', wordCount: 1240, deadline: '2026-03-21' },
    ],
  },
  {
    id: '2',
    name: 'Salmos — Edição Estudo',
    sourceLang: 'heb',
    targetLang: 'pt',
    files: [
      { id: 'f6', name: 'Salmo_001.txt', status: 'DONE', wordCount: 320, deadline: '2026-01-31' },
      { id: 'f7', name: 'Salmo_002.txt', status: 'DONE', wordCount: 280, deadline: '2026-01-31' },
      { id: 'f8', name: 'Salmo_003.txt', status: 'TRANSLATING', wordCount: 185, deadline: '2026-02-07' },
    ],
  },
  {
    id: '3',
    name: 'Epístolas de Paulo',
    sourceLang: 'grc',
    targetLang: 'pt',
    files: [
      { id: 'f9', name: 'Romanos_Cap01.txt', status: 'READY', wordCount: 980, deadline: '2026-04-30' },
      { id: 'f10', name: 'Romanos_Cap02.txt', status: 'READY', wordCount: 870, deadline: '2026-04-30' },
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
  const isDone = file.status === 'DONE'

  return (
    <div
      className={clsx(
        'flex items-center gap-4 px-5 py-3 rounded-lg border transition-colors',
        isDone
          ? 'bg-green-50/60 border-green-100'
          : 'bg-white border-slate-100 hover:border-slate-200'
      )}
    >
      <div className="flex-shrink-0">
        {isDone ? (
          <CheckCircle2 className="w-5 h-5 text-green-500" />
        ) : (
          <FileText className="w-5 h-5 text-slate-400" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            'text-sm font-medium truncate',
            isDone ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-900'
          )}
        >
          {file.name}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {file.wordCount.toLocaleString('pt-BR')} palavras &middot; Prazo: {formatDate(file.deadline)}
        </p>
      </div>

      <Badge variant={fileStatusToBadge(file.status)} />

      <Button
        variant={isDone ? 'ghost' : 'primary'}
        size="sm"
        icon={<Edit3 className="w-3.5 h-3.5" />}
        disabled={isDone}
      >
        {isDone ? 'Concluído' : 'Traduzir'}
      </Button>
    </div>
  )
}

function ProjectAccordion({ project }: { project: AssignedProject }) {
  const [open, setOpen] = useState(true)

  const doneCount = project.files.filter((f) => f.status === 'DONE').length
  const totalCount = project.files.length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Accordion header */}
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
          <div className="flex items-center gap-3">
            <h3 className="font-semibold text-slate-900">{project.name}</h3>
            <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded">
              {formatLang(project.sourceLang)} → {formatLang(project.targetLang)}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            {totalCount} arquivos &middot; {doneCount} concluídos
          </p>
        </div>

        {/* Progress pill */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-24 bg-slate-100 rounded-full h-1.5">
            <div
              className="h-1.5 bg-blue-500 rounded-full transition-all"
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

export default function EditorDashboard() {
  const { data: session } = useSession()

  const firstName = session?.user?.name?.split(' ')[0] ?? 'Editor'

  const { data: projects = mockProjects } = useQuery({
    queryKey: ['editor-projects'],
    queryFn: async () => {
      const { data } = await axios.get('/api/projects?role=editor')
      return data.projects as AssignedProject[]
    },
    initialData: mockProjects,
    retry: false,
  })

  const totalFiles = projects.reduce((acc, p) => acc + p.files.length, 0)
  const doneFiles = projects.reduce(
    (acc, p) => acc + p.files.filter((f) => f.status === 'DONE').length,
    0
  )
  const inProgressFiles = projects.reduce(
    (acc, p) => acc + p.files.filter((f) => f.status === 'TRANSLATING').length,
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
          Aqui estão os projetos atribuídos a você.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{totalFiles}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total de arquivos</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{inProgressFiles}</p>
          <p className="text-xs text-slate-500 mt-0.5">Em tradução</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{doneFiles}</p>
          <p className="text-xs text-slate-500 mt-0.5">Concluídos</p>
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
