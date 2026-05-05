'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Save,
  Send,
  ChevronLeft,
  FileText,
  Database,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'
import SegmentList from '@/components/editor/SegmentList'
import TMPanel from '@/components/editor/TMPanel'
import TermbasePanel from '@/components/editor/TermbasePanel'
import AIPanel from '@/components/editor/AIPanel'
import Badge from '@/components/ui/Badge'
import type { Segment } from '@/types'

// ─── Mock segments (1 Coríntios 13, EN → PT-BR) ───────────────────────────────
const MOCK_SEGMENTS: Segment[] = [
  {
    id: 'seg1',
    fileId: 'file1',
    order: 1,
    sourceText:
      'Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal.',
    targetText:
      'Ainda que eu falasse as línguas dos homens e dos anjos, e não tivesse amor, seria como o metal que soa ou como o sino que tine.',
    status: 'CONFIRMED',
    tmScore: 100,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T14:23:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T14:23:00Z',
  },
  {
    id: 'seg2',
    fileId: 'file1',
    order: 2,
    sourceText:
      'And though I have the gift of prophecy, and understand all mysteries, and all knowledge; and though I have all faith, so that I could remove mountains, and have not charity, I am nothing.',
    targetText:
      'E ainda que eu tivesse o dom de profecia, e conhecesse todos os mistérios e toda a ciência, e ainda que tivesse toda a fé, de maneira tal que transportasse os montes, e não tivesse amor, nada seria.',
    status: 'CONFIRMED',
    tmScore: 92,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T14:35:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T14:35:00Z',
  },
  {
    id: 'seg3',
    fileId: 'file1',
    order: 3,
    sourceText:
      'And though I bestow all my goods to feed the poor, and though I give my body to be burned, and have not charity, it profiteth me nothing.',
    targetText:
      'E ainda que distribuísse todos os meus bens para sustento dos pobres, e ainda que entregasse o meu corpo para ser queimado, e não tivesse amor, nada disso me aproveitaria.',
    status: 'CONFIRMED',
    tmScore: 85,
    flagged: true,
    comment: 'Verificar variante textual: "queimado" vs "gloriar-se"',
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T14:40:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T14:40:00Z',
  },
  {
    id: 'seg4',
    fileId: 'file1',
    order: 4,
    sourceText:
      'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg5',
    fileId: 'file1',
    order: 5,
    sourceText:
      'Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil;',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg6',
    fileId: 'file1',
    order: 6,
    sourceText: 'Rejoiceth not in iniquity, but rejoiceth in the truth;',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg7',
    fileId: 'file1',
    order: 7,
    sourceText:
      'Beareth all things, believeth all things, hopeth all things, endureth all things.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg8',
    fileId: 'file1',
    order: 8,
    sourceText:
      'Charity never faileth: but whether there be prophecies, they shall fail; whether there be tongues, they shall cease; whether there be knowledge, it shall vanish away.',
    targetText: '',
    status: 'PENDING',
    tmScore: 78,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg9',
    fileId: 'file1',
    order: 9,
    sourceText: 'For now we know in part, and we prophesy in part.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg10',
    fileId: 'file1',
    order: 10,
    sourceText:
      'But when that which is perfect is come, then that which is in part shall be done away.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg11',
    fileId: 'file1',
    order: 11,
    sourceText:
      'When I was a child, I spake as a child, I understood as a child, I thought as a child: but when I became a man, I put away childish things.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg12',
    fileId: 'file1',
    order: 12,
    sourceText:
      'For now we see through a glass, darkly; but then face to face: now I know in part; but then shall I know even as also I am known.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
  {
    id: 'seg13',
    fileId: 'file1',
    order: 13,
    sourceText:
      'And now abideth faith, hope, charity, these three; but the greatest of these is charity.',
    targetText: '',
    status: 'PENDING',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: null,
    revisor: null,
    confirmedAt: null,
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-09T08:00:00Z',
  },
]

type SideTab = 'tm' | 'tb' | 'ai'

const TOTAL_SEGMENTS = 84
const TOTAL_WORDS = 906

export default function EditorPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const fileId = params.fileId as string

  const [segments, setSegments] = useState<Segment[]>(MOCK_SEGMENTS)
  const [activeSegmentId, setActiveSegmentId] = useState<string>('seg4')
  const [sideTab, setSideTab] = useState<SideTab>('tm')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const activeSegment = segments.find((s) => s.id === activeSegmentId) ?? null

  const confirmedCount = segments.filter(
    (s) => s.status === 'CONFIRMED' || s.status === 'REVIEWED'
  ).length

  // Update segment text from AI/TM suggestion
  const applyTargetText = useCallback(
    (text: string) => {
      if (!activeSegmentId) return
      setSegments((prev) =>
        prev.map((s) => (s.id === activeSegmentId ? { ...s, targetText: text } : s))
      )
    },
    [activeSegmentId]
  )

  // Confirm a segment and advance to next pending
  const handleConfirm = useCallback(
    async (segmentId: string, text: string) => {
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? {
                ...s,
                targetText: text,
                status: 'CONFIRMED',
                confirmedAt: new Date().toISOString(),
                editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
              }
            : s
        )
      )

      // Advance to next pending segment
      const currentIndex = segments.findIndex((s) => s.id === segmentId)
      const nextPending = segments.slice(currentIndex + 1).find((s) => s.status === 'PENDING')
      if (nextPending) {
        setActiveSegmentId(nextPending.id)
      }

      // Fire API in background
      try {
        await fetch(`/api/segments/${fileId}/${segmentId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetText: text, role: 'editor' }),
        })
      } catch {
        // Silent fail — state already updated optimistically
      }
    },
    [segments, fileId]
  )

  const handleFlag = useCallback((segmentId: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, flagged: !s.flagged } : s))
    )
  }, [])

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 700))
    setSaving(false)
    setLastSaved(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
  }

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const progressPct = Math.round((confirmedCount / TOTAL_SEGMENTS) * 100)

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white border-b border-slate-200 shadow-sm">
        <Link
          href={`/editor`}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="h-5 w-px bg-slate-200" />

        <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="font-semibold text-slate-800 text-sm truncate">
          1Corintios_Cap13.txt
        </span>

        <Badge variant="translating" />

        <div className="h-5 w-px bg-slate-200" />

        {/* Progress info */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-20 bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 bg-blue-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-medium text-slate-700">{confirmedCount}/{TOTAL_SEGMENTS} seg.</span>
          </div>
          <span className="text-slate-400">·</span>
          <span>238/{TOTAL_WORDS} palavras</span>
          {lastSaved && (
            <>
              <span className="text-slate-400">·</span>
              <span className="text-green-600">Salvo {lastSaved}</span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              'border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50'
            )}
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#1e3a5f] text-white hover:bg-[#1e40af] transition-colors">
            <Send className="w-3.5 h-3.5" />
            Enviar para Revisor
          </button>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: segment list (60%) ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
          <SegmentList
            segments={segments}
            activeSegmentId={activeSegmentId}
            onSegmentClick={setActiveSegmentId}
            onSegmentConfirm={handleConfirm}
            onSegmentFlag={handleFlag}
            role="editor"
          />
        </div>

        {/* ── Right: side panel (40%) ──────────────────────────────────── */}
        <div className="w-[38%] min-w-[320px] max-w-[520px] flex flex-col border-l border-slate-200 bg-white overflow-hidden">

          {/* Tab bar */}
          <div className="flex-shrink-0 flex border-b border-slate-200">
            {([
              { key: 'tm', label: 'TM', icon: Database },
              { key: 'tb', label: 'Termbase', icon: BookOpen },
              { key: 'ai', label: 'IA', icon: Sparkles },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSideTab(key)}
                className={clsx(
                  'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                  sideTab === key
                    ? 'border-[#1e3a5f] text-[#1e3a5f]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {sideTab === 'tm' && (
              <TMPanel
                segmentId={activeSegmentId}
                sourceText={activeSegment?.sourceText ?? ''}
                onUseSuggestion={applyTargetText}
              />
            )}
            {sideTab === 'tb' && (
              <TermbasePanel
                sourceText={activeSegment?.sourceText ?? ''}
                sourceLang="en"
                targetLang="pt-BR"
              />
            )}
            {sideTab === 'ai' && (
              <AIPanel
                segment={activeSegment}
                onUseSuggestion={applyTargetText}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
