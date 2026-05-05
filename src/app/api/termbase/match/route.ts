import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// GET /api/termbase/match?text=...&srcLang=...&tgtLang=...
// Returns all glossary terms whose sourceTerm appears in the given text
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const text    = searchParams.get('text') ?? ''
    const srcLang = searchParams.get('srcLang') ?? 'en'
    const tgtLang = searchParams.get('tgtLang') ?? 'pt-BR'

    if (!text.trim()) return NextResponse.json({ terms: [] })

    const textLower = text.toLowerCase()

    // Fetch all terms for this language pair
    const all = await db.termbase.findMany({
      where: { sourceLang: srcLang, targetLang: tgtLang },
      select: {
        id: true, sourceTerm: true, targetTerm: true,
        definition: true, domain: true, forbidden: true,
      },
      take: 200,
    })

    // Filter: sourceTerm must appear as a whole word (or substring) in text
    const matched = all.filter(t => {
      const term = t.sourceTerm.toLowerCase()
      return textLower.includes(term)
    })

    // Sort by term length descending (longer terms first = more specific)
    matched.sort((a, b) => b.sourceTerm.length - a.sourceTerm.length)

    return NextResponse.json({ terms: matched.slice(0, 10) })
  } catch (error) {
    console.error('[GET /api/termbase/match]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
