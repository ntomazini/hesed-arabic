import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }          from 'next-auth'
import { authOptions }               from '@/lib/auth'
import { getAiConfig, saveAiConfig, getApiKeyStatus, AiConfig } from '@/lib/ai-config'

// GET /api/config/ai  — retorna configuração atual + status das chaves
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    return NextResponse.json({
      ...getAiConfig(),
      apiKeys: getApiKeyStatus(),
    })
  } catch (error) {
    console.error('[GET /api/config/ai]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT /api/config/ai  — salva nova configuração
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    const body = await req.json() as Partial<AiConfig>
    if (!body.providers || !Array.isArray(body.providers) || body.providers.length === 0) {
      return NextResponse.json({ error: 'Configuração inválida' }, { status: 400 })
    }
    // Valida IDs aceitos
    const validIds = new Set(['deepl', 'openai', 'claude'])
    for (const p of body.providers) {
      if (!validIds.has(p.id)) {
        return NextResponse.json({ error: `Provedor inválido: ${p.id}` }, { status: 400 })
      }
    }
    saveAiConfig({ providers: body.providers })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[PUT /api/config/ai]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
