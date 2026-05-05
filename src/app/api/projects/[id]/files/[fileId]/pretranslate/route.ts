import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pretranslateFile } from '@/lib/pretranslate'

export const maxDuration = 300 // 5 min — arquivos grandes podem ter muitos segmentos

// POST /api/projects/[id]/files/[fileId]/pretranslate
// Pré-traduz segmentos pendentes: TM → Aquifer → IA (DeepL → Claude)
// Segmentos ficam em TRANSLATING — editor deve revisar e confirmar.

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; fileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (session.user.role !== 'GERENTE') {
      return NextResponse.json({ error: 'Apenas gerentes podem iniciar pré-tradução' }, { status: 403 })
    }

    const body = await req.json() as { provider?: string }
    const provider = (body.provider ?? 'auto') as 'deepl' | 'claude' | 'auto'

    const file = await db.projectFile.findUnique({
      where:   { id: params.fileId },
      include: { project: { select: { id: true, sourceLang: true, targetLang: true } } },
    })
    if (!file) return NextResponse.json({ error: 'Arquivo não encontrado' }, { status: 404 })
    if (file.projectId !== params.id) {
      return NextResponse.json({ error: 'Arquivo não pertence a este projeto' }, { status: 400 })
    }

    const result = await pretranslateFile({
      fileId:    params.fileId,
      projectId: params.id,
      srcLang:   file.project.sourceLang,
      tgtLang:   file.project.targetLang,
      bookCode:  file.bookCode,
      provider,
      baseUrl:   process.env.NEXTAUTH_URL ?? 'http://localhost:3000/app',
      cookie:    req.headers.get('cookie') ?? '',
    })

    if (result.total === 0) {
      return NextResponse.json({ ok: true, translated: 0, message: 'Nenhum segmento pendente' })
    }

    const sources = [
      result.fromAquifer > 0 ? `${result.fromAquifer} do Aquifer` : '',
      result.fromTM       > 0 ? `${result.fromTM} da memória`     : '',
      result.fromAI       > 0 ? `${result.fromAI} por IA`         : '',
    ].filter(Boolean).join(', ')

    return NextResponse.json({
      ok: true,
      ...result,
      message: `${result.translated} segmento(s) pré-traduzido(s)${sources ? ` (${sources})` : ''}${result.errors > 0 ? ` — ${result.errors} com erro` : ''}`,
    })
  } catch (error) {
    console.error('[POST pretranslate]', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
