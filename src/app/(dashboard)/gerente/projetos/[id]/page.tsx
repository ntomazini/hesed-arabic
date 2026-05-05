'use client'

import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  ArrowLeft, Upload, FileText, Loader2, Trash2, CheckCircle2,
  Clock, AlertCircle, Eye, Users, Calendar, Globe, BarChart2,
  RefreshCw, File, UserCheck, Save, X, Brain, Download, BookOpen, Plus,
  ChevronDown, FileDown,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'
import { BIBLE_BOOKS } from '@/lib/aquifer'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserOption {
  id: string
  name: string
  role: string
  active: boolean
}

interface ProjectFile {
  id: string
  name: string
  originalName: string
  status: string
  wordCount: number
  charCount: number
  totalSegments: number
  translatedSegments: number
  confirmedSegments: number
  reviewedSegments: number
  sourceLang: string
  targetLang: string
  deadline: string | null
  createdAt: string
  editor: { id: string; name: string } | null
  revisor: { id: string; name: string } | null
  _count: { segments: number }
}

interface ProjectDetail {
  id: string
  name: string
  description: string | null
  sourceLang: string
  targetLang: string
  status: string
  deadline: string | null
  manager: { id: string; name: string }
  files: ProjectFile[]
  wordCount: number
  translationProgress: number
  reviewProgress: number
}

type TabType = 'arquivos' | 'atribuir' | 'glossario'

interface GlossaryTerm {
  id: string
  sourceTerm: string
  targetTerm: string
  notes: string | null
  createdAt: string
}

interface FileAssignment {
  editorId: string
  revisorId: string
  deadline: string
}

interface UploadProgressItem {
  name: string
  phase: 'waiting' | 'uploading' | 'pretranslating' | 'done' | 'error'
  segments?: number
  translated?: number
  errors?: number
  fromTM?: number
  fromAquifer?: number
  fromAI?: number
  errorMsg?: string
}

interface UploadProgressState {
  active: boolean
  items: UploadProgressItem[]
  current: number // índice do arquivo atual; === items.length quando tudo concluído
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  READY: 'Pronto', TRANSLATING: 'Em tradução', TRANSLATED: 'Traduzido',
  REVIEWING: 'Em revisão', DONE: 'Concluído', REJECTED: 'Rejeitado',
}
const STATUS_COLOR: Record<string, string> = {
  READY: 'bg-slate-100 text-slate-600', TRANSLATING: 'bg-blue-100 text-blue-700',
  TRANSLATED: 'bg-yellow-100 text-yellow-700', REVIEWING: 'bg-purple-100 text-purple-700',
  DONE: 'bg-green-100 text-green-700', REJECTED: 'bg-red-100 text-red-700',
}
const STATUS_ICON: Record<string, React.ReactNode> = {
  READY: <Clock className="w-3 h-3" />, TRANSLATING: <RefreshCw className="w-3 h-3" />,
  TRANSLATED: <CheckCircle2 className="w-3 h-3" />, REVIEWING: <Eye className="w-3 h-3" />,
  DONE: <CheckCircle2 className="w-3 h-3" />, REJECTED: <AlertCircle className="w-3 h-3" />,
}

function langLabel(code: string) {
  const map: Record<string, string> = {
    en: 'Inglês', 'pt-BR': 'Português BR', es: 'Espanhol', pt: 'Português', ar: 'Árabe',
  }
  return map[code] ?? code.toUpperCase()
}

function fileProgress(f: ProjectFile) {
  if (f.totalSegments === 0) return 0
  return Math.round((f.confirmedSegments / f.totalSegments) * 100)
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [tab, setTab] = useState<TabType>('arquivos')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({ active: false, items: [], current: -1 })
  const [uploadBookCode, setUploadBookCode] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [pretranslating, setPretranslating] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [assignments, setAssignments] = useState<Record<string, FileAssignment>>({})
  const [glossaryForm, setGlossaryForm] = useState({ sourceTerm: '', targetTerm: '', notes: '' })
  const [downloadMenu, setDownloadMenu] = useState<string | null>(null) // fileId with open menu

  // Fetch project
  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/projects/${id}`)
      return data.project as ProjectDetail
    },
    refetchInterval: 30_000,
  })

  // Fetch users (for assignment dropdowns)
  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data } = await api.get('/api/users')
      return data.users as UserOption[]
    },
    enabled: tab === 'atribuir',
  })

  const editors  = (usersData ?? []).filter(u => u.role === 'EDITOR' && u.active)
  const revisors = (usersData ?? []).filter(u => u.role === 'REVISOR' && u.active)

  // Glossário do projeto
  const { data: glossaryData } = useQuery({
    queryKey: ['project-glossary', id],
    queryFn: async () => {
      const { data } = await api.get(`/api/projects/${id}/glossary`)
      return data.terms as GlossaryTerm[]
    },
    enabled: tab === 'glossario',
  })
  const glossaryTerms = glossaryData ?? []

  const addTermMutation = useMutation({
    mutationFn: (body: { sourceTerm: string; targetTerm: string; notes?: string }) =>
      api.post(`/api/projects/${id}/glossary`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-glossary', id] })
      setGlossaryForm({ sourceTerm: '', targetTerm: '', notes: '' })
      toast.success('Termo adicionado!')
    },
    onError: () => toast.error('Erro ao adicionar termo'),
  })

  const deleteTermMutation = useMutation({
    mutationFn: (termId: string) => api.delete(`/api/projects/${id}/glossary/${termId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-glossary', id] })
      toast.success('Termo removido')
    },
  })

  // Pre-translate file
  async function handlePretranslate(fileId: string, fileName: string) {
    if (!confirm(`Pré-traduzir "${fileName}" com IA? Os segmentos pendentes receberão sugestões automáticas que o editor deverá revisar.`)) return
    setPretranslating(fileId)
    try {
      const { data } = await api.post(`/api/projects/${id}/files/${fileId}/pretranslate`, { provider: 'auto' })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      toast.success(data.message ?? `${data.translated} segmentos pré-traduzidos!`)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      toast.error(msg ?? 'Erro ao pré-traduzir. Verifique se DEEPL_API_KEY ou ANTHROPIC_API_KEY está configurado.')
    } finally {
      setPretranslating(null)
    }
  }


  // Delete file mutation
  const deleteMutation = useMutation({
    mutationFn: (fileId: string) => api.delete(`/api/projects/${id}/files/${fileId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      toast.success('Arquivo removido')
      setDeleteConfirm(null)
    },
    onError: () => toast.error('Erro ao remover arquivo'),
  })

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      const payload = Array.from(selectedFiles).map((fileId) => {
        const a = assignments[fileId] ?? {}
        return {
          fileId,
          editorId:  a.editorId  || null,
          revisorId: a.revisorId || null,
          deadline:  a.deadline  ? new Date(a.deadline + 'T12:00:00').toISOString() : null,
        }
      })
      const { data } = await api.post(`/api/projects/${id}/assign`, { assignments: payload })
      return data
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      toast.success(`✅ ${res.assigned} arquivo(s) atribuído(s) com sucesso!`)
      setSelectedFiles(new Set())
      setAssignments({})
      setTab('arquivos')
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? 'Erro ao atribuir')
    },
  })

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    e.target.value = ''
    setShowUploadModal(false)

    const items: UploadProgressItem[] = files.map(f => ({ name: f.name, phase: 'waiting' as const }))
    setUploadProgress({ active: true, items: [...items], current: 0 })

    for (let i = 0; i < files.length; i++) {
      // fase 1: upload + parse
      items[i] = { ...items[i], phase: 'uploading' }
      setUploadProgress({ active: true, items: [...items], current: i })

      let fileId: string | null = null

      try {
        const form = new FormData()
        form.append('file', files[i])
        if (uploadBookCode) form.append('bookCode', uploadBookCode)
        const { data: uploadData } = await api.post(`/api/projects/${id}/files`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        fileId = uploadData.file.id

        // fase 2: pré-tradução (síncrona — aguarda conclusão)
        items[i] = { ...items[i], phase: 'pretranslating', segments: uploadData.file.segmentsCreated }
        setUploadProgress({ active: true, items: [...items], current: i })

        const { data: ptData } = await api.post(
          `/api/projects/${id}/files/${fileId}/pretranslate`,
          { provider: 'auto' },
          { timeout: 0 }, // sem timeout no axios para arquivos grandes
        )

        items[i] = {
          ...items[i],
          phase: 'done',
          segments: uploadData.file.segmentsCreated,
          translated: ptData.translated ?? 0,
          errors:     ptData.errors     ?? 0,
          fromTM:     ptData.fromTM     ?? 0,
          fromAquifer: ptData.fromAquifer ?? 0,
          fromAI:     ptData.fromAI     ?? 0,
        }
        setUploadProgress({ active: true, items: [...items], current: i })

      } catch (err: unknown) {
        type AxiosLike = { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string; code?: string }
        const e = err as AxiosLike
        const serverMsg = e?.response?.data?.error ?? e?.response?.data?.message
        const status    = e?.response?.status ? ` (HTTP ${e.response.status})` : ''
        const netMsg    = e?.code === 'ECONNABORTED' ? 'Timeout de conexão'
                        : e?.message ?? 'Erro desconhecido'
        const msg = serverMsg ? `${serverMsg}${status}` : `${netMsg}${status}`
        items[i] = { ...items[i], phase: 'error', errorMsg: msg }
        setUploadProgress({ active: true, items: [...items], current: i })
      }
    }

    // concluído
    setUploadProgress({ active: true, items: [...items], current: files.length })
    queryClient.invalidateQueries({ queryKey: ['project', id] })
    setUploadBookCode('')
  }

  function toggleFileSelect(fileId: string) {
    setSelectedFiles(prev => {
      const next = new Set(prev)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }

  function toggleSelectAll() {
    if (!project) return
    if (selectedFiles.size === project.files.length) {
      setSelectedFiles(new Set())
    } else {
      setSelectedFiles(new Set(project.files.map(f => f.id)))
    }
  }

  function updateAssignment(fileId: string, key: keyof FileAssignment, value: string) {
    setAssignments(prev => ({
      ...prev,
      [fileId]: { ...(prev[fileId] ?? { editorId: '', revisorId: '', deadline: '' }), [key]: value },
    }))
  }

  // Quando o primeiro arquivo recebe editor/revisor, propaga para todos os outros
  function updateAssignmentCascade(fileId: string, key: keyof FileAssignment, value: string, idx: number) {
    if (idx === 0 && value && project) {
      setAssignments(prev => {
        const next = { ...prev }
        for (const f of project.files) {
          next[f.id] = { ...(prev[f.id] ?? { editorId: '', revisorId: '', deadline: '' }), [key]: value }
        }
        return next
      })
      setSelectedFiles(new Set(project.files.map(f => f.id)))
    } else {
      updateAssignment(fileId, key, value)
      setSelectedFiles(prev => { const s = new Set(prev); s.add(fileId); return s })
    }
  }

  // Pre-fill assignments from existing data when switching to "Atribuir" tab
  function initAssignments() {
    if (!project) return
    const init: Record<string, FileAssignment> = {}
    for (const f of project.files) {
      init[f.id] = {
        editorId:  f.editor?.id  ?? '',
        revisorId: f.revisor?.id ?? '',
        deadline:  f.deadline ? f.deadline.slice(0, 10) : '',
      }
    }
    setAssignments(init)
  }

  // ── Loading / Error States ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm">Projeto não encontrado</p>
        <Button variant="secondary" onClick={() => router.back()}>Voltar</Button>
      </div>
    )
  }

  const totalWords = project.files.reduce((a, f) => a + f.wordCount, 0)
  const totalSegs  = project.files.reduce((a, f) => a + f.totalSegments, 0)
  const doneFiles  = project.files.filter(f => f.status === 'DONE').length

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()}
          className="mt-1 p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{project.name}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              project.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
              project.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
              project.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
              'bg-slate-100 text-slate-600'}`}>
              {project.status}
            </span>
          </div>
          {project.description && (
            <p className="text-slate-500 text-sm mt-1">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />
              {langLabel(project.sourceLang)} → {langLabel(project.targetLang)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              Gerente: {project.manager.name}
            </span>
            {project.deadline && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Prazo: {new Date(project.deadline).toLocaleDateString('pt-BR')}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <input ref={fileInputRef} type="file"
            accept=".txt,.md,.markdown,.html,.htm,.xml,.docx,.xliff,.xlf"
            multiple
            className="hidden" onChange={handleFileSelect} />
          <Button variant="primary"
            icon={uploadProgress.active && uploadProgress.current < uploadProgress.items.length
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Upload className="w-4 h-4" />}
            onClick={() => setShowUploadModal(true)}
            disabled={uploadProgress.active && uploadProgress.current < uploadProgress.items.length}>
            {uploadProgress.active && uploadProgress.current < uploadProgress.items.length
              ? 'Processando...'
              : 'Upload Arquivo'}
          </Button>
        </div>
      </div>

      {/* Completed banner */}
      {project.status === 'COMPLETED' && (
        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          <div>
            <p className="font-semibold text-green-800">Projeto concluído!</p>
            <p className="text-sm text-green-600">Todos os arquivos foram traduzidos e revisados. Faça o download dos arquivos finalizados abaixo.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Arquivos',   value: project.files.length,        icon: <FileText className="w-4 h-4 text-blue-500" />,   sub: `${doneFiles} concluído(s)` },
          { label: 'Palavras',   value: totalWords.toLocaleString('pt-BR'), icon: <File className="w-4 h-4 text-purple-500" />, sub: 'total do projeto' },
          { label: 'Segmentos',  value: totalSegs.toLocaleString('pt-BR'),  icon: <BarChart2 className="w-4 h-4 text-indigo-500" />, sub: 'unidades de tradução' },
          { label: 'Progresso',  value: `${project.translationProgress}%`,  icon: <CheckCircle2 className="w-4 h-4 text-green-500" />, sub: `${project.reviewProgress}% revisado` },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">{s.label}</span>
              {s.icon}
            </div>
            <p className="text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: 'arquivos',  label: 'Arquivos',  icon: <FileText  className="w-4 h-4" /> },
          { key: 'atribuir',  label: 'Atribuir',  icon: <UserCheck className="w-4 h-4" /> },
          { key: 'glossario', label: 'Glossário', icon: <BookOpen  className="w-4 h-4" /> },
        ] as const).map(t => (
          <button key={t.key}
            onClick={() => { setTab(t.key); if (t.key === 'atribuir') initAssignments() }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-white text-[#1e3a5f] shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: ARQUIVOS ─────────────────────────────────────────────────────── */}
      {tab === 'arquivos' && (
        <>
          {/* Progress bars */}
          {totalSegs > 0 && (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Tradução</span><span>{project.translationProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#1e3a5f] rounded-full transition-all duration-500"
                    style={{ width: `${project.translationProgress}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Revisão</span><span>{project.reviewProgress}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${project.reviewProgress}%` }} />
                </div>
              </div>
            </div>
          )}

          {/* Files list */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Arquivos</h2>
              <span className="text-xs text-slate-400">{project.files.length} arquivo(s)</span>
            </div>

            {project.files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <Upload className="w-10 h-10 mb-3 opacity-30" />
                <h3 className="text-sm font-semibold text-slate-600 mb-1">Nenhum arquivo ainda</h3>
                <p className="text-xs text-center max-w-xs">
                  Faça upload de arquivos .txt, .md, .html, .xml ou .docx para começar.
                </p>
                <button onClick={() => fileInputRef.current?.click()}
                  className="mt-4 text-[#1e3a5f] text-sm font-semibold hover:underline flex items-center gap-1">
                  <Upload className="w-3.5 h-3.5" /> Fazer upload agora
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {project.files.map(file => {
                  const progress = fileProgress(file)
                  const isDeleting = deleteConfirm === file.id
                  return (
                    <div key={file.id} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800 text-sm truncate">{file.originalName}</span>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[file.status] ?? 'bg-slate-100 text-slate-600'}`}>
                              {STATUS_ICON[file.status]}
                              {STATUS_LABEL[file.status] ?? file.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                            <span>{file.totalSegments} seg.</span>
                            <span>{file.wordCount.toLocaleString('pt-BR')} palavras</span>
                            {file.editor  && <span className="text-blue-500">✏️ {file.editor.name}</span>}
                            {file.revisor && <span className="text-purple-500">👁️ {file.revisor.name}</span>}
                            {file.deadline && (
                              <span className="text-amber-500">📅 {new Date(file.deadline).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                          {file.totalSegments > 0 && (
                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-[#1e3a5f] rounded-full transition-all duration-500"
                                  style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-xs text-slate-400 w-8 text-right">{progress}%</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* Pre-translate button (only for untranslated files) */}
                          {(file.status === 'READY' || file.status === 'TRANSLATING') && (
                            <button
                              onClick={() => handlePretranslate(file.id, file.originalName)}
                              disabled={pretranslating === file.id}
                              className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Pré-traduzir com IA">
                              {pretranslating === file.id
                                ? <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                : <Brain className="w-4 h-4" />}
                            </button>
                          )}

                          {/* Download button with format menu */}
                          {(file.status === 'TRANSLATED' || file.status === 'REVIEWING' || file.status === 'DONE') && (
                            <div className="relative">
                              <button
                                onClick={() => setDownloadMenu(downloadMenu === file.id ? null : file.id)}
                                className="flex items-center gap-0.5 p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="Baixar arquivo traduzido">
                                <Download className="w-4 h-4" />
                                <ChevronDown className="w-3 h-3" />
                              </button>

                              {downloadMenu === file.id && (
                                <>
                                  <div className="fixed inset-0 z-10" onClick={() => setDownloadMenu(null)} />
                                  <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-100 z-20 overflow-hidden">
                                    <div className="px-3 py-2 border-b border-slate-50">
                                      <p className="text-xs font-semibold text-slate-500">Baixar como…</p>
                                    </div>
                                    {[
                                      {
                                        label: `Formato original (.${file.originalName.split('.').pop()?.toLowerCase()})`,
                                        format: '',
                                        desc: 'Mesmo formato do upload',
                                      },
                                      { label: 'Word (.docx)', format: 'docx', desc: 'Documento Microsoft Word' },
                                      { label: 'Texto (.txt)', format: 'txt',  desc: 'Texto simples, um parágrafo por linha' },
                                      { label: 'HTML (.html)', format: 'html', desc: 'Página web com tags <p>' },
                                      { label: 'Markdown (.md)', format: 'md', desc: 'Texto com formatação Markdown' },
                                    ].map(opt => (
                                      <a
                                        key={opt.format}
                                        href={`/api/projects/${id}/files/${file.id}/download${opt.format ? `?format=${opt.format}` : ''}`}
                                        download
                                        onClick={() => setDownloadMenu(null)}
                                        className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-slate-50 transition-colors group"
                                      >
                                        <FileDown className="w-4 h-4 text-slate-300 group-hover:text-green-500 mt-0.5 shrink-0" />
                                        <div>
                                          <p className="text-sm font-medium text-slate-700 group-hover:text-slate-900">{opt.label}</p>
                                          <p className="text-xs text-slate-400">{opt.desc}</p>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                          {isDeleting ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => deleteMutation.mutate(file.id)}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                                disabled={deleteMutation.isPending}>
                                Confirmar
                              </button>
                              <button onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300">
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(file.id)}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Upload hint */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
            <p className="font-semibold mb-1">📁 Formatos suportados</p>
            <p className="text-xs text-blue-600">
              <strong>.txt</strong> — linha por segmento &nbsp;·&nbsp;
              <strong>.md</strong> — parágrafo por segmento &nbsp;·&nbsp;
              <strong>.html / .xml</strong> — tag &lt;p&gt; por segmento &nbsp;·&nbsp;
              <strong>.docx</strong> — parágrafo por segmento
            </p>
          </div>
        </>
      )}

      {/* ── TAB: ATRIBUIR ─────────────────────────────────────────────────────── */}
      {tab === 'atribuir' && (
        <div className="space-y-4">
          {project.files.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-16 text-center">
              <Upload className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhum arquivo no projeto</p>
              <p className="text-slate-400 text-sm mt-1">Faça upload de arquivos primeiro para poder atribuir.</p>
            </div>
          ) : (
            <>
              {/* Select all + save bar */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 accent-[#1e3a5f]"
                    checked={selectedFiles.size === project.files.length && project.files.length > 0}
                    onChange={toggleSelectAll} />
                  <span className="text-sm font-medium text-slate-700">
                    {selectedFiles.size > 0
                      ? `${selectedFiles.size} arquivo(s) selecionado(s)`
                      : 'Selecionar todos'}
                  </span>
                </label>
                <div className="flex-1" />
                {selectedFiles.size > 0 && (
                  <>
                    <button onClick={() => setSelectedFiles(new Set())}
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> Limpar
                    </button>
                    <Button variant="primary" icon={<Save className="w-4 h-4" />}
                      onClick={() => assignMutation.mutate()}
                      loading={assignMutation.isPending}>
                      Salvar atribuições
                    </Button>
                  </>
                )}
              </div>

              {/* Info */}
              {editors.length === 0 && revisors.length === 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-700">
                  <strong>⚠️ Nenhum editor ou revisor ativo.</strong> Crie usuários com papel Editor ou Revisor em <a href="/gerente/usuarios" className="underline">Gerenciar Usuários</a> antes de fazer atribuições.
                </div>
              )}

              {/* File rows with assignment controls */}
              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="col-span-1" />
                  <div className="col-span-3">Arquivo</div>
                  <div className="col-span-3">Editor (Tradução)</div>
                  <div className="col-span-3">Revisor (Revisão)</div>
                  <div className="col-span-2">Prazo</div>
                </div>

                {project.files.map((file, idx) => {
                  const a = assignments[file.id] ?? { editorId: '', revisorId: '', deadline: '' }
                  const isSelected = selectedFiles.has(file.id)
                  return (
                    <div key={file.id}
                      className={`grid grid-cols-12 gap-3 px-5 py-3 items-center border-b border-slate-50 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}>
                      {/* Checkbox */}
                      <div className="col-span-1 flex justify-center">
                        <input type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 accent-[#1e3a5f]"
                          checked={isSelected}
                          onChange={() => toggleFileSelect(file.id)} />
                      </div>

                      {/* File name + status */}
                      <div className="col-span-3 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{file.originalName}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${STATUS_COLOR[file.status]}`}>
                            {STATUS_LABEL[file.status]}
                          </span>
                          <span className="text-xs text-slate-400">{file.wordCount} pal.</span>
                        </div>
                      </div>

                      {/* Editor selector */}
                      <div className="col-span-3">
                        <select
                          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                          value={a.editorId}
                          onChange={e => updateAssignmentCascade(file.id, 'editorId', e.target.value, idx)}>
                          <option value="">— sem editor —</option>
                          {editors.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        {idx === 0 && <p className="text-[10px] text-slate-400 mt-0.5 pl-0.5">Ao selecionar aqui, todos os arquivos herdam</p>}
                      </div>

                      {/* Revisor selector */}
                      <div className="col-span-3">
                        <select
                          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                          value={a.revisorId}
                          onChange={e => updateAssignmentCascade(file.id, 'revisorId', e.target.value, idx)}>
                          <option value="">— sem revisor —</option>
                          {revisors.map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        {idx === 0 && <p className="text-[10px] text-slate-400 mt-0.5 pl-0.5">Ao selecionar aqui, todos os arquivos herdam</p>}
                      </div>

                      {/* Deadline */}
                      <div className="col-span-2">
                        <input type="date"
                          className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                          value={a.deadline}
                          onChange={e => updateAssignmentCascade(file.id, 'deadline', e.target.value, idx)} />
                        {idx === 0 && <p className="text-[10px] text-slate-400 mt-0.5 pl-0.5">Ao selecionar aqui, todos os arquivos herdam</p>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Bottom save bar */}
              {selectedFiles.size > 0 && (
                <div className="flex items-center justify-between bg-[#1e3a5f] text-white rounded-xl px-5 py-3">
                  <span className="text-sm">{selectedFiles.size} arquivo(s) com atribuições pendentes</span>
                  <Button variant="secondary"
                    icon={<Save className="w-4 h-4" />}
                    onClick={() => assignMutation.mutate()}
                    loading={assignMutation.isPending}>
                    Confirmar atribuições
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
      {/* ── TAB: GLOSSÁRIO ────────────────────────────────────────────────────── */}
      {tab === 'glossario' && (
        <div className="space-y-4">
          {/* Formulário para adicionar termo */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#1e3a5f]" />
              Adicionar termo obrigatório
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Termo original</label>
                <input
                  type="text"
                  placeholder={`Ex: Mercy (${project.sourceLang})`}
                  value={glossaryForm.sourceTerm}
                  onChange={e => setGlossaryForm(f => ({ ...f, sourceTerm: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tradução aprovada</label>
                <input
                  type="text"
                  placeholder={`Ex: Misericórdia (${project.targetLang})`}
                  value={glossaryForm.targetTerm}
                  onChange={e => setGlossaryForm(f => ({ ...f, targetTerm: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Observações (opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Usar sempre com maiúscula"
                  value={glossaryForm.notes}
                  onChange={e => setGlossaryForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                disabled={!glossaryForm.sourceTerm.trim() || !glossaryForm.targetTerm.trim() || addTermMutation.isPending}
                onClick={() => addTermMutation.mutate({
                  sourceTerm: glossaryForm.sourceTerm,
                  targetTerm: glossaryForm.targetTerm,
                  notes: glossaryForm.notes || undefined,
                })}
                className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-medium rounded-lg hover:bg-[#162d4a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {addTermMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Plus className="w-4 h-4" />}
                Adicionar
              </button>
            </div>
          </div>

          {/* Lista de termos */}
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-800 text-sm">Termos do projeto</span>
              <span className="ml-auto text-xs text-slate-400">{glossaryTerms.length} termo(s)</span>
            </div>

            {glossaryTerms.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum termo cadastrado ainda.</p>
                <p className="text-xs mt-1">Os termos aparecerão como sugestões obrigatórias no editor CAT.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Termo original', 'Tradução aprovada', 'Observações', ''].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {glossaryTerms.map((t, idx) => (
                    <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                      <td className="px-5 py-3 font-semibold text-slate-800">{t.sourceTerm}</td>
                      <td className="px-5 py-3 text-[#1e3a5f] font-medium">{t.targetTerm}</td>
                      <td className="px-5 py-3 text-slate-400 text-xs">{t.notes ?? '—'}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => deleteTermMutation.mutate(t.id)}
                          disabled={deleteTermMutation.isPending}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>

    {/* ── Modal de Progresso de Upload ─────────────────────────────────────────── */}
    {uploadProgress.active && (() => {
      const isDone      = uploadProgress.current >= uploadProgress.items.length
      const successItems = uploadProgress.items.filter(i => i.phase === 'done')
      const errorItems   = uploadProgress.items.filter(i => i.phase === 'error')
      const doneCount   = successItems.length + errorItems.length
      const total       = uploadProgress.items.length
      const pct         = total > 0 ? Math.round((doneCount / total) * 100) : 0
      const cur         = uploadProgress.items[uploadProgress.current]

      return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4 max-h-[90vh]">

            {/* cabeçalho */}
            <div className="flex items-center justify-between shrink-0">
              {isDone ? (
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  {errorItems.length === 0
                    ? <CheckCircle2 className="w-5 h-5 text-green-500" />
                    : <AlertCircle  className="w-5 h-5 text-amber-500" />}
                  {errorItems.length === 0 ? 'Processamento concluído!' : 'Concluído com erros'}
                </h2>
              ) : (
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#1e3a5f]" />
                  Processando arquivos…
                </h2>
              )}
              {isDone && (
                <button
                  onClick={() => setUploadProgress({ active: false, items: [], current: -1 })}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* barra de progresso geral */}
            <div className="shrink-0">
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>{doneCount} de {total} arquivo(s) processado(s)</span>
                <span>{pct}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: isDone && errorItems.length > 0
                      ? 'linear-gradient(90deg, #1e3a5f, #f59e0b)'
                      : '#1e3a5f',
                  }} />
              </div>
            </div>

            {/* resumo final — só aparece quando isDone */}
            {isDone && (
              <div className="shrink-0 grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{successItems.length}</p>
                  <p className="text-xs text-green-600 mt-0.5">arquivo(s) com sucesso</p>
                </div>
                <div className={`border rounded-xl px-4 py-3 text-center ${
                  errorItems.length > 0
                    ? 'bg-red-50 border-red-100'
                    : 'bg-slate-50 border-slate-100'
                }`}>
                  <p className={`text-2xl font-bold ${errorItems.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {errorItems.length}
                  </p>
                  <p className={`text-xs mt-0.5 ${errorItems.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                    arquivo(s) com erro
                  </p>
                </div>
              </div>
            )}

            {/* painel de erros — destaque quando isDone e há erros */}
            {isDone && errorItems.length > 0 && (
              <div className="shrink-0 bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Arquivos que precisam ser enviados novamente:
                </p>
                {errorItems.map((item, idx) => (
                  <div key={idx} className="bg-white border border-red-100 rounded-lg px-3 py-2">
                    <p className="text-sm font-medium text-red-700 truncate">{item.name}</p>
                    <p className="text-xs text-red-500 mt-0.5 break-words">{item.errorMsg ?? 'Erro desconhecido'}</p>
                  </div>
                ))}
              </div>
            )}

            {/* arquivo atual em andamento */}
            {!isDone && cur && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 shrink-0">
                <p className="text-sm font-semibold text-blue-800 truncate">
                  {cur.phase === 'uploading' ? '📤' : '🤖'} {cur.name}
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {cur.phase === 'uploading'
                    ? 'Enviando e processando arquivo…'
                    : `Pré-traduzindo${cur.segments ? ` ${cur.segments} segmentos` : ''}… aguarde, pode demorar alguns minutos`}
                </p>
              </div>
            )}

            {/* lista completa de arquivos */}
            <div className="overflow-y-auto flex-1 space-y-1.5 pr-1">
              {uploadProgress.items.map((item, idx) => (
                <div key={idx} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                  item.phase === 'error'
                    ? 'bg-red-50 border-red-100'
                    : idx === uploadProgress.current && !isDone
                      ? 'bg-blue-50 border-blue-100'
                      : 'bg-slate-50 border-transparent'
                }`}>
                  <div className="mt-0.5 shrink-0">
                    {item.phase === 'waiting'       && <Clock       className="w-4 h-4 text-slate-300" />}
                    {(item.phase === 'uploading' || item.phase === 'pretranslating') &&
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                    {item.phase === 'done'  && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {item.phase === 'error' && <AlertCircle  className="w-4 h-4 text-red-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      item.phase === 'error' ? 'text-red-700' : 'text-slate-700'
                    }`}>{item.name}</p>
                    {item.phase === 'waiting'       && <p className="text-xs text-slate-400">Na fila…</p>}
                    {item.phase === 'uploading'     && <p className="text-xs text-blue-500">Enviando…</p>}
                    {item.phase === 'pretranslating' && (
                      <p className="text-xs text-blue-500">
                        Pré-traduzindo{item.segments ? ` (${item.segments} seg.)` : ''}…
                      </p>
                    )}
                    {item.phase === 'done' && (
                      <p className="text-xs text-green-600">
                        ✓ {item.translated}/{item.segments} traduzidos
                        {(item.fromTM      ?? 0) > 0 && ` · ${item.fromTM} TM`}
                        {(item.fromAquifer ?? 0) > 0 && ` · ${item.fromAquifer} Aquifer`}
                        {(item.fromAI     ?? 0) > 0 && ` · ${item.fromAI} IA`}
                        {(item.errors     ?? 0) > 0 && ` · ⚠️ ${item.errors} seg. com erro`}
                      </p>
                    )}
                    {item.phase === 'error' && (
                      <p className="text-xs text-red-500 break-words mt-0.5">{item.errorMsg ?? 'Erro desconhecido'}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* rodapé */}
            {isDone ? (
              <button
                onClick={() => setUploadProgress({ active: false, items: [], current: -1 })}
                className="shrink-0 w-full py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#162d4a] transition-colors">
                Fechar{errorItems.length > 0 ? ' (reenvie os arquivos com erro acima)' : ''}
              </button>
            ) : (
              <div className="shrink-0 bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5">
                <p className="text-xs text-amber-700 font-medium">
                  ⚠️ Não feche esta janela até o processamento ser concluído.
                </p>
              </div>
            )}
          </div>
        </div>
      )
    })()}

    {/* ── Modal de Upload ─────────────────────────────────────────────────────── */}
    {showUploadModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) setShowUploadModal(false) }}>
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">

          {/* Título */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-[#1e3a5f]" />
              Upload de Arquivo
            </h2>
            <button onClick={() => setShowUploadModal(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Seletor de livro bíblico */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Livro Bíblico <span className="text-slate-400 font-normal">(opcional — melhora a pré-tradução via Aquifer)</span>
            </label>
            <select
              value={uploadBookCode}
              onChange={e => setUploadBookCode(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f] bg-white">
              <option value="">— Nenhum / Conteúdo genérico —</option>
              <optgroup label="Antigo Testamento">
                {BIBLE_BOOKS.filter(b => b.testament === 'AT').map(b => (
                  <option key={b.code} value={b.code}>{b.pt} ({b.code})</option>
                ))}
              </optgroup>
              <optgroup label="Novo Testamento">
                {BIBLE_BOOKS.filter(b => b.testament === 'NT').map(b => (
                  <option key={b.code} value={b.code}>{b.pt} ({b.code})</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Info sobre pré-tradução */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Pré-tradução automática será iniciada após o upload:</p>
            <p>1️⃣ Memória de Tradução (TM) — correspondências exatas</p>
            <p>2️⃣ Aquifer — banco de dados bíblico traduzido {uploadBookCode ? `(${BIBLE_BOOKS.find(b => b.code === uploadBookCode)?.pt ?? uploadBookCode})` : '(requer livro selecionado)'}</p>
            <p>3️⃣ IA — DeepL → Claude (para o restante)</p>
            <p className="text-blue-500 mt-1">O tradutor só precisará revisar e confirmar.</p>
          </div>

          {/* Botões */}
          <div className="flex gap-3">
            <button onClick={() => setShowUploadModal(false)}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancelar
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#162d4a] transition-colors flex items-center justify-center gap-2">
              <Upload className="w-4 h-4" />
              Selecionar Arquivo(s)
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
