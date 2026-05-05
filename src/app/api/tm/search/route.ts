import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import type { TMMatch } from '@/types'

// ─── Simple similarity score (Jaccard on word sets) ───────────────────────────
function jaccardSimilarity(a: string, b: string): number {
  const tokensA = a.toLowerCase().split(/\s+/).filter(Boolean)
  const tokensB = b.toLowerCase().split(/\s+/).filter(Boolean)
  const setA = new Set<string>(tokensA)
  const setB = new Set<string>(tokensB)

  let intersectionSize = 0
  tokensA.forEach((t) => { if (setB.has(t)) intersectionSize++ })

  const unionTokens = new Set<string>(tokensA)
  tokensB.forEach((t) => unionTokens.add(t))

  if (unionTokens.size === 0) return 0
  return Math.round((intersectionSize / unionTokens.size) * 100)
}

// ─── Mock TM database ──────────────────────────────────────────────────────────
const TM_ENTRIES: (Omit<TMMatch, 'score'> & { sourceLang: string; targetLang: string })[] = [
  {
    id: 'tm1',
    sourceText:
      'Though I speak with the tongues of men and of angels, and have not charity, I am become as sounding brass, or a tinkling cymbal.',
    targetText:
      'Ainda que eu falasse as línguas dos homens e dos anjos, e não tivesse amor, seria como o metal que soa ou como o sino que tine.',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    createdAt: '2026-01-15T10:00:00Z',
    usedCount: 22,
  },
  {
    id: 'tm2',
    sourceText:
      'For now we see through a glass, darkly; but then face to face: now I know in part; but then shall I know even as also I am known.',
    targetText:
      'Porque agora vemos por espelho em enigma, mas então veremos face a face; agora conheço em parte, mas então conhecerei como também sou conhecido.',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    createdAt: '2026-02-10T09:00:00Z',
    usedCount: 14,
  },
  {
    id: 'tm3',
    sourceText:
      'And now abideth faith, hope, charity, these three; but the greatest of these is charity.',
    targetText:
      'Agora, pois, permanecem a fé, a esperança e o amor, estes três; mas o maior destes é o amor.',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    createdAt: '2026-01-20T14:30:00Z',
    usedCount: 7,
  },
  {
    id: 'tm4',
    sourceText: 'Charity never faileth.',
    targetText: 'O amor nunca falha.',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    createdAt: '2026-01-05T11:15:00Z',
    usedCount: 30,
  },
  {
    id: 'tm5',
    sourceText:
      'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up,',
    targetText:
      'O amor é sofredor, é benigno; o amor não é invejoso; o amor não trata com leviandade, não se ensoberbece.',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    createdAt: '2026-02-01T08:00:00Z',
    usedCount: 11,
  },
  {
    id: 'tm6',
    sourceText:
      'When I was a child, I spake as a child, I understood as a child, I thought as a child: but when I became a man, I put away childish things.',
    targetText:
      'Quando eu era menino, falava como menino, sentia como menino, discorria como menino; mas quando me tornei homem, acabei com as coisas de menino.',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    createdAt: '2026-03-05T10:00:00Z',
    usedCount: 5,
  },
  {
    id: 'tm7',
    sourceText: 'For we know in part, and we prophesy in part.',
    targetText: 'Porque, em parte, conhecemos, e, em parte, profetizamos.',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    createdAt: '2026-03-10T09:00:00Z',
    usedCount: 3,
  },
  {
    id: 'tm8',
    sourceText:
      'But when that which is perfect is come, then that which is in part shall be done away.',
    targetText:
      'Mas quando vier o que é perfeito, então o que é em parte será abolido.',
    sourceLang: 'en',
    targetLang: 'pt-BR',
    createdAt: '2026-03-12T11:00:00Z',
    usedCount: 2,
  },
]

const MIN_SCORE = 50

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const source = searchParams.get('source') ?? ''
    const sourceLang = searchParams.get('sourceLang') ?? 'en'
    const targetLang = searchParams.get('targetLang') ?? 'pt-BR'
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '5', 10), 20)

    if (!source.trim()) {
      return NextResponse.json({ matches: [], query: source, sourceLang, targetLang })
    }

    // Try real DB first, fall back to mock
    let matches: TMMatch[]

    try {
      // Real DB query would go here — for now always use mock
      throw new Error('Using mock')
    } catch {
      matches = TM_ENTRIES.filter(
        (e) => e.sourceLang === sourceLang && e.targetLang === targetLang
      )
        .map((e) => ({
          ...e,
          score: jaccardSimilarity(source, e.sourceText),
        }))
        .filter((e) => e.score >= MIN_SCORE)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
    }

    return NextResponse.json({
      matches,
      query: source,
      sourceLang,
      targetLang,
    })
  } catch (error) {
    console.error('[GET /api/tm/search]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
