'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import {
  Check,
  CheckCheck,
  Flag,
  MessageSquare,
  AlertCircle,
  X,
} from 'lucide-react'
import { clsx } from 'clsx'
import type { Segment } from '@/types'

interface SegmentItemProps {
  segment: Segment
  isActive: boolean
  onConfirm: (text: string) => void
  onFlag: () => void
  role: 'editor' | 'revisor'
  onReject?: (comment: string) => void
}

// Highlight {1}, {2}, etc. placeholders in the text
function highlightPlaceholders(text: string): React.ReactNode[] {
  const parts = text.split(/(\{\d+\})/g)
  return parts.map((part, i) => {
    if (/^\{\d+\}$/.test(part)) {
      return (
        <mark
          key={i}
          className="bg-yellow-200 text-yellow-900 rounded px-0.5 font-mono text-xs not-italic"
        >
          {part}
        </mark>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function SourceBadge({ source, tmScore }: { source?: string | null; tmScore?: number | null }) {
  if (!source) return null
  const map: Record<string, { label: string; title: string; cls: string }> = {
    TM:     { label: '◈ TM',     title: `Memória de Tradução${tmScore ? ` (${tmScore}%)` : ''}`, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    AQUIFER: { label: '◈ Aquifer', title: 'Base bíblica Aquifer',                               cls: 'bg-sky-50 text-sky-700 border-sky-200' },
    DEEPL:  { label: '◈ DeepL',  title: 'Traduzido por DeepL',                                  cls: 'bg-violet-50 text-violet-700 border-violet-200' },
    CLAUDE: { label: '◈ Claude', title: 'Traduzido por Claude (Anthropic)',                      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    OPENAI: { label: '◈ GPT',    title: 'Traduzido por OpenAI',                                  cls: 'bg-teal-50 text-teal-700 border-teal-200' },
  }
  const b = map[source]
  if (!b) return null
  return (
    <span title={b.title} className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border select-none ${b.cls}`}>
      {b.label}
    </span>
  )
}

function StatusBadge({ status, role }: { status: Segment['status']; role: 'editor' | 'revisor' }) {
  if (status === 'CONFIRMED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
        <Check className="w-3 h-3" />
        CONFIRMADO
      </span>
    )
  }
  if (status === 'REVIEWED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
        <CheckCheck className="w-3 h-3" />
        REVISADO
      </span>
    )
  }
  if (status === 'REJECTED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
        <AlertCircle className="w-3 h-3" />
        DEVOLVIDO
      </span>
    )
  }
  if (role === 'revisor') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
        REVISANDO
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
      NÃO REVISADO
    </span>
  )
}

function formatTimestamp(ts: string | null | undefined): string {
  if (!ts) return ''
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SegmentItem({
  segment,
  isActive,
  onConfirm,
  onFlag,
  role,
  onReject,
}: SegmentItemProps) {
  const [draftText, setDraftText] = useState(segment.targetText)
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const rejectRef = useRef<HTMLTextAreaElement>(null)

  // Sync draft with incoming segment changes (e.g. when AI suggestion is applied)
  useEffect(() => {
    setDraftText(segment.targetText)
  }, [segment.targetText])

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [draftText, autoResize])

  // Focus textarea when segment becomes active (editor only)
  useEffect(() => {
    if (isActive && role === 'editor') {
      textareaRef.current?.focus()
    }
  }, [isActive, role])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      onConfirm(draftText)
    }
  }

  const isReadonly = role === 'revisor'
  const isConfirmed = segment.status === 'CONFIRMED'
  const isReviewed = segment.status === 'REVIEWED'
  const isRejected = segment.status === 'REJECTED'

  return (
    <div
      className={clsx(
        'relative border-l-4 rounded-r-lg transition-all duration-150',
        isActive
          ? 'border-l-blue-500 bg-blue-50/60 shadow-sm'
          : isReviewed
          ? 'border-l-green-400 bg-green-50/30'
          : isConfirmed
          ? 'border-l-blue-300 bg-white'
          : isRejected
          ? 'border-l-red-400 bg-red-50/30'
          : 'border-l-slate-200 bg-white hover:border-l-slate-300'
      )}
    >
      <div className="p-3">
        {/* Segment number + source text */}
        <div className="flex items-start gap-3 mb-2">
          <span className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 text-xs font-semibold mt-0.5">
            {segment.order}
          </span>
          <p className="text-sm text-slate-400 leading-relaxed flex-1 select-text">
            {highlightPlaceholders(segment.sourceText)}
          </p>
        </div>

        {/* Translation textarea or readonly display */}
        <div className="ml-10">
          {isReadonly ? (
            <div
              className={clsx(
                'text-sm leading-relaxed rounded-lg px-3 py-2 border',
                isReviewed
                  ? 'bg-green-50 border-green-200 text-slate-700'
                  : isRejected
                  ? 'bg-red-50 border-red-200 text-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              )}
            >
              {draftText || (
                <span className="text-slate-300 italic">Sem tradução</span>
              )}
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={draftText}
              onChange={(e) => {
                setDraftText(e.target.value)
                autoResize()
              }}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Digite a tradução... (Ctrl+Enter para confirmar)"
              className={clsx(
                'w-full text-sm text-slate-800 leading-relaxed rounded-lg px-3 py-2 border resize-none',
                'focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400',
                'placeholder:text-slate-300',
                isConfirmed ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'
              )}
            />
          )}

          {/* Meta row: fonte da tradução + status + user info + ações */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Badge de origem da pré-tradução */}
            <SourceBadge source={segment.translationSource} tmScore={segment.tmScore} />

            {/* Status badge */}
            <StatusBadge status={segment.status} role={role} />

            {/* User + timestamp */}
            {(isConfirmed || isReviewed) && segment.editor && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <span className="font-medium text-slate-500">{segment.editor.name}</span>
                <span>·</span>
                <span>{segment.editor.email}</span>
                {segment.confirmedAt && (
                  <>
                    <span>·</span>
                    <span>{formatTimestamp(segment.confirmedAt)}</span>
                  </>
                )}
              </span>
            )}

            {/* Comment if rejected */}
            {isRejected && segment.comment && (
              <span className="text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded">
                {segment.comment}
              </span>
            )}

            {/* Action buttons — pushed to right */}
            <div className="ml-auto flex items-center gap-1">
              {/* Flag button */}
              <button
                onClick={onFlag}
                title="Marcar como problema"
                className={clsx(
                  'p-1 rounded transition-colors',
                  segment.flagged
                    ? 'text-orange-500 hover:text-orange-600'
                    : 'text-slate-300 hover:text-slate-500'
                )}
              >
                <Flag className="w-3.5 h-3.5" />
              </button>

              {/* Comment placeholder */}
              {segment.comment && (
                <button
                  title={segment.comment}
                  className="p-1 rounded text-blue-400 hover:text-blue-600 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Editor: Confirm button */}
              {!isReadonly && (
                <button
                  onClick={() => onConfirm(draftText)}
                  disabled={!draftText.trim()}
                  title="Confirmar segmento (Ctrl+Enter)"
                  className={clsx(
                    'ml-1 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors',
                    draftText.trim()
                      ? 'bg-[#1e3a5f] text-white hover:bg-[#1e40af]'
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  )}
                >
                  <Check className="w-3 h-3" />
                  Confirmar
                </button>
              )}

              {/* Revisor: Approve button */}
              {isReadonly && !isReviewed && !isRejected && (
                <>
                  <button
                    onClick={() => onConfirm(draftText)}
                    title="Aprovar segmento"
                    className="ml-1 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Aprovar
                  </button>
                  <button
                    onClick={() => setShowRejectBox(!showRejectBox)}
                    title="Devolver ao editor"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    <X className="w-3 h-3" />
                    Devolver
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Revisor: Reject comment box */}
          {showRejectBox && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg space-y-2">
              <textarea
                ref={rejectRef}
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Descreva o motivo da devolução..."
                rows={2}
                className="w-full text-xs text-slate-700 rounded px-2 py-1.5 border border-red-200 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowRejectBox(false)
                    setRejectComment('')
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (onReject) onReject(rejectComment)
                    setShowRejectBox(false)
                    setRejectComment('')
                  }}
                  className="text-xs font-semibold text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-lg"
                >
                  Confirmar devolução
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
