'use client'

import { useState, useEffect } from 'react'
import { Database, ChevronRight, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { TMMatch } from '@/types'

interface TMPanelProps {
  segmentId: string
  sourceText: string
  onUseSuggestion: (text: string) => void
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const MOCK_TM: Record<string, TMMatch[]> = {
  default: [
    {
      id: 'tm1',
      score: 100,
      sourceText: 'For now we see through a glass, darkly; but then face to face: now I know in part; but then shall I know even as also I am known.',
      targetText: 'Porque agora vemos por espelho em enigma, mas então veremos face a face; agora conheço em parte, mas então conhecerei como também sou conhecido.',
      sourceLang: 'en',
      targetLang: 'pt-BR',
      createdAt: '2026-02-10T09:00:00Z',
      usedCount: 14,
    },
    {
      id: 'tm2',
      score: 92,
      sourceText: 'For now we see through a glass, darkly; but then face to face.',
      targetText: 'Porque agora vemos por espelho, em enigma; mas então veremos face a face.',
      sourceLang: 'en',
      targetLang: 'pt-BR',
      createdAt: '2026-01-20T14:30:00Z',
      usedCount: 7,
    },
    {
      id: 'tm3',
      score: 85,
      sourceText: 'Now I know in part; but then shall I know even as also I am known.',
      targetText: 'Agora conheço em parte; mas então conhecerei como também sou conhecido.',
      sourceLang: 'en',
      targetLang: 'pt-BR',
      createdAt: '2026-01-05T11:15:00Z',
      usedCount: 3,
    },
    {
      id: 'tm4',
      score: 78,
      sourceText: 'but then face to face: now I know in part',
      targetText: 'mas então veremos face a face; agora conheço em parte',
      sourceLang: 'en',
      targetLang: 'pt-BR',
      createdAt: '2025-12-18T08:45:00Z',
      usedCount: 1,
    },
  ],
  seg1: [
    {
      id: 'tm-s1-1',
      score: 100,
      sourceText: 'Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal.',
      targetText: 'Ainda que eu falasse as línguas dos homens e dos anjos, e não tivesse amor, seria como o metal que soa ou como o sino que tine.',
      sourceLang: 'en',
      targetLang: 'pt-BR',
      createdAt: '2026-01-15T10:00:00Z',
      usedCount: 22,
    },
  ],
}

function scoreBadge(score: number) {
  const classes =
    score === 100
      ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
      : score >= 75
      ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300'
      : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200'

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center w-12 h-6 rounded text-xs font-bold flex-shrink-0',
        classes
      )}
    >
      {score}%
    </span>
  )
}

export default function TMPanel({ segmentId, sourceText, onUseSuggestion }: TMPanelProps) {
  const [matches, setMatches] = useState<TMMatch[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!sourceText.trim()) return

    setLoading(true)

    // Simulate API call delay
    const timer = setTimeout(() => {
      const key = segmentId in MOCK_TM ? segmentId : 'default'
      setMatches(MOCK_TM[key] ?? [])
      setLoading(false)
    }, 350)

    return () => clearTimeout(timer)
  }, [segmentId, sourceText])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <Database className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Translation Memory
        </span>
        {!loading && matches.length > 0 && (
          <span className="ml-auto text-xs text-slate-400">{matches.length} match{matches.length !== 1 ? 'es' : ''}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-slate-300 animate-spin" />
          </div>
        ) : matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Database className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400 font-medium">Nenhuma correspondência</p>
            <p className="text-xs text-slate-300 mt-1">Selecione um segmento para buscar na TM</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {matches.map((match) => (
              <li key={match.id} className="p-3 hover:bg-slate-50/70 transition-colors group">
                <div className="flex items-start gap-2 mb-2">
                  {scoreBadge(match.score)}
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 flex-1">
                    {match.sourceText}
                  </p>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed mb-2 pl-14 font-medium">
                  {match.targetText}
                </p>

                <div className="flex items-center justify-between pl-14">
                  <span className="text-[10px] text-slate-300">
                    Usado {match.usedCount}x
                  </span>
                  <button
                    onClick={() => onUseSuggestion(match.targetText)}
                    className="inline-flex items-center gap-1 text-xs text-[#1e3a5f] hover:text-blue-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Usar
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
