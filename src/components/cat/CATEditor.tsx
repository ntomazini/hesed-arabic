'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import TagEditorField, { type TagEditorHandle } from '@/components/cat/TagEditorField'
import {
  ArrowLeft, CheckCircle2, CheckCheck, Circle, ChevronRight,
  Loader2, BookOpen, Zap, Flag, MessageSquare,
  ChevronDown, AlertTriangle, ThumbsUp, ThumbsDown,
  SkipForward, Check, X, ShieldAlert, History, RotateCcw, Download,
  MessageCircle, Send, CheckSquare,
  Columns2, Rows3, AlignJustify,
} from 'lucide-react'

type ViewMode = 'split' | 'stacked' | 'compact'

// ── Types ──────────────────────────────────────────────────────────────────────

export type EditorMode = 'editor' | 'revisor'

interface Segment {
  id: string
  order: number
  sourceText: string
  targetText: string | null
  tagMap: string | null
  status: string
  wordCount: number
  flagged: boolean
  note: string | null
  tmScore?: number | null
  translationSource?: string | null
}

interface FileInfo {
  id: string
  name: string
  originalName: string
  sourceLang: string
  targetLang: string
  totalSegments: number
  confirmedSegments: number
  reviewedSegments: number
  status: string
  project: { id: string; name: string; sourceLang: string; targetLang: string }
}

interface CommentItem {
  id: string
  content: string
  resolved: boolean
  createdAt: string
  author: { id: string; name: string; role: string }
}

interface TmMatch {
  id: string
  sourceText: string
  targetText: string
  score: number
  domain: string | null
}

interface TbTerm {
  id: string
  sourceTerm: string
  targetTerm: string
  definition: string | null
  domain: string | null
  forbidden: boolean
}

interface PgTerm {
  id: string
  sourceTerm: string
  targetTerm: string
  notes: string | null
}

interface HistoryEntry {
  id: string
  targetText: string | null
  status: string
  authorName: string | null
  authorRole: string | null
  createdAt: string
}

interface QAIssue {
  segmentId: string
  segmentOrder: number
  type: 'PLACEHOLDER' | 'NUMBER' | 'PUNCTUATION' | 'GLOSSARY'
  severity: 'error' | 'warning'
  message: string
  detail: string
}

function SourceBadge({ source, tmScore }: { source?: string | null; tmScore?: number | null }) {
  if (!source) return null
  const map: Record<string, { label: string; title: string; cls: string }> = {
    TM:      { label: '◈ TM',      title: `Memória de Tradução${tmScore ? ` (${tmScore}%)` : ''}`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    AQUIFER: { label: '◈ Aquifer', title: 'Base bíblica Aquifer',                                  cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    DEEPL:   { label: '◈ DeepL',  title: 'Traduzido por DeepL',                                    cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    CLAUDE:  { label: '◈ Claude', title: 'Traduzido por Claude (Anthropic)',                        cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    OPENAI:  { label: '◈ GPT',    title: 'Traduzido por OpenAI',                                    cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  }
  const b = map[source]
  if (!b) return null
  return (
    <span title={b.title} className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border select-none ${b.cls}`}>
      {b.label}
    </span>
  )
}


// ── Word-level diff ────────────────────────────────────────────────────────────

type DiffToken = { type: 'same' | 'del' | 'add'; text: string }

function wordDiff(oldText: string, newText: string): DiffToken[] {
  const a = oldText.split(/(\s+)/)
  const b = newText.split(/(\s+)/)
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1])
  const result: DiffToken[] = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
      result.unshift({ type: 'same', text: a[i-1] }); i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      result.unshift({ type: 'add', text: b[j-1] }); j--
    } else {
      result.unshift({ type: 'del', text: a[i-1] }); i--
    }
  }
  return result
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1)  return 'agora'
  if (min < 60) return `${min}min atrás`
  const h = Math.floor(min / 60)
  if (h < 24)   return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score === 100) return 'bg-green-100 text-green-700 border-green-200'
  if (score >= 85)  return 'bg-yellow-100 text-yellow-700 border-yellow-200'
  return 'bg-slate-100 text-slate-600 border-slate-200'
}

function statusIcon(status: string, size = 'w-4 h-4') {
  switch (status) {
    case 'CONFIRMED': return <CheckCircle2 className={`${size} text-blue-500`} />
    case 'REVIEWED':  return <CheckCheck   className={`${size} text-green-600`} />
    case 'REJECTED':  return <AlertTriangle className={`${size} text-red-400`} />
    case 'TRANSLATING': return <ChevronRight className={`${size} text-blue-400`} />
    default:          return <Circle       className={`${size} text-slate-300`} />
  }
}

function langLabel(code: string): string {
  const map: Record<string, string> = {
    en: 'EN', 'pt-BR': 'PT-BR', es: 'ES', pt: 'PT', ar: 'AR',
  }
  return map[code] ?? code.toUpperCase()
}

// ── Inline tag rendering ───────────────────────────────────────────────────────

// Renders {1}word{/1} placeholders as visual chips inside source text
function renderWithTags(text: string): React.ReactNode {
  const parts = text.split(/(\{\/?\d+\})/g)
  return (
    <>
      {parts.map((part, i) => {
        const openM  = /^\{(\d+)\}$/.exec(part)
        const closeM = /^\{\/(\d+)\}$/.exec(part)
        if (openM)
          return <span key={i} className="inline-flex items-center bg-amber-100 text-amber-800 border border-amber-300 rounded px-1 mx-0.5 text-[10px] font-mono font-bold leading-tight select-none cursor-default" title={`Tag de abertura ${openM[1]}`}>{openM[1]}▸</span>
        if (closeM)
          return <span key={i} className="inline-flex items-center bg-amber-100 text-amber-800 border border-amber-300 rounded px-1 mx-0.5 text-[10px] font-mono font-bold leading-tight select-none cursor-default" title={`Tag de fechamento ${closeM[1]}`}>◂{closeM[1]}</span>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface Props {
  projectId: string
  fileId: string
  mode: EditorMode
}

export default function CATEditor({ projectId, fileId, mode }: Props) {
  const router = useRouter()

  // Core state
  const [fileInfo, setFileInfo]       = useState<FileInfo | null>(null)
  const [segments, setSegments]       = useState<Segment[]>([])
  const [loading, setLoading]         = useState(true)
  const [activeId, setActiveId]       = useState<string | null>(null)
  const [translations, setTranslations] = useState<Record<string, string>>({})
  const [saving, setSaving]           = useState<Set<string>>(new Set())
  const [activePanel, setActivePanel] = useState<'tm' | 'tb' | null>(null)
  const [viewMode, setViewMode]       = useState<ViewMode>('split')
  const [tmMatches, setTmMatches]     = useState<TmMatch[]>([])
  const [tbTerms, setTbTerms]         = useState<TbTerm[]>([])
  const [pgTerms, setPgTerms]         = useState<PgTerm[]>([])
  const [sidebarLoading, setSidebarLoading] = useState(false)
  const [noteModal, setNoteModal]     = useState<string | null>(null) // segmentId
  const [noteText, setNoteText]       = useState('')
  const [finishing, setFinishing]     = useState(false)
  const [qaLoading, setQaLoading]     = useState(false)
  const [qaIssues, setQaIssues]       = useState<QAIssue[]>([])
  const [showQaModal, setShowQaModal] = useState(false)
  const [ignoredQaKeys, setIgnoredQaKeys] = useState<Set<string>>(new Set())
  const [showFinishConfirm, setShowFinishConfirm] = useState(false)
  const [historySegId, setHistorySegId]   = useState<string | null>(null)
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  // Comentários por segmento
  const [commentPanel, setCommentPanel]   = useState<string | null>(null) // segmentId
  const [comments, setComments]           = useState<CommentItem[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [newComment, setNewComment]       = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({}) // segmentId → count

  const activeTextareaRef = useRef<HTMLTextAreaElement>(null)
  const activeEditorRef   = useRef<TagEditorHandle>(null)
  const activeRowRef      = useRef<HTMLDivElement>(null)

  // Insert a tag token — works for both plain textarea and TagEditorField
  const insertTagAtCursor = useCallback((token: string) => {
    if (!activeId) return
    // TagEditorField (contenteditable) path
    if (activeEditorRef.current) {
      activeEditorRef.current.insertToken(token)
      return
    }
    // Plain textarea path
    const ta = activeTextareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const val   = translations[activeId] ?? ''
    setTranslations(prev => ({ ...prev, [activeId]: val.substring(0, start) + token + val.substring(end) }))
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + token.length
      ta.focus()
    })
  }, [activeId, translations])

  // ── Load file + segments ──────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get(
          `/api/projects/${projectId}/files/${fileId}?limit=200`
        )
        setFileInfo(data.file)
        setSegments(data.segments)
        // Pre-fill translations map from existing targetText
        const init: Record<string, string> = {}
        for (const s of data.segments as Segment[]) {
          init[s.id] = s.targetText ?? ''
        }
        setTranslations(init)
        // Auto-activate first non-confirmed segment
        const first = (data.segments as Segment[]).find(s =>
          mode === 'revisor'
            ? s.status === 'CONFIRMED'
            : s.status === 'PENDING' || s.status === 'TRANSLATING'
        )
        if (first) setActiveId(first.id)
      } catch (e) {
        toast.error('Erro ao carregar segmentos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [projectId, fileId, mode])

  // ── Polling: atualiza segmentos enquanto pré-tradução está em andamento ────
  // O arquivo fica em status TRANSLATING enquanto a IA processa em background.
  // A cada 4s busca os segmentos novos e preenche as traduções que chegaram.

  useEffect(() => {
    if (!fileInfo) return
    // Só faz polling se há segmentos ainda PENDING
    const hasPending = segments.some(s => s.status === 'PENDING')
    if (!hasPending) return

    const interval = setInterval(async () => {
      try {
        const { data } = await api.get(
          `/api/projects/${projectId}/files/${fileId}?limit=200`
        )
        const updated = data.segments as Segment[]

        // Atualiza traduções só para quem ganhou targetText agora
        setTranslations(prev => {
          const next = { ...prev }
          let changed = false
          for (const s of updated) {
            if (s.targetText && !prev[s.id]) {
              next[s.id] = s.targetText
              changed = true
            }
          }
          return changed ? next : prev
        })

        // Atualiza status dos segmentos
        setSegments(prev => prev.map(old => {
          const u = updated.find(x => x.id === old.id)
          return u ?? old
        }))

        // Para o polling quando não sobrar PENDING
        if (!updated.some(s => s.status === 'PENDING')) {
          clearInterval(interval)
        }
      } catch { /* ignora erros de polling */ }
    }, 4000)

    return () => clearInterval(interval)
  }, [fileInfo, segments, projectId, fileId])

  // ── Fetch TM + TB on active change ────────────────────────────────────────

  useEffect(() => {
    if (!activeId || !fileInfo) return
    const seg = segments.find(s => s.id === activeId)
    if (!seg) return

    setSidebarLoading(true)
    setTmMatches([])
    setTbTerms([])
    setPgTerms([])

    const srcLang = fileInfo.project.sourceLang
    const tgtLang = fileInfo.project.targetLang
    const encodedText = encodeURIComponent(seg.sourceText)

    Promise.all([
      api.get(`/api/tm/match?text=${encodedText}&srcLang=${srcLang}&tgtLang=${tgtLang}`),
      api.get(`/api/termbase/match?text=${encodedText}&srcLang=${srcLang}&tgtLang=${tgtLang}`),
      api.get(`/api/projects/${projectId}/glossary/match?text=${encodedText}`),
    ])
      .then(([tmRes, tbRes, pgRes]) => {
        setTmMatches(tmRes.data.matches ?? [])
        setTbTerms(tbRes.data.terms ?? [])
        setPgTerms(pgRes.data.terms ?? [])
      })
      .catch(() => {})
      .finally(() => setSidebarLoading(false))
  }, [activeId, fileInfo])

  // ── Focus textarea when segment activated ────────────────────────────────

  useEffect(() => {
    if (activeId) {
      activeEditorRef.current?.focus() ?? activeTextareaRef.current?.focus()
      // Scroll the active row into view
      activeRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeId])

  // ── Confirm segment ───────────────────────────────────────────────────────

  const confirmSegment = useCallback(async (segId: string) => {
    const text = translations[segId] ?? ''
    if (!text.trim() && mode === 'editor') {
      toast.error('Digite a tradução antes de confirmar')
      return
    }

    setSaving(prev => new Set(prev).add(segId))
    try {
      const newStatus = mode === 'revisor' ? 'REVIEWED' : 'CONFIRMED'
      const res = await api.patch(`/api/segments/${segId}`, {
        targetText: mode === 'editor' ? text : undefined,
        status: newStatus,
      })

      // Update local state for confirmed segment
      setSegments(prev => prev.map(s =>
        s.id === segId
          ? { ...s, targetText: mode === 'editor' ? text : s.targetText, status: newStatus }
          : s
      ))
      // Remove QA issues for this segment (user just fixed it)
      setQaIssues(prev => prev.filter(i => i.segmentId !== segId))

      // Auto-propagação: update identical segments propagated by the API
      const propagatedIds: string[] = res.data.propagatedIds ?? []
      const propagatedCount: number = res.data.propagated ?? 0
      if (propagatedIds.length > 0) {
        setSegments(prev => prev.map(s =>
          propagatedIds.includes(s.id)
            ? { ...s, targetText: text, status: 'CONFIRMED' }
            : s
        ))
        setTranslations(prev => {
          const next = { ...prev }
          for (const id of propagatedIds) next[id] = text
          return next
        })
        toast.success(`${propagatedCount} segmento${propagatedCount > 1 ? 's' : ''} idêntico${propagatedCount > 1 ? 's' : ''} propagado${propagatedCount > 1 ? 's' : ''} automaticamente`)
      }

      // Advance to next non-processed segment
      const currentSegments = segments.map(s =>
        propagatedIds.includes(s.id) ? { ...s, status: 'CONFIRMED' } : s
      )
      const idx = currentSegments.findIndex(s => s.id === segId)
      const next = currentSegments.slice(idx + 1).find(s =>
        mode === 'revisor'
          ? s.status === 'CONFIRMED'
          : s.status === 'PENDING' || s.status === 'TRANSLATING'
      )
      if (next) {
        setActiveId(next.id)
      } else {
        // Verificar se todos os segmentos estão realmente confirmados
        const updatedSegs = segments.map(s =>
          s.id === segId ? { ...s, status: newStatus } :
          propagatedIds.includes(s.id) ? { ...s, status: 'CONFIRMED' } : s
        )
        const allDone = mode === 'revisor'
          ? updatedSegs.every(s => s.status === 'REVIEWED' || s.status === 'REJECTED')
          : updatedSegs.every(s => s.status === 'CONFIRMED' || s.status === 'REVIEWED')

        if (allDone) {
          // Mostrar confirmação antes de finalizar
          setActiveId(null)
          setShowFinishConfirm(true)
        } else {
          // Ainda há segmentos não confirmados — voltar ao primeiro
          const firstPending = updatedSegs.find(s =>
            mode === 'revisor'
              ? s.status === 'CONFIRMED'
              : s.status === 'PENDING' || s.status === 'TRANSLATING'
          )
          if (firstPending) {
            setActiveId(firstPending.id)
            toast('Há segmentos anteriores ainda não confirmados', { icon: '⚠️' })
          } else {
            setActiveId(null)
          }
        }
      }
    } catch {
      toast.error('Erro ao salvar segmento')
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(segId); return n })
    }
  }, [translations, segments, mode])

  // ── Reject segment (revisor only) ─────────────────────────────────────────

  const rejectSegment = useCallback(async (segId: string) => {
    setSaving(prev => new Set(prev).add(segId))
    try {
      await api.patch(`/api/segments/${segId}`, { status: 'REJECTED' })
      setSegments(prev => prev.map(s =>
        s.id === segId ? { ...s, status: 'REJECTED' } : s
      ))
      toast.success('Segmento rejeitado — o editor será notificado')
      // Advance
      const idx = segments.findIndex(s => s.id === segId)
      const next = segments.slice(idx + 1).find(s => s.status === 'CONFIRMED')
      if (next) setActiveId(next.id)
    } catch {
      toast.error('Erro ao rejeitar')
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(segId); return n })
    }
  }, [segments])

  // ── Open history modal ────────────────────────────────────────────────────

  // ── Funções de comentário ────────────────────────────────────────────────────

  const openCommentPanel = useCallback(async (segId: string) => {
    setCommentPanel(segId)
    setComments([])
    setNewComment('')
    setCommentsLoading(true)
    try {
      const { data } = await api.get(`/api/segments/${segId}/comments`)
      setComments(data.comments ?? [])
      // atualiza o contador local
      const unresolved = (data.comments as CommentItem[]).filter(c => !c.resolved).length
      setCommentCounts(prev => ({ ...prev, [segId]: (data.comments as CommentItem[]).length }))
    } catch {
      toast.error('Erro ao carregar comentários')
    } finally {
      setCommentsLoading(false)
    }
  }, [])

  const sendComment = useCallback(async () => {
    if (!commentPanel || !newComment.trim() || sendingComment) return
    setSendingComment(true)
    try {
      const { data } = await api.post(`/api/segments/${commentPanel}/comments`, { content: newComment.trim() })
      setComments(prev => [...prev, data.comment])
      setCommentCounts(prev => ({ ...prev, [commentPanel]: (prev[commentPanel] ?? 0) + 1 }))
      setNewComment('')
    } catch {
      toast.error('Erro ao enviar comentário')
    } finally {
      setSendingComment(false)
    }
  }, [commentPanel, newComment, sendingComment])

  const toggleResolve = useCallback(async (commentId: string) => {
    try {
      const { data } = await api.patch(`/api/comments/${commentId}`, {})
      setComments(prev => prev.map(c => c.id === commentId ? data.comment : c))
    } catch {
      toast.error('Erro ao atualizar comentário')
    }
  }, [])

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      await api.delete(`/api/comments/${commentId}`)
      setComments(prev => prev.filter(c => c.id !== commentId))
      if (commentPanel) {
        setCommentCounts(prev => ({ ...prev, [commentPanel]: Math.max(0, (prev[commentPanel] ?? 1) - 1) }))
      }
    } catch {
      toast.error('Erro ao excluir comentário')
    }
  }, [commentPanel])

  const openHistory = useCallback(async (segId: string) => {
    setHistorySegId(segId)
    setHistoryEntries([])
    setHistoryLoading(true)
    try {
      const { data } = await api.get(`/api/segments/${segId}/history`)
      setHistoryEntries(data.history ?? [])
    } catch {
      toast.error('Erro ao carregar histórico')
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // ── Keyboard shortcut ─────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent, segId: string) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      confirmSegment(segId)
    }
    if (e.key === 'Escape') {
      setActiveId(null)
    }
  }, [confirmSegment])


  // ── Apply TM match ────────────────────────────────────────────────────────

  function applyTmMatch(targetText: string) {
    if (!activeId) return
    setTranslations(prev => ({ ...prev, [activeId]: targetText }))
    activeEditorRef.current?.focus() ?? activeTextareaRef.current?.focus()
    toast.success('Sugestão aplicada — edite se necessário e confirme com Ctrl+Enter')
  }

  // ── QA helpers ────────────────────────────────────────────────────────────

  function qaIssueKey(i: QAIssue) {
    return `${i.segmentId}:${i.type}:${i.detail}`
  }

  async function exportQAReport(issues: QAIssue[]) {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const hoje = new Date().toLocaleDateString('pt-BR')
    const errors = issues.filter(i => i.severity === 'error').length
    const warnings = issues.filter(i => i.severity === 'warning').length

    // Header
    doc.setFillColor(30, 58, 95)
    doc.rect(0, 0, 210, 28, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('Relatório de QA', 14, 12)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Arquivo: ${fileId}  |  Gerado em: ${hoje}  |  ${errors} erros · ${warnings} avisos`, 14, 22)

    // Table
    doc.setTextColor(0, 0, 0)
    const typeLabel: Record<string, string> = {
      PLACEHOLDER: 'Placeholder', NUMBER: 'Número',
      PUNCTUATION: 'Pontuação', GLOSSARY: 'Glossário',
    }
    autoTable(doc, {
      startY: 34,
      head: [['Seg.', 'Tipo', 'Severidade', 'Problema', 'Detalhe']],
      body: issues.map(i => [
        String(i.segmentOrder),
        typeLabel[i.type] ?? i.type,
        i.severity === 'error' ? 'Erro' : 'Aviso',
        i.message,
        i.detail,
      ]),
      headStyles: { fillColor: [30, 58, 95], textColor: 255, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 0: { cellWidth: 12 }, 1: { cellWidth: 22 }, 2: { cellWidth: 20 }, 3: { cellWidth: 70 }, 4: { cellWidth: 60 } },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const val = data.cell.raw as string
          data.cell.styles.textColor = val === 'Erro' ? [180, 30, 30] : [160, 110, 0]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      alternateRowStyles: { fillColor: [245, 249, 255] },
    })

    // Footer
    const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(7)
      doc.setTextColor(150)
      doc.text(`Hesed Translation Platform  |  Página ${i} de ${pageCount}`, 14, 290)
    }

    doc.save(`QA_Report_${hoje.replace(/\//g, '-')}.pdf`)
  }

  // ── Do finish (no QA check) ───────────────────────────────────────────────

  async function doFinish() {
    setFinishing(true)
    try {
      const status = mode === 'revisor' ? 'DONE' : 'TRANSLATED'
      await api.patch(`/api/projects/${projectId}/files/${fileId}`, { status })
      toast.success(mode === 'revisor' ? 'Arquivo marcado como concluído!' : 'Arquivo enviado para revisão!')
      router.back()
    } catch {
      toast.error('Erro ao finalizar arquivo')
    } finally {
      setFinishing(false)
    }
  }

  // ── Finish file (with QA check for editor mode) ───────────────────────────

  async function finishFile() {
    if (mode === 'editor') {
      setQaLoading(true)
      try {
        const { data } = await api.post(`/api/projects/${projectId}/files/${fileId}/qa`)
        const active = (data.issues as QAIssue[]).filter(i => !ignoredQaKeys.has(qaIssueKey(i)))
        if (active.length > 0) {
          setQaIssues(data.issues)
          setShowQaModal(true)
          return
        }
      } catch {
        // QA check failed — proceed anyway
      } finally {
        setQaLoading(false)
      }
    }
    await doFinish()
  }

  // ── Progress ──────────────────────────────────────────────────────────────

  const totalSegs = segments.length
  const doneSegs = mode === 'revisor'
    ? segments.filter(s => s.status === 'REVIEWED').length
    : segments.filter(s => s.status === 'CONFIRMED' || s.status === 'REVIEWED').length
  const progress = totalSegs > 0 ? Math.round((doneSegs / totalSegs) * 100) : 0

  const canFinish = mode === 'revisor'
    ? segments.every(s => s.status === 'REVIEWED' || s.status === 'REJECTED')
    : segments.every(s => s.status === 'CONFIRMED' || s.status === 'REVIEWED')

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!fileInfo) {
    return (
      <div className="text-center py-20 text-slate-400">Arquivo não encontrado</div>
    )
  }

  const activeSegment = segments.find(s => s.id === activeId) ?? null

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-[#1e3a5f] text-white shadow-md">
        {/* Main toolbar */}
        <div className="px-4 py-3 flex items-center gap-4">
          <button onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-sm truncate">{fileInfo.originalName ?? fileInfo.name}</h1>
            <p className="text-blue-200 text-xs">{fileInfo.project.name}</p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold">{doneSegs}/{totalSegs} seg.</p>
              <p className="text-xs text-blue-200">{progress}% {mode === 'revisor' ? 'revisado' : 'traduzido'}</p>
            </div>
            <div className="w-20 bg-white/20 rounded-full h-2 hidden sm:block">
              <div className="h-2 bg-white rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs text-blue-200 hidden md:block">
              {langLabel(fileInfo.project.sourceLang)} → {langLabel(fileInfo.project.targetLang)}
            </span>
          </div>

          {/* Finish button */}
          <button
            onClick={finishFile}
            disabled={!canFinish || finishing || qaLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              canFinish
                ? 'bg-white text-[#1e3a5f] hover:bg-blue-50'
                : 'bg-white/10 text-white/40 cursor-not-allowed'
            }`}>
            {(finishing || qaLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {qaLoading ? 'Verificando...' : mode === 'revisor' ? 'Concluir revisão' : 'Enviar para revisão'}
          </button>
        </div>

        {/* Layout switcher bar */}
        <div className="px-4 py-1.5 border-t border-white/10 flex items-center gap-1">
          <span className="text-xs text-blue-300 mr-2 hidden sm:block">Layout:</span>
          {([
            { mode: 'split'   as ViewMode, icon: <Columns2 className="w-3.5 h-3.5" />,      label: 'Lado a lado',  title: 'Lado a lado — origem e tradução em colunas' },
            { mode: 'stacked' as ViewMode, icon: <Rows3    className="w-3.5 h-3.5" />,      label: 'Empilhado',    title: 'Empilhado — texto original acima da tradução' },
            { mode: 'compact' as ViewMode, icon: <AlignJustify className="w-3.5 h-3.5" />,  label: 'Compacto',     title: 'Compacto — lista simplificada' },
          ]).map(opt => (
            <button
              key={opt.mode}
              onClick={() => setViewMode(opt.mode)}
              title={opt.title}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === opt.mode
                  ? 'bg-white text-[#1e3a5f]'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              {opt.icon}
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          ))}

          {/* Painéis flutuantes — TM e Glossário */}
          <div className="ml-auto flex items-center gap-1 border-l border-white/20 pl-3">
            <span className="text-xs text-blue-300 mr-1 hidden sm:block">Painéis:</span>
            <button
              onClick={() => setActivePanel(p => p === 'tm' ? null : 'tm')}
              title="Memória de Tradução"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activePanel === 'tm'
                  ? 'bg-white text-[#1e3a5f]'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">TM</span>
            </button>
            <button
              onClick={() => setActivePanel(p => p === 'tb' ? null : 'tb')}
              title="Glossário"
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                activePanel === 'tb'
                  ? 'bg-white text-[#1e3a5f]'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Glossário</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Segment list */}
        <div className="flex-1 overflow-y-auto">
          {/* Column headers for split mode */}
          {viewMode === 'split' && (
            <div className="flex sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <div className="w-12 shrink-0" />
              <div className="flex-1 px-4 py-2 border-r border-slate-200">Original</div>
              <div className="flex-1 px-4 py-2">Tradução</div>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {segments.map((seg) => {
              const isActive = seg.id === activeId
              const isSaving = saving.has(seg.id)
              const translation = translations[seg.id] ?? ''

              // ── Shared: action buttons bar ──────────────────────────────
              const actionButtons = (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => confirmSegment(seg.id)}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1e3a5f] text-white text-xs font-semibold rounded-lg hover:bg-[#162d4a] transition-colors disabled:opacity-50">
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {mode === 'revisor' ? 'Aprovar' : 'Confirmar'}
                    <kbd className="ml-1 text-blue-200 font-mono text-xs">Ctrl+↵</kbd>
                  </button>
                  {mode === 'revisor' && (
                    <button onClick={() => rejectSegment(seg.id)} disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-xs font-semibold rounded-lg border border-red-200 hover:bg-red-100 transition-colors">
                      <ThumbsDown className="w-3.5 h-3.5" />Rejeitar
                    </button>
                  )}
                  <button onClick={() => { setNoteModal(seg.id); setNoteText(seg.note ?? '') }}
                    className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title="Nota pessoal">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openCommentPanel(seg.id)}
                    className={`relative p-1.5 rounded-lg transition-colors ${
                      (commentCounts[seg.id] ?? 0) > 0 ? 'text-blue-500 bg-blue-50 hover:bg-blue-100' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'
                    }`} title="Comentários">
                    <MessageCircle className="w-3.5 h-3.5" />
                    {(commentCounts[seg.id] ?? 0) > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                        {commentCounts[seg.id]}
                      </span>
                    )}
                  </button>
                  <button onClick={() => openHistory(seg.id)}
                    className="p-1.5 text-slate-400 hover:text-[#1e3a5f] hover:bg-slate-100 rounded-lg transition-colors" title="Histórico">
                    <History className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => { const idx = segments.findIndex(s => s.id === seg.id); const next = segments[idx + 1]; if (next) setActiveId(next.id) }}
                    className="ml-auto p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-colors" title="Pular (Esc)">
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>
              )

              // ── Shared: hint inline de TM (melhor match exibido no segmento ativo) ──
              const bestTm = isActive && tmMatches.length > 0 ? tmMatches[0] : null
              const inlineTmHint = bestTm ? (() => {
                const diff = wordDiff(bestTm.sourceText, seg.sourceText)
                // Agrupa tokens 'del' consecutivos para envolver em aspas
                const groups: { text: string; del: boolean }[] = []
                let buf = ''
                let inDel = false
                for (const tok of diff) {
                  if (tok.type === 'add') continue
                  if (tok.type === 'del') { inDel = true; buf += tok.text }
                  else {
                    if (inDel) { groups.push({ text: buf.trim(), del: true }); buf = ''; inDel = false }
                    groups.push({ text: tok.text, del: false })
                  }
                }
                if (inDel && buf.trim()) groups.push({ text: buf.trim(), del: true })
                const hasDiff = groups.some(g => g.del)
                return (
                  <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50/50 overflow-hidden text-xs">
                    {/* Sugestão TM — clique para aplicar */}
                    <div
                      className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-violet-100/60 transition-colors"
                      onClick={e => { e.stopPropagation(); applyTmMatch(bestTm.targetText) }}
                    >
                      <span className="font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] shrink-0 mt-0.5">
                        {bestTm.score}%
                      </span>
                      <p className="font-medium text-violet-900 leading-relaxed flex-1">{bestTm.targetText}</p>
                      <span className="text-[10px] text-violet-400 shrink-0 mt-0.5 whitespace-nowrap">↵ aplicar</span>
                    </div>
                    {/* Fonte original do TM com palavras diferentes destacadas */}
                    {hasDiff && (
                      <div className="px-3 py-1.5 border-t border-violet-100 bg-white/50">
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          {groups.map((g, i) =>
                            g.del
                              ? <span key={i} className="font-semibold text-orange-600">&ldquo;{g.text}&rdquo; </span>
                              : <span key={i}>{g.text}</span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })() : null

              // ── Shared: target text display (inactive) ──────────────────
              const targetHasTags = /\{\d+\}/.test(seg.targetText ?? '')
              const targetDisplay = (
                <div>
                  <p className={`text-sm leading-relaxed whitespace-pre-wrap ${
                    seg.targetText
                      ? seg.status === 'REVIEWED'  ? 'text-green-700'
                      : seg.status === 'CONFIRMED' ? 'text-blue-700'
                      : seg.status === 'REJECTED'  ? 'text-red-500 line-through'
                      : 'text-slate-600'
                      : 'text-slate-300 italic'
                  }`}>
                    {seg.targetText
                      ? targetHasTags ? renderWithTags(seg.targetText) : seg.targetText
                      : '(sem tradução)'}
                  </p>
                  {seg.translationSource && (
                    <div className="mt-1">
                      <SourceBadge source={seg.translationSource} tmScore={seg.tmScore} />
                    </div>
                  )}
                </div>
              )

              // ── Shared: translation input (textarea or TagEditorField) ──
              const hasTags   = /\{\d+\}/.test(seg.sourceText)
              const baseRows  = Math.max(2, Math.ceil(seg.sourceText.length / 60))
              const placeholder = mode === 'revisor' ? 'Edite a tradução se necessário...' : 'Digite a tradução aqui...'

              const targetTextarea = (extraRows = 0) => hasTags ? (
                <TagEditorField
                  ref={activeEditorRef}
                  value={translation}
                  onChange={v => setTranslations(prev => ({ ...prev, [seg.id]: v }))}
                  onKeyDown={e => handleKeyDown(e as unknown as React.KeyboardEvent<HTMLTextAreaElement>, seg.id)}
                  placeholder={placeholder}
                  rows={baseRows + extraRows}
                />
              ) : (
                <textarea
                  ref={activeTextareaRef}
                  value={translation}
                  onChange={e => setTranslations(prev => ({ ...prev, [seg.id]: e.target.value }))}
                  onKeyDown={e => handleKeyDown(e, seg.id)}
                  placeholder={placeholder}
                  rows={baseRows + extraRows}
                  className="w-full text-sm text-slate-800 leading-relaxed border border-[#1e3a5f]/30 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f] bg-white placeholder-slate-300"
                />
              )

              // ── Segment number + status column (shared) ──────────────────
              const segNumCol = (
                <div className="w-12 flex flex-col items-center justify-start pt-3 gap-1 shrink-0 bg-slate-50/60 border-r border-slate-100">
                  <span className="text-xs font-mono text-slate-400">{seg.order}</span>
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : statusIcon(seg.status, 'w-3.5 h-3.5')}
                  {seg.flagged && <Flag className="w-3 h-3 text-amber-400" />}
                </div>
              )

              // ════════════════════════════════════════════
              // LAYOUT: SPLIT (lado a lado)
              // ════════════════════════════════════════════
              if (viewMode === 'split') return (
                <div key={seg.id} ref={isActive ? activeRowRef : undefined}
                  className={`transition-colors cursor-pointer ${isActive ? 'bg-blue-50 border-l-4 border-l-[#1e3a5f]' : 'bg-white hover:bg-slate-50/50 border-l-4 border-l-transparent'}`}
                  onClick={() => !isActive && setActiveId(seg.id)}>
                  <div className="flex gap-0 min-h-[64px]">
                    {segNumCol}
                    {/* Source */}
                    <div className={`flex-1 px-4 py-3 border-r border-slate-100 ${isActive ? 'bg-white/60' : ''}`}>
                      <p className="text-sm text-slate-700 leading-relaxed">{renderWithTags(seg.sourceText)}</p>
                      {isActive && /\{\d+\}/.test(seg.sourceText) && (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          <span className="text-[10px] text-slate-400 mr-0.5">tags:</span>
                          {[...new Set(Array.from(seg.sourceText.matchAll(/\{(\d+)\}/g), m => m[1]))].map(n => (
                            <span key={n} className="inline-flex gap-0.5">
                              <button onClick={e => { e.stopPropagation(); insertTagAtCursor(`{${n}}`) }}
                                className="inline-flex items-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-l px-1.5 py-0.5 text-[10px] font-mono font-bold" title="Inserir abertura">
                                {n}▸
                              </button>
                              <button onClick={e => { e.stopPropagation(); insertTagAtCursor(`{/${n}}`) }}
                                className="inline-flex items-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-r px-1.5 py-0.5 text-[10px] font-mono font-bold" title="Inserir fechamento">
                                ◂{n}
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {seg.note && <p className="text-xs text-amber-600 mt-1 italic">📝 {seg.note}</p>}
                    </div>
                    {/* Target */}
                    <div className="flex-1 px-4 py-3 flex flex-col gap-2">
                      {isActive ? <>{targetTextarea()}{inlineTmHint}{actionButtons}</> : targetDisplay}
                    </div>
                  </div>
                </div>
              )

              // ════════════════════════════════════════════
              // LAYOUT: STACKED (empilhado)
              // ════════════════════════════════════════════
              if (viewMode === 'stacked') return (
                <div key={seg.id} ref={isActive ? activeRowRef : undefined}
                  className={`transition-colors cursor-pointer ${isActive ? 'border-l-4 border-l-[#1e3a5f]' : 'bg-white hover:bg-slate-50/40 border-l-4 border-l-transparent'}`}
                  onClick={() => !isActive && setActiveId(seg.id)}>
                  {/* Source row */}
                  <div className={`flex min-h-[48px] ${isActive ? 'bg-slate-50' : ''}`}>
                    {segNumCol}
                    <div className="flex-1 px-4 py-3">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Original</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{renderWithTags(seg.sourceText)}</p>
                      {isActive && /\{\d+\}/.test(seg.sourceText) && (
                        <div className="flex flex-wrap items-center gap-1 mt-2">
                          <span className="text-[10px] text-slate-400 mr-0.5">tags:</span>
                          {[...new Set(Array.from(seg.sourceText.matchAll(/\{(\d+)\}/g), m => m[1]))].map(n => (
                            <span key={n} className="inline-flex gap-0.5">
                              <button onClick={e => { e.stopPropagation(); insertTagAtCursor(`{${n}}`) }}
                                className="inline-flex items-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-l px-1.5 py-0.5 text-[10px] font-mono font-bold">{n}▸</button>
                              <button onClick={e => { e.stopPropagation(); insertTagAtCursor(`{/${n}}`) }}
                                className="inline-flex items-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-r px-1.5 py-0.5 text-[10px] font-mono font-bold">◂{n}</button>
                            </span>
                          ))}
                        </div>
                      )}
                      {seg.note && <p className="text-xs text-amber-600 mt-1 italic">📝 {seg.note}</p>}
                    </div>
                  </div>
                  {/* Target row */}
                  <div className={`flex border-t ${isActive ? 'bg-blue-50/60 border-blue-100' : 'border-slate-50 bg-slate-50/30'}`}>
                    <div className="w-12 shrink-0 border-r border-slate-100" />
                    <div className="flex-1 px-4 py-3 flex flex-col gap-2">
                      {!isActive && <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Tradução</p>}
                      {isActive ? <>{targetTextarea()}{inlineTmHint}{actionButtons}</> : targetDisplay}
                    </div>
                  </div>
                </div>
              )

              // ════════════════════════════════════════════
              // LAYOUT: COMPACT (compacto)
              // ════════════════════════════════════════════
              return (
                <div key={seg.id} ref={isActive ? activeRowRef : undefined}
                  className={`transition-all cursor-pointer ${isActive ? 'bg-blue-50 border-l-4 border-l-[#1e3a5f]' : 'bg-white hover:bg-slate-50/50 border-l-4 border-l-transparent'}`}
                  onClick={() => !isActive && setActiveId(seg.id)}>
                  {/* Collapsed: single compact row */}
                  {!isActive ? (
                    <div className="flex items-start gap-0 py-2 min-h-[40px]">
                      <div className="w-12 flex flex-col items-center justify-start pt-1 gap-0.5 shrink-0">
                        <span className="text-xs font-mono text-slate-400">{seg.order}</span>
                        {statusIcon(seg.status, 'w-3 h-3')}
                      </div>
                      <div className="flex-1 px-3 grid grid-cols-2 gap-4 items-start">
                        <p className="text-xs text-slate-600 leading-snug line-clamp-2">{renderWithTags(seg.sourceText)}</p>
                        <div>
                          <p className={`text-xs leading-snug line-clamp-2 ${
                            seg.targetText
                              ? seg.status === 'REVIEWED'  ? 'text-green-700'
                              : seg.status === 'CONFIRMED' ? 'text-blue-700'
                              : seg.status === 'REJECTED'  ? 'text-red-500 line-through'
                              : 'text-slate-500'
                              : 'text-slate-300 italic'
                          }`}>
                            {seg.targetText
                              ? /\{\d+\}/.test(seg.targetText) ? renderWithTags(seg.targetText) : seg.targetText
                              : '—'}
                          </p>
                          {seg.translationSource && <SourceBadge source={seg.translationSource} tmScore={seg.tmScore} />}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Expanded active segment */
                    <div className="flex gap-0">
                      {segNumCol}
                      <div className="flex-1 px-4 py-3 flex flex-col gap-3">
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Original</p>
                          <p className="text-sm text-slate-700 leading-relaxed bg-white/70 rounded-lg px-3 py-2 border border-slate-100">
                            {renderWithTags(seg.sourceText)}
                          </p>
                          {/\{\d+\}/.test(seg.sourceText) && (
                            <div className="flex flex-wrap items-center gap-1 mt-2">
                              <span className="text-[10px] text-slate-400 mr-0.5">tags:</span>
                              {[...new Set(Array.from(seg.sourceText.matchAll(/\{(\d+)\}/g), m => m[1]))].map(n => (
                                <span key={n} className="inline-flex gap-0.5">
                                  <button onClick={e => { e.stopPropagation(); insertTagAtCursor(`{${n}}`) }}
                                    className="inline-flex items-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-l px-1.5 py-0.5 text-[10px] font-mono font-bold">{n}▸</button>
                                  <button onClick={e => { e.stopPropagation(); insertTagAtCursor(`{/${n}}`) }}
                                    className="inline-flex items-center bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-r px-1.5 py-0.5 text-[10px] font-mono font-bold">◂{n}</button>
                                </span>
                              ))}
                            </div>
                          )}
                          {seg.note && <p className="text-xs text-amber-600 mt-1 italic">📝 {seg.note}</p>}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Tradução</p>
                          {targetTextarea(1)}
                        </div>
                        {inlineTmHint}
                        {actionButtons}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom spacer */}
          <div className="h-20" />
        </div>

        {/* ── PAINEL FLUTUANTE (TM / Glossário) ─────────────────────────────── */}
        {activePanel && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-40 flex flex-col overflow-hidden">

            {/* Header do painel */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                {activePanel === 'tm'
                  ? <><BookOpen className="w-4 h-4 text-[#1e3a5f]" /><span className="text-sm font-semibold text-[#1e3a5f]">Memória de Tradução</span></>
                  : <><Zap        className="w-4 h-4 text-[#1e3a5f]" /><span className="text-sm font-semibold text-[#1e3a5f]">Glossário</span></>
                }
              </div>
              <button
                onClick={() => setActivePanel(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
                title="Fechar painel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do painel */}
            <div className="flex-1 overflow-y-auto p-3">
              {!activeId ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-300">
                  <BookOpen className="w-8 h-8 mb-2" />
                  <p className="text-xs text-center">Clique em um segmento para ver sugestões</p>
                </div>
              ) : sidebarLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                </div>
              ) : (
                <>
                  {/* TM */}
                  {activePanel === 'tm' && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Memória de Tradução
                      </p>
                      {tmMatches.length === 0 ? (
                        <div className="text-center py-8 text-slate-300">
                          <BookOpen className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-xs">Nenhum match encontrado</p>
                        </div>
                      ) : (() => {
                        const activeSeg = segments.find(s => s.id === activeId)
                        return tmMatches.map(m => {
                          const diff = activeSeg ? wordDiff(m.sourceText, activeSeg.sourceText) : null
                          const hasChanges = diff?.some(d => d.type === 'del')
                          return (
                            <div key={m.id}
                              className={`border rounded-lg p-3 cursor-pointer hover:shadow-sm transition-shadow ${scoreColor(m.score)}`}
                              onClick={() => applyTmMatch(m.targetText)}>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${scoreColor(m.score)}`}>
                                  {m.score}%
                                </span>
                                {m.domain && <span className="text-xs text-slate-400">{m.domain}</span>}
                              </div>
                              {/* Texto-fonte do TM com diff: palavras que diferem do segmento atual em laranja */}
                              <p className="text-xs text-slate-500 mb-1 leading-relaxed">
                                {diff && hasChanges
                                  ? diff.filter(d => d.type !== 'add').map((d, i) =>
                                      d.type === 'del'
                                        ? <mark key={i} className="bg-orange-100 text-orange-700 rounded px-0.5 not-italic">{d.text}</mark>
                                        : <span key={i}>{d.text}</span>
                                    )
                                  : m.sourceText
                                }
                              </p>
                              <p className="text-xs font-medium text-slate-800 line-clamp-2">{m.targetText}</p>
                              <p className="text-xs text-blue-500 mt-1">↵ Clique para aplicar</p>
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )}

                  {/* Glossário */}
                  {activePanel === 'tb' && (
                    <div className="space-y-3">
                      {pgTerms.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-[#1e3a5f] uppercase tracking-wide flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1e3a5f] inline-block" />
                            Glossário do Projeto
                          </p>
                          {pgTerms.map(t => (
                            <div key={t.id} className="border rounded-lg p-3 bg-blue-50 border-blue-200">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-700">{t.sourceTerm}</span>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                <span className="text-xs font-semibold text-[#1e3a5f]">{t.targetTerm}</span>
                              </div>
                              {t.notes && <p className="text-xs text-slate-500 mt-1">{t.notes}</p>}
                            </div>
                          ))}
                          {tbTerms.length > 0 && <hr className="border-slate-100" />}
                        </div>
                      )}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                          Glossário Teológico
                        </p>
                        {tbTerms.length === 0 && pgTerms.length === 0 ? (
                          <div className="text-center py-8 text-slate-300">
                            <Zap className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-xs">Nenhum termo encontrado neste segmento</p>
                          </div>
                        ) : tbTerms.length === 0 ? (
                          <p className="text-xs text-slate-300 text-center py-4">Sem termos globais neste segmento</p>
                        ) : (
                          tbTerms.map(t => (
                            <div key={t.id}
                              className={`border rounded-lg p-3 ${t.forbidden ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="text-xs font-semibold text-slate-700">{t.sourceTerm}</span>
                                <ChevronRight className="w-3 h-3 text-slate-300" />
                                <span className={`text-xs font-semibold ${t.forbidden ? 'text-red-600 line-through' : 'text-blue-700'}`}>
                                  {t.targetTerm}
                                </span>
                                {t.forbidden && <span className="text-xs bg-red-100 text-red-600 px-1 rounded">Proibido</span>}
                              </div>
                              {t.domain && <span className="text-xs text-slate-400">{t.domain}</span>}
                              {t.definition && <p className="text-xs text-slate-500 mt-1 line-clamp-3">{t.definition}</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer do painel: info do segmento */}
            {activeSegment && (
              <div className="border-t border-slate-100 p-3 bg-slate-50 text-xs text-slate-400 space-y-0.5 flex-shrink-0">
                <div className="flex justify-between">
                  <span>Segmento {activeSegment.order}/{totalSegs}</span>
                  <span>{activeSegment.wordCount} palavras</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-medium text-slate-600">{activeSegment.status}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── QA MODAL ────────────────────────────────────────────────────────── */}
      {showQaModal && (() => {
        const activeIssues = qaIssues.filter(i => !ignoredQaKeys.has(qaIssueKey(i)))
        const errorCount   = activeIssues.filter(i => i.severity === 'error').length
        const warnCount    = activeIssues.filter(i => i.severity === 'warning').length
        const hasErrors    = errorCount > 0

        const typeLabel: Record<string, string> = {
          PLACEHOLDER: 'Placeholder',
          NUMBER: 'Número',
          PUNCTUATION: 'Pontuação',
          GLOSSARY: 'Glossário',
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">

              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                <ShieldAlert className={`w-5 h-5 ${hasErrors ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900">Verificação de Qualidade (QA)</h3>
                  <p className="text-sm text-slate-500">
                    {activeIssues.length === 0
                      ? 'Nenhum problema pendente — pode finalizar.'
                      : `${errorCount} erro${errorCount !== 1 ? 's' : ''} · ${warnCount} aviso${warnCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
                <button onClick={() => setShowQaModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Issues list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {activeIssues.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-400" />
                    <p className="text-sm">Todos os problemas foram ignorados</p>
                  </div>
                ) : (
                  activeIssues.map((issue, idx) => (
                    <div key={idx}
                      className={`flex items-start gap-3 p-3 rounded-xl border ${
                        issue.severity === 'error'
                          ? 'bg-red-50 border-red-200'
                          : 'bg-amber-50 border-amber-200'
                      }`}>
                      <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
                        issue.severity === 'error' ? 'text-red-500' : 'text-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            issue.severity === 'error'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}>
                            {typeLabel[issue.type] ?? issue.type}
                          </span>
                          <span className="text-xs text-slate-400">Seg. {issue.segmentOrder}</span>
                        </div>
                        <p className="text-sm text-slate-700 font-medium">{issue.message}</p>
                        {issue.detail && (
                          <p className="text-xs text-slate-500 mt-0.5 font-mono">{issue.detail}</p>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => { setShowQaModal(false); setActiveId(issue.segmentId) }}
                          className="text-xs px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium transition-colors">
                          Ir ao seg.
                        </button>
                        <button
                          onClick={() => setIgnoredQaKeys(prev => new Set([...prev, qaIssueKey(issue)]))}
                          className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 transition-colors">
                          Ignorar
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-100">
                <button
                  onClick={() => exportQAReport(activeIssues)}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                  title="Exportar relatório PDF">
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={() => setShowQaModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                  Fechar e corrigir
                </button>
                <button
                  disabled={finishing}
                  onClick={async () => { setShowQaModal(false); await doFinish() }}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold transition-colors ${
                    hasErrors
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-[#1e3a5f] hover:bg-[#162d4a]'
                  }`}>
                  {finishing
                    ? 'Enviando...'
                    : hasErrors
                    ? `Enviar com ${errorCount} erro${errorCount !== 1 ? 's' : ''}`
                    : 'Enviar mesmo assim'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── FINISH CONFIRM MODAL ────────────────────────────────────────────── */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">
                  {mode === 'revisor' ? 'Revisão concluída!' : 'Tradução concluída!'}
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {mode === 'revisor'
                    ? 'Todos os segmentos foram revisados.'
                    : 'Todos os segmentos foram confirmados.'}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-6">
              {mode === 'revisor'
                ? 'Deseja marcar este arquivo como concluído agora, ou prefere revisar novamente antes?'
                : 'Deseja enviar o arquivo para revisão agora, ou prefere revisar suas traduções antes?'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinishConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
                Continuar editando
              </button>
              <button
                disabled={finishing}
                onClick={async () => { setShowFinishConfirm(false); await finishFile() }}
                className="flex-1 py-2.5 rounded-xl bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#162d4a] transition-colors flex items-center justify-center gap-2">
                {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {mode === 'revisor' ? 'Concluir revisão' : 'Enviar para revisão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY MODAL ───────────────────────────────────────────────────── */}
      {historySegId && (() => {
        const seg = segments.find(s => s.id === historySegId)
        const entries = [...historyEntries].reverse() // newest first
        const statusLabel: Record<string, string> = {
          PENDING: 'Pendente', TRANSLATING: 'Em tradução', CONFIRMED: 'Confirmado',
          REVIEWED: 'Revisado', REJECTED: 'Rejeitado',
        }
        const statusColor: Record<string, string> = {
          CONFIRMED: 'bg-blue-100 text-blue-700',
          REVIEWED:  'bg-green-100 text-green-700',
          REJECTED:  'bg-red-100 text-red-600',
          TRANSLATING: 'bg-amber-100 text-amber-700',
          PENDING:   'bg-slate-100 text-slate-500',
        }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">

              {/* Header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
                <History className="w-5 h-5 text-[#1e3a5f]" />
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900">Histórico do Segmento {seg?.order}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{seg?.sourceText}</p>
                </div>
                <button onClick={() => setHistorySegId(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : entries.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <History className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                    <p className="text-sm">Nenhuma versão registrada ainda.</p>
                    <p className="text-xs mt-1">O histórico é registrado a partir de agora.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entries.map((entry, idx) => {
                      const prevEntry = entries[idx + 1]
                      const hasDiff = prevEntry && prevEntry.targetText !== null && entry.targetText !== null
                      const diffTokens = hasDiff ? wordDiff(prevEntry.targetText!, entry.targetText!) : null
                      const versionNum = entries.length - idx

                      return (
                        <div key={entry.id}
                          className={`border rounded-xl overflow-hidden ${idx === 0 ? 'border-[#1e3a5f]/30 bg-blue-50/30' : 'border-slate-200 bg-white'}`}>
                          {/* Version header */}
                          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100/80 bg-slate-50/50">
                            <span className="text-xs font-bold text-slate-500">v{versionNum}</span>
                            {idx === 0 && (
                              <span className="text-xs bg-[#1e3a5f] text-white px-1.5 py-0.5 rounded font-medium">atual</span>
                            )}
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor[entry.status] ?? 'bg-slate-100 text-slate-500'}`}>
                              {statusLabel[entry.status] ?? entry.status}
                            </span>
                            <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                              {entry.authorName && <span className="font-medium text-slate-600">{entry.authorName}</span>}
                              <span>·</span>
                              {timeAgo(entry.createdAt)}
                            </span>
                          </div>

                          {/* Translation text or diff */}
                          <div className="px-4 py-3">
                            {!entry.targetText ? (
                              <p className="text-sm text-slate-400 italic">(sem tradução)</p>
                            ) : diffTokens ? (
                              <p className="text-sm leading-relaxed">
                                {diffTokens.map((tok, ti) => {
                                  if (tok.type === 'same') return <span key={ti}>{tok.text}</span>
                                  if (tok.type === 'del')  return <span key={ti} className="bg-red-100 text-red-700 line-through rounded px-0.5">{tok.text}</span>
                                  return <span key={ti} className="bg-green-100 text-green-700 rounded px-0.5">{tok.text}</span>
                                })}
                              </p>
                            ) : (
                              <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{entry.targetText}</p>
                            )}
                          </div>

                          {/* Restore button (not for the current/latest version) */}
                          {idx > 0 && entry.targetText && (
                            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/30">
                              <button
                                onClick={() => {
                                  if (historySegId) {
                                    setTranslations(prev => ({ ...prev, [historySegId]: entry.targetText! }))
                                    setHistorySegId(null)
                                    setActiveId(historySegId)
                                    toast.success('Versão restaurada — confirme para salvar')
                                  }
                                }}
                                className="flex items-center gap-1.5 text-xs text-[#1e3a5f] font-semibold hover:underline">
                                <RotateCcw className="w-3 h-3" />
                                Restaurar esta versão
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── NOTE MODAL ──────────────────────────────────────────────────────── */}
      {noteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-slate-900 mb-3">Nota do Segmento</h3>
            <textarea
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
              rows={4}
              placeholder="Adicione uma nota ou comentário para este segmento..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setNoteModal(null)}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!noteModal) return
                  await api.patch(`/api/segments/${noteModal}`, { note: noteText || null })
                  setSegments(prev => prev.map(s => s.id === noteModal ? { ...s, note: noteText || null } : s))
                  setNoteModal(null)
                  toast.success('Nota salva')
                }}
                className="flex-1 py-2 rounded-lg bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#162d4a]">
                Salvar nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── COMMENT PANEL ───────────────────────────────────────────────────── */}
      {commentPanel && (() => {
        const seg = segments.find(s => s.id === commentPanel)
        const roleColor = (role: string) =>
          role === 'EDITOR'  ? 'bg-blue-100 text-blue-700' :
          role === 'REVISOR' ? 'bg-purple-100 text-purple-700' :
          'bg-slate-100 text-slate-600'
        const initials = (name: string) =>
          name.trim().split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col"
              style={{ maxHeight: '85vh' }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                <div>
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-500" />
                    Discussão — Segmento #{seg?.order}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {comments.length} comentário{comments.length !== 1 ? 's' : ''} •{' '}
                    {comments.filter(c => !c.resolved).length} em aberto
                  </p>
                </div>
                <button onClick={() => setCommentPanel(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Texto do segmento */}
              {seg && (
                <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
                  <p className="text-xs text-slate-500 font-medium mb-0.5">Texto fonte:</p>
                  <p className="text-sm text-slate-700 line-clamp-2">{seg.sourceText}</p>
                </div>
              )}

              {/* Thread de comentários */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {commentsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
                  </div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Nenhum comentário ainda.</p>
                    <p className="text-xs mt-1">Inicie a discussão abaixo.</p>
                  </div>
                ) : (
                  comments.map(c => (
                    <div key={c.id}
                      className={`flex gap-3 transition-opacity ${c.resolved ? 'opacity-40' : ''}`}>
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-[#1e3a5f] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {initials(c.author.name)}
                      </div>
                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-semibold text-slate-800">{c.author.name}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${roleColor(c.author.role)}`}>
                            {c.author.role}
                          </span>
                          <span className="text-[10px] text-slate-400">{timeAgo(c.createdAt)}</span>
                          {c.resolved && (
                            <span className="text-[10px] text-green-600 font-medium flex items-center gap-0.5">
                              <CheckSquare className="w-2.5 h-2.5" /> Resolvido
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-700 break-words">{c.content}</p>
                        <div className="flex gap-3 mt-1.5">
                          <button
                            onClick={() => toggleResolve(c.id)}
                            className="text-[10px] text-slate-400 hover:text-green-600 transition-colors flex items-center gap-1">
                            <CheckSquare className="w-3 h-3" />
                            {c.resolved ? 'Reabrir' : 'Marcar resolvido'}
                          </button>
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="text-[10px] text-slate-400 hover:text-red-500 transition-colors">
                            Excluir
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Input de novo comentário */}
              <div className="px-5 py-4 border-t border-slate-100 shrink-0">
                <div className="flex gap-2">
                  <textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        sendComment()
                      }
                    }}
                    placeholder="Escreva um comentário... (Ctrl+Enter para enviar)"
                    rows={2}
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/20 focus:border-[#1e3a5f]"
                    autoFocus
                  />
                  <button
                    onClick={sendComment}
                    disabled={!newComment.trim() || sendingComment}
                    className="px-4 py-2 bg-[#1e3a5f] text-white rounded-xl text-sm font-semibold hover:bg-[#162d4a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5 shrink-0">
                    {sendingComment
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />}
                    Enviar
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">Ctrl+Enter para enviar rapidamente</p>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
