'use client'

import { useState, useEffect } from 'react'
import { Sparkles, ChevronRight, Loader2, ChevronDown } from 'lucide-react'
import type { Segment, AISuggestion } from '@/types'

interface AIPanelProps {
  segment: Segment | null
  onUseSuggestion: (text: string) => void
}

// ─── Mock AI suggestions per segment ─────────────────────────────────────────
const MOCK_AI: Record<string, AISuggestion> = {
  seg1: {
    translation:
      'Ainda que eu falasse as línguas dos homens e dos anjos, e não tivesse amor, seria como o metal que soa ou como o sino que tine.',
    confidence: 0.97,
    theologicalNote:
      'Paulo usa ἀγάπη (agape) e não φιλία (philia) nem ἔρως (eros). A tradução "amor" é a mais adequada no contexto da teologia paulina, seguindo a tradição da NVI e da Bíblia de Jerusalém. Evitar "caridade" (ARC), que em português contemporâneo remete a assistencialismo.',
    contextNote: '1 Coríntios 13:1 — Hino ao Amor. Abertura do discurso sobre os dons espirituais.',
    alternates: [
      'Se eu falasse em línguas humanas e angelicais, sem amor, sou metal barulhento, sino retinindo.',
    ],
  },
  seg2: {
    translation: 'E ainda que eu tivesse o dom de profecia, e conhecesse todos os mistérios e toda a ciência, e ainda que tivesse toda a fé, de maneira tal que transportasse os montes, e não tivesse amor, nada seria.',
    confidence: 0.95,
    theologicalNote:
      'O termo γνῶσις (gnosis) deve ser traduzido por "conhecimento" e não "ciência" num sentido moderno. Contudo, "ciência" é aceitável no registro poético do texto. A construção condicional (κἄν... κἄν...) deve ser mantida em paralelo.',
    contextNote: '1 Coríntios 13:2 — Paulo continua o argumento: dons sem amor são inúteis.',
    alternates: [
      'E se eu tiver profecia, e souber todos os mistérios e todo o conhecimento, e tiver toda fé a ponto de mover montanhas, mas não tiver amor, não serei nada.',
    ],
  },
  seg3: {
    translation: 'E ainda que distribuísse todos os meus bens para sustento dos pobres, e ainda que entregasse o meu corpo para ser queimado, e não tivesse amor, nada disso me aproveitaria.',
    confidence: 0.93,
    theologicalNote:
      'A variante textual "para se gloriar" (καυχήσωμαι) vs "para ser queimado" (καυθήσωμαι) é disputada. Os melhores manuscritos favorecem "para que me glorie". Muitas versões seguem "queimado" por tradição. Recomenda-se nota de rodapé explicando a variante.',
    contextNote: '1 Coríntios 13:3 — Clímax da seção introdutória: nem o sacrifício extremo substitui o amor.',
    alternates: [
      'Se eu der todos os meus bens aos pobres e entregar meu corpo para me gloriar, sem amor, de nada me vale.',
    ],
  },
  seg4: {
    translation: 'O amor é sofredor, é benigno; o amor não é invejoso; o amor não trata com leviandade, não se ensoberbece.',
    confidence: 0.91,
    theologicalNote:
      'μακροθυμεῖ (makrothymei) é literalmente "tem coração comprido" — paciência prolongada. "Sofredor" (ARC) é válido no registro poético. "Paciente" é mais usual (NVI). χρηστεύεται (chresteuetai) é hápax legomenon — único uso no NT. "Benigno" é a tradução tradicional.',
    contextNote: '1 Coríntios 13:4 — Início da lista de 15 características do amor.',
  },
  seg5: {
    translation: 'Não se porta com indecência, não busca os seus próprios interesses, não se irrita, não suspeita mal.',
    confidence: 0.89,
    theologicalNote:
      'οὐ ζητεῖ τὰ ἑαυτῆς — literalmente "não busca as [coisas] de si mesma". A tradução "não busca seus próprios interesses" é mais clara que "não busca o seu" (ARC).',
    contextNote: '1 Coríntios 13:5 — Continuação das características negativas do amor (o que ele não faz).',
  },
  default: {
    translation: '[Selecione um segmento para ver a sugestão da IA]',
    confidence: 0,
    theologicalNote: undefined,
    contextNote: undefined,
  },
}

function ConfidenceDot({ score }: { score: number }) {
  const color =
    score >= 0.9
      ? 'bg-green-400'
      : score >= 0.75
      ? 'bg-yellow-400'
      : score > 0
      ? 'bg-orange-400'
      : 'bg-slate-200'

  const label =
    score >= 0.9
      ? 'Alta confiança'
      : score >= 0.75
      ? 'Confiança moderada'
      : score > 0
      ? 'Baixa confiança'
      : ''

  if (!label) return null

  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-400">
      <span className={`w-2 h-2 rounded-full ${color} flex-shrink-0`} />
      {label} ({Math.round(score * 100)}%)
    </span>
  )
}

export default function AIPanel({ segment, onUseSuggestion }: AIPanelProps) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAlternates, setShowAlternates] = useState(false)

  useEffect(() => {
    if (!segment) {
      setSuggestion(null)
      return
    }

    setLoading(true)
    setShowAlternates(false)

    const timer = setTimeout(() => {
      const key = segment.id in MOCK_AI ? segment.id : 'default'
      setSuggestion(MOCK_AI[key])
      setLoading(false)
    }, 600)

    return () => clearTimeout(timer)
  }, [segment?.id])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <Sparkles className="w-4 h-4 text-violet-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          Sugestão IA
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-5 h-5 text-violet-300 animate-spin" />
            <p className="text-xs text-slate-400">Gerando sugestão contextual...</p>
          </div>
        ) : !suggestion || suggestion.confidence === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Sparkles className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400 font-medium">Nenhum segmento selecionado</p>
            <p className="text-xs text-slate-300 mt-1">
              Clique em um segmento para ver a sugestão da IA
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Confidence */}
            <ConfidenceDot score={suggestion.confidence} />

            {/* Translation suggestion */}
            <div className="bg-violet-50 border border-violet-100 rounded-lg p-3">
              <p className="text-xs font-semibold text-violet-600 mb-2 uppercase tracking-wide">
                Tradução Sugerida
              </p>
              <p className="text-sm text-slate-800 leading-relaxed">{suggestion.translation}</p>
              <button
                onClick={() => onUseSuggestion(suggestion.translation)}
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-violet-700 hover:text-violet-900"
              >
                Usar esta sugestão
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Theological note */}
            {suggestion.theologicalNote && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Nota Teológica
                </p>
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <p className="text-xs text-amber-800 leading-relaxed">{suggestion.theologicalNote}</p>
                </div>
              </div>
            )}

            {/* Context note */}
            {suggestion.contextNote && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Contexto
                </p>
                <p className="text-xs text-slate-500 leading-relaxed italic">{suggestion.contextNote}</p>
              </div>
            )}

            {/* Alternates */}
            {suggestion.alternates && suggestion.alternates.length > 0 && (
              <div className="space-y-1.5">
                <button
                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                  onClick={() => setShowAlternates(!showAlternates)}
                >
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showAlternates ? 'rotate-180' : ''}`}
                  />
                  Traduções Alternativas
                </button>
                {showAlternates && (
                  <ul className="space-y-2">
                    {suggestion.alternates.map((alt, i) => (
                      <li key={i} className="border border-slate-100 rounded-lg p-3 group">
                        <p className="text-xs text-slate-600 leading-relaxed">{alt}</p>
                        <button
                          onClick={() => onUseSuggestion(alt)}
                          className="mt-2 text-xs text-[#1e3a5f] hover:text-blue-700 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Usar esta
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
