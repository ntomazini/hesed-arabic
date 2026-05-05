// ── Pré-tradução automática ────────────────────────────────────────────────────
// Prioridade: Memória de Tradução → Aquifer → IA (DeepL → Claude)
// Chamado automaticamente após upload de arquivo E pelo botão manual do gerente.

import { db } from './db'
import { AQUIFER_READY, getDefaultBibleId, fetchVerseList } from './aquifer'
import { translateAuto } from './ai-translate'

export interface PretranslateResult {
  total:       number
  translated:  number
  fromTM:      number
  fromAquifer: number
  fromAI:      number
  errors:      number
}

// ── Função principal ──────────────────────────────────────────────────────────

export async function pretranslateFile(opts: {
  fileId:    string
  projectId: string
  srcLang:   string
  tgtLang:   string
  bookCode?: string | null
  provider?: 'auto' | 'deepl' | 'claude' | 'openai'
  // baseUrl e cookie mantidos por compatibilidade mas ignorados —
  // a tradução agora é feita diretamente sem HTTP self-call
  baseUrl?:  string
  cookie?:   string
}): Promise<PretranslateResult> {
  const { fileId, srcLang, tgtLang, bookCode } = opts

  const result: PretranslateResult = {
    total: 0, translated: 0, fromTM: 0, fromAquifer: 0, fromAI: 0, errors: 0,
  }

  // Segmentos pendentes
  const segments = await db.segment.findMany({
    where:   { fileId, status: 'PENDING' },
    orderBy: { order: 'asc' },
  })
  result.total = segments.length
  if (!segments.length) return result

  // Glossário global para contexto da IA
  const glossaryTerms = await db.termbase.findMany({
    where:  { sourceLang: srcLang, targetLang: tgtLang },
    select: { sourceTerm: true, targetTerm: true },
    take:   30,
  })

  // ── Pré-carrega versículos do Aquifer (se disponível e bookCode informado) ──
  let verseList: string[] = []
  if (AQUIFER_READY && bookCode) {
    const bibleId = await getDefaultBibleId(tgtLang)
    if (bibleId) {
      verseList = await fetchVerseList(bibleId, bookCode)
    } else {
      console.warn(`[pretranslate] Aquifer: nenhum Bible encontrado para "${tgtLang}"`)
    }
  }

  // ── Processa segmentos sequencialmente com delay entre chamadas à IA ────────
  // Evita esgotar o rate-limit dos provedores (Claude: 50 req/min, DeepL: similar).
  // Delay de 700ms entre chamadas à IA → ~85 req/min máx, bem abaixo do limite.
  const AI_DELAY_MS = 700

  const glossaryContext = glossaryTerms.length > 0
    ? glossaryTerms.map(t => `${t.sourceTerm} → ${t.targetTerm}`).join('\n')
    : ''

  for (const seg of segments) {
    try {
      let translation: string | null = null
      let tmScore: number | undefined
      let usedAI = false

      let translationSource: string | null = null

      // 1. Memória de Tradução (match exato)
      const tmMatch = await db.tMEntry.findFirst({
        where:   { sourceText: seg.sourceText, sourceLang: srcLang, targetLang: tgtLang },
        orderBy: { quality: 'desc' },
      })
      if (tmMatch?.targetText) {
        translation       = tmMatch.targetText
        tmScore           = 100
        translationSource = 'TM'
        result.fromTM++
      }

      // 2. Aquifer — por posição (segment.order → índice na lista de versículos)
      if (!translation && verseList.length > 0) {
        const idx = seg.order - 1
        if (idx >= 0 && idx < verseList.length && verseList[idx]) {
          translation       = verseList[idx]
          tmScore           = 90
          translationSource = 'AQUIFER'
          result.fromAquifer++
        }
      }

      // 3. IA — chama diretamente, sem paralelismo para não exceder rate-limit
      if (!translation) {
        const aiResult = await translateAuto(seg.sourceText, srcLang, tgtLang, glossaryContext)
        if (aiResult) {
          translation       = aiResult.translation
          translationSource = aiResult.provider.toUpperCase() // DEEPL | CLAUDE | OPENAI
          result.fromAI++
          usedAI = true
        }
      }

      if (!translation) { result.errors++; continue }

      await db.segment.update({
        where: { id: seg.id },
        data:  {
          targetText:        translation,
          status:            'TRANSLATING',
          tmScore:           tmScore ?? null,
          translationSource: translationSource,
        },
      })

      result.translated++

      // Pausa entre chamadas à IA para respeitar rate-limit dos provedores
      if (usedAI) await new Promise(r => setTimeout(r, AI_DELAY_MS))

    } catch (err) {
      console.error('[pretranslate] segment error:', (err as Error).message)
      result.errors++
    }
  }

  // Atualiza status do arquivo
  if (result.translated > 0) {
    await db.projectFile.update({
      where: { id: fileId },
      data:  { status: 'TRANSLATING', translatedSegments: result.translated },
    })
  }

  const src = [
    result.fromAquifer > 0 ? `${result.fromAquifer} Aquifer` : '',
    result.fromTM       > 0 ? `${result.fromTM} TM`          : '',
    result.fromAI       > 0 ? `${result.fromAI} IA`          : '',
  ].filter(Boolean).join(' | ')
  console.log(`[pretranslate] file=${fileId} → ${result.translated}/${result.total} (${src}) erros=${result.errors}`)

  return result
}
