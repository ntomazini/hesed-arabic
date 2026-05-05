import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// Jaccard word similarity (0-100)
function similarity(a: string, b: string): number {
  const clean = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean)
  const wa = new Set(clean(a))
  const wb = new Set(clean(b))
  if (wa.size === 0 || wb.size === 0) return 0
  let inter = 0
  wa.forEach(w => { if (wb.has(w)) inter++ })
  const union = wa.size + wb.size - inter
  return Math.round((inter / union) * 100)
}

// GET /api/tm/match?text=...&srcLang=...&tgtLang=...&min=75
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const text    = searchParams.get('text') ?? ''
    const srcLang = searchParams.get('srcLang') ?? 'en'
    const tgtLang = searchParams.get('tgtLang') ?? 'pt-BR'
    const minScore = parseInt(searchParams.get('min') ?? '60', 10)

    if (!text.trim()) return NextResponse.json({ matches: [] })

    // Fetch TM entries for this language pair (limit 500 for matching)
    const entries = await db.tMEntry.findMany({
      where: { sourceLang: srcLang, targetLang: tgtLang },
      select: { id: true, sourceText: true, targetText: true, quality: true, domain: true },
      take: 500,
      orderBy: { usedCount: 'desc' },
    })

    // Score each entry
    const scored = entries
      .map(e => ({ ...e, score: similarity(text, e.sourceText) }))
      .filter(e => e.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // top 5 matches

    return NextResponse.json({ matches: scored })
  } catch (error) {
    console.error('[GET /api/tm/match]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
