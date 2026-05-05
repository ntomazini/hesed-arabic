'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Plus, X } from 'lucide-react'
import { clsx } from 'clsx'
import type { TermbaseEntry } from '@/types'

interface TermbasePanelProps {
  sourceText: string
  sourceLang: string
  targetLang: string
}

// ─── Mock theological termbase ────────────────────────────────────────────────
const ALL_TERMS: TermbaseEntry[] = [
  {
    id: 'tb1',
    sourceTerm: 'charity',
    targetTerm: 'amor',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'ἀγάπη (agape) — amor incondicional, divino e sacrificial',
    context: '1 Co 13',
    domain: 'theology',
    notes: 'Preferir "amor" a "caridade" (arcaico). ARC usa "caridade"; NVI usa "amor".',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'tb2',
    sourceTerm: 'faith',
    targetTerm: 'fé',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'πίστις (pistis) — confiança, crença, lealdade',
    context: 'NT geral',
    domain: 'theology',
    notes: 'Nunca usar "fidelidade" como tradução de pistis em contextos soteriológicos.',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'tb3',
    sourceTerm: 'hope',
    targetTerm: 'esperança',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'ἐλπίς (elpis) — expectativa certa, não mera possibilidade',
    context: '1 Co 13:13',
    domain: 'theology',
    notes: 'No NT, "esperança" carrega certeza escatológica.',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'tb4',
    sourceTerm: 'prophecy',
    targetTerm: 'profecia',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'προφητεία (propheteia) — anúncio da Palavra divina, não apenas predição futura',
    context: '1 Co 12–14',
    domain: 'theology',
    notes: 'Incluir nota ao leitor distinguindo "profecia" de "predição".',
    createdAt: '2026-01-11T00:00:00Z',
  },
  {
    id: 'tb5',
    sourceTerm: 'tongues',
    targetTerm: 'línguas',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'γλῶσσαι (glossai) — don de falar em línguas (glossolalia)',
    context: '1 Co 12–14',
    domain: 'theology',
    notes: 'Usar sempre "línguas", não "idiomas".',
    createdAt: '2026-01-11T00:00:00Z',
  },
  {
    id: 'tb6',
    sourceTerm: 'angels',
    targetTerm: 'anjos',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'ἄγγελοι (angeloi) — mensageiros celestiais',
    domain: 'theology',
    createdAt: '2026-01-12T00:00:00Z',
  },
  {
    id: 'tb7',
    sourceTerm: 'mystery',
    targetTerm: 'mistério',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'μυστήριον (mysterion) — verdade oculta agora revelada',
    domain: 'theology',
    notes: 'Não confundir com "segredo". Mistério bíblico é algo antes velado, agora revelado.',
    createdAt: '2026-01-12T00:00:00Z',
  },
  {
    id: 'tb8',
    sourceTerm: 'knowledge',
    targetTerm: 'conhecimento',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'γνῶσις (gnosis) — conhecimento espiritual/teológico',
    context: '1 Co 13:2',
    domain: 'theology',
    createdAt: '2026-01-13T00:00:00Z',
  },
  {
    id: 'tb9',
    sourceTerm: 'perfect',
    targetTerm: 'perfeito',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'τέλειος (teleios) — completo, maduro, chegando ao telos (fim/propósito)',
    context: '1 Co 13:10',
    domain: 'theology',
    notes: 'Alguns traduzem como "pleno" ou "completo". "Perfeito" é aceito.',
    createdAt: '2026-01-13T00:00:00Z',
  },
  {
    id: 'tb10',
    sourceTerm: 'abide',
    targetTerm: 'permanecer',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    definition: 'μένω (meno) — permanecer, continuar, habitar',
    context: '1 Co 13:13',
    domain: 'theology',
    notes: 'Preferir "permanecer" a "ficar".',
    createdAt: '2026-01-14T00:00:00Z',
  },
]

interface AddTermModalProps {
  onClose: () => void
  onAdd: (entry: Omit<TermbaseEntry, 'id' | 'createdAt'>) => void
  sourceLang: string
  targetLang: string
}

function AddTermModal({ onClose, onAdd, sourceLang, targetLang }: AddTermModalProps) {
  const [form, setForm] = useState({
    sourceTerm: '',
    targetTerm: '',
    definition: '',
    notes: '',
    domain: 'theology',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.sourceTerm.trim() || !form.targetTerm.trim()) return
    onAdd({ ...form, sourceLang, targetLang, context: undefined })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Adicionar Termo</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Termo Fonte ({sourceLang})
              </label>
              <input
                value={form.sourceTerm}
                onChange={(e) => setForm({ ...form, sourceTerm: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                placeholder="ex: faith"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Termo Alvo ({targetLang})
              </label>
              <input
                value={form.targetTerm}
                onChange={(e) => setForm({ ...form, targetTerm: e.target.value })}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
                placeholder="ex: fé"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Definição</label>
            <input
              value={form.definition}
              onChange={(e) => setForm({ ...form, definition: e.target.value })}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30"
              placeholder="Definição teológica..."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 resize-none"
              placeholder="Notas de uso..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#1e3a5f] rounded-lg hover:bg-[#1e40af]"
            >
              Adicionar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function TermbasePanel({ sourceText, sourceLang, targetLang }: TermbasePanelProps) {
  const [foundTerms, setFoundTerms] = useState<TermbaseEntry[]>([])
  const [showModal, setShowModal] = useState(false)
  const [extraTerms, setExtraTerms] = useState<TermbaseEntry[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (!sourceText.trim()) {
      setFoundTerms([])
      return
    }

    const lower = sourceText.toLowerCase()
    const found = ALL_TERMS.filter(
      (t) =>
        t.sourceLang === sourceLang &&
        t.targetLang === targetLang &&
        lower.includes(t.sourceTerm.toLowerCase())
    )
    setFoundTerms(found)
  }, [sourceText, sourceLang, targetLang])

  const allTerms = [...foundTerms, ...extraTerms]

  const handleAddTerm = (entry: Omit<TermbaseEntry, 'id' | 'createdAt'>) => {
    const newTerm: TermbaseEntry = {
      ...entry,
      id: `extra-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    setExtraTerms((prev) => [newTerm, ...prev])
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
        <BookOpen className="w-4 h-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Termbase</span>
        {allTerms.length > 0 && (
          <span className="ml-auto text-xs text-slate-400">{allTerms.length} termo{allTerms.length !== 1 ? 's' : ''}</span>
        )}
        <button
          onClick={() => setShowModal(true)}
          className="ml-auto flex items-center gap-1 text-xs text-[#1e3a5f] hover:text-blue-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {allTerms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <BookOpen className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-sm text-slate-400 font-medium">Nenhum termo encontrado</p>
            <p className="text-xs text-slate-300 mt-1">
              Os termos do segmento ativo aparecem aqui automaticamente
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {allTerms.map((term) => (
              <li key={term.id} className="p-3">
                <button
                  className="w-full text-left"
                  onClick={() => setExpandedId(expandedId === term.id ? null : term.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 flex-shrink-0">
                      TB
                    </span>
                    <span className="text-sm font-medium text-slate-800">{term.sourceTerm}</span>
                    <span className="text-slate-400 text-xs">→</span>
                    <span className="text-sm font-semibold text-[#1e3a5f]">{term.targetTerm}</span>
                  </div>
                </button>

                {expandedId === term.id && (
                  <div className="mt-2 pl-7 space-y-1.5">
                    {term.definition && (
                      <p className="text-xs text-slate-500 leading-relaxed">{term.definition}</p>
                    )}
                    {term.context && (
                      <p className="text-[10px] text-slate-400">
                        <span className="font-medium">Contexto:</span> {term.context}
                      </p>
                    )}
                    {term.notes && (
                      <div className="bg-amber-50 border border-amber-100 rounded p-2">
                        <p className="text-[10px] text-amber-700 leading-relaxed">{term.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showModal && (
        <AddTermModal
          onClose={() => setShowModal(false)}
          onAdd={handleAddTerm}
          sourceLang={sourceLang}
          targetLang={targetLang}
        />
      )}
    </div>
  )
}
