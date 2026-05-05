import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }          from 'next-auth'
import { authOptions }               from '@/lib/auth'
import { db }                        from '@/lib/db'
import { rateLimitTranslate }        from '@/lib/rate-limit'
import { getAiConfig }               from '@/lib/ai-config'
import { tryProvider } from '@/lib/ai-translate'

// ── POST /api/ai/translate ────────────────────────────────────────────────────
// Body: { text, srcLang, tgtLang, provider?, glossaryTerms? }

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

    const limited = await rateLimitTranslate(session.user.id)
    if (limited) return limited

    const body = await req.json() as {
      text:           string
      srcLang:        string
      tgtLang:        string
      provider?:      'deepl' | 'claude' | 'openai' | 'auto'
      glossaryTerms?: Array<{ sourceTerm: string; targetTerm: string }>
      projectId?:     string
      fileId?:        string
    }

    const { text, srcLang, tgtLang, provider = 'auto', glossaryTerms = [] } = body

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Texto vazio' }, { status: 400 })
    }

    const glossaryContext = glossaryTerms.length > 0
      ? glossaryTerms.map(t => `${t.sourceTerm} → ${t.targetTerm}`).join('\n')
      : ''

    let translation  = ''
    let usedProvider: string = provider

    if (provider === 'auto') {
      const config = getAiConfig()
      const active = config.providers.filter(p => p.enabled)
      for (const p of active) {
        const result = await tryProvider(p.id, text, srcLang, tgtLang, glossaryContext)
        if (result) {
          translation  = result.translation
          usedProvider = result.provider
          break
        }
      }
      if (!translation) {
        return NextResponse.json({ error: 'Nenhum provedor retornou tradução' }, { status: 503 })
      }
    } else {
      const result = await tryProvider(provider, text, srcLang, tgtLang, glossaryContext)
      if (!result) {
        return NextResponse.json(
          { error: `${provider} indisponível ou chave não configurada` },
          { status: 503 }
        )
      }
      translation  = result.translation
      usedProvider = result.provider
    }

    // Registra uso (fire-and-forget)
    const providerEnum = usedProvider === 'deepl'  ? 'DEEPL'
                       : usedProvider === 'openai' ? 'OPENAI'
                       : 'CLAUDE'
    db.aiUsageLog.create({
      data: {
        userId:    session.user.id,
        provider:  providerEnum,
        chars:     text.length,
        projectId: body.projectId ?? null,
        fileId:    body.fileId    ?? null,
      },
    }).catch(() => {})

    return NextResponse.json({ translation, provider: usedProvider })
  } catch (error) {
    console.error('[POST /api/ai/translate]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
