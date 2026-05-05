import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import mammoth from 'mammoth'

type TmPair = { sourceLang: string; targetLang: string; sourceText: string; targetText: string }

// ── TMX parser ─────────────────────────────────────────────────────────────────
function parseTMX(xml: string): TmPair[] {
  const entries: TmPair[] = []
  const tuRegex = /<tu[^>]*>([\s\S]*?)<\/tu>/gi
  let tuMatch
  while ((tuMatch = tuRegex.exec(xml)) !== null) {
    const tuContent = tuMatch[1]
    const tuvRegex = /<tuv[^>]*xml:lang="([^"]+)"[^>]*>\s*<seg>([\s\S]*?)<\/seg>/gi
    const tuvs: Array<{ lang: string; text: string }> = []
    let tuvMatch
    while ((tuvMatch = tuvRegex.exec(tuContent)) !== null) {
      tuvs.push({ lang: tuvMatch[1], text: tuvMatch[2].replace(/<[^>]+>/g, '').trim() })
    }
    if (tuvs.length >= 2 && tuvs[0].text && tuvs[1].text) {
      entries.push({ sourceLang: tuvs[0].lang, sourceText: tuvs[0].text, targetLang: tuvs[1].lang, targetText: tuvs[1].text })
    }
  }
  return entries
}

// ── TXT / MD parser ────────────────────────────────────────────────────────────
// Format: each line = "source|||target" OR alternating lines (odd=source, even=target)
// Also supports tab-separated: "source\ttarget"
function parseTxtMd(text: string, sourceLang = 'en', targetLang = 'pt-BR'): TmPair[] {
  const entries: TmPair[] = []
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    // Try ||| separator first
    if (line.includes('|||')) {
      const [src, tgt] = line.split('|||').map(s => s.trim())
      if (src && tgt) entries.push({ sourceLang, targetLang, sourceText: src, targetText: tgt })
    // Try tab separator
    } else if (line.includes('\t')) {
      const parts = line.split('\t').map(s => s.trim())
      if (parts.length >= 2 && parts[0] && parts[1]) {
        entries.push({ sourceLang, targetLang, sourceText: parts[0], targetText: parts[1] })
      }
    }
  }
  // If no pairs found, try alternating lines
  if (entries.length === 0 && lines.length >= 2) {
    for (let i = 0; i + 1 < lines.length; i += 2) {
      if (lines[i] && lines[i + 1]) {
        entries.push({ sourceLang, targetLang, sourceText: lines[i], targetText: lines[i + 1] })
      }
    }
  }
  return entries
}

// ── HTML parser ────────────────────────────────────────────────────────────────
// Expects <table> with rows of 2+ <td> cells: [source, target]
function parseHTML(html: string, sourceLang = 'en', targetLang = 'pt-BR'): TmPair[] {
  const entries: TmPair[] = []
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    const cells: string[] = []
    let cellMatch
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].replace(/<[^>]+>/g, '').trim())
    }
    if (cells.length >= 2 && cells[0] && cells[1]) {
      entries.push({ sourceLang, targetLang, sourceText: cells[0], targetText: cells[1] })
    }
  }
  return entries
}

function parseContent(content: string, fileType: string, srcLang = 'en', tgtLang = 'pt-BR'): TmPair[] {
  const ext = fileType.replace('.', '').toLowerCase()
  if (ext === 'tmx' || ext === 'xml') return parseTMX(content)
  if (ext === 'html' || ext === 'htm') return parseHTML(content, srcLang, tgtLang)
  if (ext === 'txt' || ext === 'md' || ext === 'markdown') return parseTxtMd(content, srcLang, tgtLang)
  // fallback: try TMX
  return parseTMX(content)
}

// ── DOCX → HTML (via mammoth) then parse tables ────────────────────────────────
async function parseDocx(base64: string, srcLang = 'en', tgtLang = 'pt-BR'): Promise<TmPair[]> {
  const buffer = Buffer.from(base64, 'base64')
  const result = await mammoth.convertToHtml({ buffer })
  return parseHTML(result.value, srcLang, tgtLang)
}

// GET — list all TM entries
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q') ?? ''
    const sourceLang = searchParams.get('sourceLang')
    const targetLang = searchParams.get('targetLang')
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200)
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (sourceLang) where.sourceLang = sourceLang
    if (targetLang) where.targetLang = targetLang
    if (q) {
      where.OR = [
        { sourceText: { contains: q, mode: 'insensitive' } },
        { targetText: { contains: q, mode: 'insensitive' } },
      ]
    }

    const [entries, total] = await Promise.all([
      db.tMEntry.findMany({ where, skip, take: limit, orderBy: { usedCount: 'desc' } }),
      db.tMEntry.count({ where }),
    ])

    return NextResponse.json({ entries, total, page, limit })
  } catch (error) {
    console.error('[GET /api/tm]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — import TMX
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const body = await req.json()
    const { content, fileType, tmxContent } = body as { content?: string; fileType?: string; tmxContent?: string }
    const rawContent = content ?? tmxContent ?? ''
    const type = fileType ?? 'tmx'

    if (!rawContent || typeof rawContent !== 'string') {
      return NextResponse.json({ error: 'Conteúdo inválido' }, { status: 400 })
    }

    const sourceLang = (body as { sourceLang?: string }).sourceLang ?? 'en'
    const targetLang = (body as { targetLang?: string }).targetLang ?? 'pt-BR'
    const isBase64 = (body as { isBase64?: boolean }).isBase64 ?? false

    let entries: TmPair[]
    if (type === 'docx' && isBase64) {
      entries = await parseDocx(rawContent, sourceLang, targetLang)
    } else {
      entries = parseContent(rawContent, type, sourceLang, targetLang)
    }
    if (entries.length === 0) {
      return NextResponse.json({ error: 'Nenhuma entrada encontrada no arquivo TMX' }, { status: 400 })
    }

    // Upsert each entry (skip duplicates)
    let imported = 0
    let skipped = 0
    for (const e of entries) {
      try {
        await db.tMEntry.upsert({
          where: { sourceText_sourceLang_targetLang: { sourceText: e.sourceText, sourceLang: e.sourceLang, targetLang: e.targetLang } },
          update: { targetText: e.targetText },
          create: {
            sourceLang: e.sourceLang,
            targetLang: e.targetLang,
            sourceText: e.sourceText,
            targetText: e.targetText,
            createdById: session.user.id,
          },
        })
        imported++
      } catch {
        skipped++
      }
    }

    return NextResponse.json({ ok: true, imported, skipped, total: entries.length })
  } catch (error) {
    console.error('[POST /api/tm]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
