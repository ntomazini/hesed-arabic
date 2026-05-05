'use client'

import { useState, useCallback, useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Send,
  ChevronLeft,
  FileText,
  Database,
  BookOpen,
  Sparkles,
  CheckCheck,
} from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'
import SegmentList from '@/components/editor/SegmentList'
import TMPanel from '@/components/editor/TMPanel'
import TermbasePanel from '@/components/editor/TermbasePanel'
import AIPanel from '@/components/editor/AIPanel'
import Badge from '@/components/ui/Badge'
import type { Segment } from '@/types'

// ─── Mock segments (1 Coríntios 13, traduzidos pelo editor, aguardando revisão) ──
const MOCK_SEGMENTS: Segment[] = [
  {
    id: 'seg1',
    fileId: 'file1',
    order: 1,
    sourceText:
      'Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal.',
    targetText:
      'Ainda que eu falasse as línguas dos homens e dos anjos, e não tivesse amor, seria como o metal que soa ou como o sino que tine.',
    status: 'REVIEWED',
    tmScore: 100,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: { id: 'u2', name: 'Pedro Gomes', email: 'pedro@hesed.org' },
    confirmedAt: '2026-04-10T14:23:00Z',
    reviewedAt: '2026-04-11T09:12:00Z',
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-11T09:12:00Z',
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
    status: 'REJECTED',
    tmScore: 85,
    flagged: true,
    comment: 'Tradução de "burned" contestada. Verificar variante textual grega. Preferir "gloriar-se".',
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: { id: 'u2', name: 'Pedro Gomes', email: 'pedro@hesed.org' },
    confirmedAt: '2026-04-10T14:40:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-11T09:20:00Z',
  },
  {
    id: 'seg4',
    fileId: 'file1',
    order: 4,
    sourceText:
      'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,',
    targetText:
      'O amor é sofredor, é benigno; o amor não é invejoso; o amor não trata com leviandade, não se ensoberbece.',
    status: 'CONFIRMED',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T15:00:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T15:00:00Z',
  },
  {
    id: 'seg5',
    fileId: 'file1',
    order: 5,
    sourceText:
      'Doth not behave itself unseemly, seeketh not her own, is not easily provoked, thinketh no evil;',
    targetText:
      'Não se porta com indecência, não busca os seus próprios interesses, não se irrita, não suspeita mal.',
    status: 'CONFIRMED',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T15:10:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T15:10:00Z',
  },
  {
    id: 'seg6',
    fileId: 'file1',
    order: 6,
    sourceText: 'Rejoiceth not in iniquity, but rejoiceth in the truth;',
    targetText: 'Não se alegra com a injustiça, mas alegra-se com a verdade.',
    status: 'CONFIRMED',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T15:15:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T15:15:00Z',
  },
  {
    id: 'seg7',
    fileId: 'file1',
    order: 7,
    sourceText:
      'Beareth all things, believeth all things, hopeth all things, endureth all things.',
    targetText: 'Tudo sofre, tudo crê, tudo espera, tudo suporta.',
    status: 'CONFIRMED',
    tmScore: null,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T15:20:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T15:20:00Z',
  },
  {
    id: 'seg8',
    fileId: 'file1',
    order: 8,
    sourceText:
      'Charity never faileth: but whether there be prophecies, they shall fail; whether there be tongues, they shall cease; whether there be knowledge, it shall vanish away.',
    targetText:
      'O amor nunca falha; mas havendo profecias, serão aniquiladas; havendo línguas, cessarão; havendo ciência, desaparecerá.',
    status: 'CONFIRMED',
    tmScore: 78,
    flagged: false,
    comment: null,
    editor: { id: 'u1', name: 'Ana Luiza', email: 'ana@hesed.org' },
    revisor: null,
    confirmedAt: '2026-04-10T15:30:00Z',
    reviewedAt: null,
    createdAt: '2026-04-09T08:00:00Z',
    updatedAt: '2026-04-10T15:30:00Z',
  },
]

type SideTab = 'tm' | 'tb' | 'ai'

const TOTAL_SEGMENTS = 84
const TOTAL_WORDS = 906

export default function RevisorPage() {
  const params = useParams()
  const fileId = params.fileId as string

  const [segments, setSegments] = useState<Segment[]>(MOCK_SEGMENTS)
  const [activeSegmentId, setActiveSegmentId] = useState<string>('seg2')
  const [sideTab, setSideTab] = useState<SideTab>('ai')

  const activeSegment = segments.find((s) => s.id === activeSegmentId) ?? null

  const reviewedCount = segments.filter((s) => s.status === 'REVIEWED').length
  const pendingCount = segments.filter((s) => s.status === 'CONFIRMED').length

  const progressPct = Math.round((reviewedCount / TOTAL_SEGMENTS) * 100)

  // Approve segment (CONFIRMED → REVIEWED)
  const handleApprove = useCallback(
    async (segmentId: string, text: string) => {
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? {
                ...s,
                status: 'REVIEWED',
                reviewedAt: new Date().toISOString(),
                revisor: { id: 'u2', name: 'Pedro Gomes', email: 'pedro@hesed.org' },
              }
            : s
        )
      )

      // Advance to next unreviewed confirmed segment
      const currentIndex = segments.findIndex((s) => s.id === segmentId)
      const nextPending = segments
        .slice(currentIndex + 1)
        .find((s) => s.status === 'CONFIRMED')
      if (nextPending) {
        setActiveSegmentId(nextPending.id)
      }

      try {
        await fetch(`/api/segments/${fileId}/${segmentId}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetText: text, role: 'revisor' }),
        })
      } catch {
        // Silent fail
      }
    },
    [segments, fileId]
  )

  // Reject segment (return to editor)
  const handleReject = useCallback(
    async (segmentId: string, comment: string) => {
      setSegments((prev) =>
        prev.map((s) =>
          s.id === segmentId
            ? {
                ...s,
                status: 'REJECTED',
                comment,
                flagged: true,
              }
            : s
        )
      )

      try {
        await fetch(`/api/segments/${fileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segmentId, status: 'REJECTED', comment }),
        })
      } catch {
        // Silent fail
      }
    },
    [fileId]
  )

  const handleFlag = useCallback((segmentId: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === segmentId ? { ...s, flagged: !s.flagged } : s))
    )
  }, [])

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] -m-6 overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-white border-b border-orange-200 shadow-sm">
        <Link
          href="/revisor"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0"
        >
          <ChevronLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="h-5 w-px bg-slate-200" />

        <FileText className="w-4 h-4 text-orange-400 flex-shrink-0" />
        <span className="font-semibold text-slate-800 text-sm truncate">
          1Corintios_Cap13.txt
        </span>

        <Badge variant="reviewing" />

        <div className="h-5 w-px bg-slate-200" />

        {/* Progress info */}
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <div className="w-20 bg-slate-100 rounded-full h-1.5">
              <div
                className="h-1.5 bg-orange-400 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-medium text-slate-700">{reviewedCount}/{TOTAL_SEGMENTS} revisados</span>
          </div>
          <span className="text-slate-400">·</span>
          <span className="text-orange-600 font-medium">{pendingCount} aguardando revisão</span>
        </div>

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-lg">
            <CheckCheck className="w-3.5 h-3.5 text-orange-500" />
            Modo Revisão
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#1e3a5f] text-white hover:bg-[#1e40af] transition-colors">
            <Send className="w-3.5 h-3.5" />
            Enviar para Gerente
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
            onSegmentConfirm={handleApprove}
            onSegmentFlag={handleFlag}
            onSegmentReject={handleReject}
            role="revisor"
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
                    ? 'border-orange-500 text-orange-600'
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
                onUseSuggestion={() => {}} // read-only in revisor mode
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
                onUseSuggestion={() => {}} // read-only in revisor mode
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
