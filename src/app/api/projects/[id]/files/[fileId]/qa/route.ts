import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface QAIssue {
  segmentId: string
  segmentOrder: number
  type: 'PLACEHOLDER' | 'NUMBER' | 'PUNCTUATION' | 'GLOSSARY'
  severity: 'error' | 'warning'
  message: string
  detail: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function extractPlaceholders(text: string): string[] {
  const found = new Set<string>()
  const patterns: RegExp[] = [
    /\{[^}]+\}/g,       // {placeholder}
    /\{\{[^}]+\}\}/g,   // {{placeholder}}
    /%[sdifgcbtqv%]/g,  // printf-style %s, %d, etc.
  ]
  for (const p of patterns)
    for (const m of text.match(p) ?? []) found.add(m)
  return [...found]
}

function extractNumbers(text: string): string[] {
  return [...new Set(text.match(/\b\d+(?:[.,]\d+)*\b/g) ?? [])]
}

// Accepted end-punctuation equivalents
const PUNCT_EXPECTED: Record<string, string[]> = {
  '.': ['.', '…'],
  '?': ['?'],
  '!': ['!'],
  ':': [':'],
  ';': [';'],
}

function endPunct(text: string): string {
  return text.trimEnd().at(-1) ?? ''
}

// ── Route ──────────────────────────────────────────────────────────────────────

// POST /api/projects/[id]/files/[fileId]/qa
// Runs QA checks on all confirmed/reviewed segments of the file.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const file = await db.projectFile.findUnique({
      where: { id: params.fileId },
      include: { project: true },
    })
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    if (file.projectId !== params.id) return NextResponse.json({ error: 'Arquivo não pertence a este projeto' }, { status: 400 })

    // Access control
    const role = session.user.role
    const userId = session.user.id
    if (role === 'EDITOR' && file.editorId !== userId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (role === 'REVISOR' && file.revisorId !== userId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    // Load confirmed segments
    const segments = await db.segment.findMany({
      where: { fileId: params.fileId, status: { in: ['CONFIRMED', 'REVIEWED'] } },
      orderBy: { order: 'asc' },
    })

    // Load non-forbidden termbase entries for this language pair
    const termbase = await db.termbase.findMany({
      where: {
        sourceLang: file.project.sourceLang,
        targetLang: file.project.targetLang,
        forbidden: false,
      },
    })

    // Load project-specific glossary terms
    const projectGlossary = await db.projectGlossaryTerm.findMany({
      where: { projectId: params.id },
    })

    const issues: QAIssue[] = []

    for (const seg of segments) {
      const src = seg.sourceText
      const tgt = seg.targetText ?? ''
      if (!tgt.trim()) continue

      // ── 1. Placeholders ────────────────────────────────────────────────────
      for (const ph of extractPlaceholders(src)) {
        if (!tgt.includes(ph)) {
          issues.push({
            segmentId: seg.id,
            segmentOrder: seg.order,
            type: 'PLACEHOLDER',
            severity: 'error',
            message: 'Placeholder ausente na tradução',
            detail: ph,
          })
        }
      }

      // ── 2. Numbers ─────────────────────────────────────────────────────────
      const srcNums = extractNumbers(src)
      const tgtNums = extractNumbers(tgt)
      for (const num of srcNums) {
        if (!tgtNums.includes(num)) {
          issues.push({
            segmentId: seg.id,
            segmentOrder: seg.order,
            type: 'NUMBER',
            severity: 'error',
            message: 'Número ausente na tradução',
            detail: num,
          })
        }
      }

      // ── 3. End punctuation ─────────────────────────────────────────────────
      const sp = endPunct(src)
      const tp = endPunct(tgt)
      if (sp && PUNCT_EXPECTED[sp] && !PUNCT_EXPECTED[sp].includes(tp)) {
        issues.push({
          segmentId: seg.id,
          segmentOrder: seg.order,
          type: 'PUNCTUATION',
          severity: 'warning',
          message: 'Pontuação divergente no final do segmento',
          detail: `Fonte: "${sp}" · Tradução: "${tp || '—'}"`,
        })
      }

      // ── 4. Glossário teológico global ─────────────────────────────────────
      for (const term of termbase) {
        const srcHasTerm = src.toLowerCase().includes(term.sourceTerm.toLowerCase())
        const tgtHasTerm = tgt.toLowerCase().includes(term.targetTerm.toLowerCase())
        if (srcHasTerm && !tgtHasTerm) {
          issues.push({
            segmentId: seg.id,
            segmentOrder: seg.order,
            type: 'GLOSSARY',
            severity: 'warning',
            message: 'Termo do glossário ausente na tradução',
            detail: `"${term.sourceTerm}" → "${term.targetTerm}"`,
          })
        }
      }

      // ── 5. Glossário do projeto ────────────────────────────────────────────
      for (const term of projectGlossary) {
        const srcHasTerm = src.toLowerCase().includes(term.sourceTerm.toLowerCase())
        const tgtHasTerm = tgt.toLowerCase().includes(term.targetTerm.toLowerCase())
        if (srcHasTerm && !tgtHasTerm) {
          issues.push({
            segmentId: seg.id,
            segmentOrder: seg.order,
            type: 'GLOSSARY',
            severity: 'warning',
            message: 'Termo do glossário do projeto ausente na tradução',
            detail: `"${term.sourceTerm}" → "${term.targetTerm}"`,
          })
        }
      }
    }

    return NextResponse.json({ issues, total: issues.length })
  } catch (error) {
    console.error('[POST /api/projects/:id/files/:fileId/qa]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
